import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  encodeAbiParameters,
  decodeAbiParameters,
  parseEventLogs,
  toHex,
  defineChain,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount, nonceManager } from "viem/accounts";
import { agentRegistryAbi, predictionMarketAbi } from "./abis.js";
import { resolveCategory } from "./categories.js";
import type {
  ContractAddresses,
  PredictionValue,
  RangeValue,
  RevealMaterial,
  CommitResult,
  OnChainCategory,
} from "./types.js";

const MANTLE_SEPOLIA_ID = 5003;

export interface AgentOptions {
  agentId: bigint | number;
  controllerPrivateKey: Hex;
  rpcUrl: string;
  contractAddresses: ContractAddresses;
  chainId?: number;
  /// Max attempts for transient write failures (default 3).
  maxRetries?: number;
  /// Poll interval (ms) while waiting for reveal window (default 2000 ≈ Mantle block time).
  pollIntervalMs?: number;
}

const RANGE_ABI = [{ type: "uint256" }, { type: "uint256" }] as const;
const COMMIT_HASH_ABI = [
  { type: "uint256" }, // agentId
  { type: "bytes32" }, // categoryId
  { type: "bytes" }, // value
  { type: "uint16" }, // confidence
  { type: "bytes32" }, // nonce
] as const;

function isRange(v: PredictionValue): v is RangeValue {
  return typeof v === "object" && v !== null && "low" in v && "high" in v;
}

/// ABI-encode a [low, high] range to the bytes the contract stores as `value`.
export function encodeRangeValue(value: PredictionValue): Hex {
  if (!isRange(value)) return value;
  return encodeAbiParameters(RANGE_ABI, [value.low, value.high]);
}

function randomNonce(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/// Base agent: handles commit-reveal orchestration, gas estimation (viem default), bounded retry on
/// transient failures, and nonce caching (viem nonceManager) for batch submissions.
export class Agent {
  readonly agentId: bigint;
  readonly addresses: ContractAddresses;
  readonly account: Account;
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;

  private readonly maxRetries: number;
  private readonly pollIntervalMs: number;
  /// In-memory reveal material keyed by predictionId. Persist externally for cross-process reveal.
  private readonly pending = new Map<string, RevealMaterial>();

  constructor(opts: AgentOptions) {
    this.agentId = BigInt(opts.agentId);
    this.addresses = opts.contractAddresses;
    this.maxRetries = opts.maxRetries ?? 3;
    this.pollIntervalMs = opts.pollIntervalMs ?? 2000;

    const chain = defineChain({
      id: opts.chainId ?? MANTLE_SEPOLIA_ID,
      name: "Mantle Sepolia",
      nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
      rpcUrls: { default: { http: [opts.rpcUrl] } },
    });

    // nonceManager gives automatic nonce caching/increment across rapid sequential sends.
    this.account = privateKeyToAccount(opts.controllerPrivateKey, { nonceManager });
    this.publicClient = createPublicClient({ chain, transport: http(opts.rpcUrl) });
    this.walletClient = createWalletClient({ account: this.account, chain, transport: http(opts.rpcUrl) });
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  /// Read a category's on-chain config (stake floor, allowed resolution window, scorer domain).
  async getCategoryConfig(category: string): Promise<OnChainCategory> {
    const cat = resolveCategory(category);
    const c = (await this.publicClient.readContract({
      address: this.addresses.predictionMarket,
      abi: predictionMarketAbi,
      functionName: "getCategory",
      args: [cat.id],
    })) as {
      resolver: Hex;
      scorer: Hex;
      minStake: bigint;
      allowedWindowStart: bigint;
      allowedWindowEnd: bigint;
      configBytes: Hex;
      registered: boolean;
    };

    let domainMin: bigint | undefined;
    let domainMax: bigint | undefined;
    if (c.configBytes && c.configBytes !== "0x") {
      try {
        [domainMin, domainMax] = decodeAbiParameters(RANGE_ABI, c.configBytes) as [bigint, bigint];
      } catch {
        /* leave undefined */
      }
    }
    return {
      resolver: c.resolver,
      scorer: c.scorer,
      minStake: c.minStake,
      allowedWindowStart: c.allowedWindowStart,
      allowedWindowEnd: c.allowedWindowEnd,
      registered: c.registered,
      domainMin,
      domainMax,
    };
  }

  // ─── Commit ────────────────────────────────────────────────────────────────

  /// Commit a forecast. Encodes the range, generates a random nonce, computes the commit hash, and
  /// submits with stake = category.minStake (override via opts.stake). Returns reveal material.
  async commit(
    category: string,
    value: PredictionValue,
    confidence: number,
    resolutionBlock: bigint,
    contentHash: Hex,
    opts?: { stake?: bigint },
  ): Promise<CommitResult> {
    const cat = resolveCategory(category);
    const valueBytes = encodeRangeValue(value);
    const nonce = randomNonce();
    const commitHash = keccak256(
      encodeAbiParameters(COMMIT_HASH_ABI, [
        this.agentId,
        cat.id,
        valueBytes,
        confidence,
        nonce,
      ]),
    );

    let stake = opts?.stake;
    if (stake === undefined) {
      const onchain = await this.getCategoryConfig(category);
      stake = onchain.minStake;
    }

    const txHash = await this.withRetry(() =>
      this.walletClient.writeContract({
        address: this.addresses.predictionMarket,
        abi: predictionMarketAbi,
        functionName: "commit",
        args: [this.agentId, cat.id, commitHash, resolutionBlock, contentHash],
        value: stake,
        account: this.account,
        chain: this.walletClient.chain,
      }),
    );

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    const logs = parseEventLogs({
      abi: predictionMarketAbi,
      eventName: "PredictionCommitted",
      logs: receipt.logs,
    });
    const ev = logs.find((l) => l.args.commitHash === commitHash);
    if (!ev) throw new Error(`PredictionCommitted not found in receipt for tx ${txHash}`);
    const predictionId = ev.args.predictionId as bigint;
    const commitBlock = ev.args.commitBlock as bigint;

    const material: RevealMaterial = { predictionId, value: valueBytes, confidence, nonce, commitBlock };
    this.pending.set(predictionId.toString(), material);

    return { ...material, commitHash, contentHash, resolutionBlock, txHash };
  }

  // ─── Reveal ──────────────────────────────────────────────────────────────────

  /// Reveal a committed prediction. Waits for REVEAL_DELAY_BLOCKS, then reveals before the window
  /// closes. Uses in-memory material from commit() unless `material` is supplied (cross-process).
  async reveal(predictionId: bigint, material?: RevealMaterial): Promise<Hex> {
    const m = material ?? this.pending.get(predictionId.toString());
    if (!m) {
      throw new Error(
        `No reveal material for prediction ${predictionId}. Pass it explicitly if revealing in a separate process.`,
      );
    }

    const [delay, window] = (await Promise.all([
      this.publicClient.readContract({
        address: this.addresses.predictionMarket,
        abi: predictionMarketAbi,
        functionName: "REVEAL_DELAY_BLOCKS",
      }),
      this.publicClient.readContract({
        address: this.addresses.predictionMarket,
        abi: predictionMarketAbi,
        functionName: "REVEAL_WINDOW_BLOCKS",
      }),
    ])) as [bigint, bigint];

    const earliest = m.commitBlock + delay;
    const latest = m.commitBlock + window;

    // Wait until the reveal window opens.
    let current = await this.publicClient.getBlockNumber();
    while (current < earliest) {
      if (current > latest) break;
      await sleep(this.pollIntervalMs);
      current = await this.publicClient.getBlockNumber();
    }
    if (current > latest) {
      throw new Error(
        `Reveal window missed for prediction ${predictionId} (now ${current} > latest ${latest}).`,
      );
    }

    const txHash = await this.withRetry(() =>
      this.walletClient.writeContract({
        address: this.addresses.predictionMarket,
        abi: predictionMarketAbi,
        functionName: "reveal",
        args: [predictionId, m.value, m.confidence, m.nonce],
        account: this.account,
        chain: this.walletClient.chain,
      }),
    );
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    this.pending.delete(predictionId.toString());
    return txHash;
  }

  // ─── Full cycle ──────────────────────────────────────────────────────────────

  /// Commit, then automatically reveal once the window opens. Resolves with both tx hashes.
  async submitFullCycle(
    category: string,
    value: PredictionValue,
    confidence: number,
    resolutionBlock: bigint,
    contentHash: Hex,
    opts?: { stake?: bigint },
  ): Promise<{ predictionId: bigint; commitTx: Hex; revealTx: Hex }> {
    const committed = await this.commit(category, value, confidence, resolutionBlock, contentHash, opts);
    const revealTx = await this.reveal(committed.predictionId, committed);
    return { predictionId: committed.predictionId, commitTx: committed.txHash, revealTx };
  }

  // ─── Registration ────────────────────────────────────────────────────────────

  /// Register the controller as a new agent (ERC-8004 soulbound NFT). Sends the 0.1 MNT fee.
  /// Returns the minted agentId. One-shot — a controller can only bind one agent.
  async register(metadataURI: string): Promise<bigint> {
    const fee = (await this.publicClient.readContract({
      address: this.addresses.agentRegistry,
      abi: agentRegistryAbi,
      functionName: "REGISTRATION_FEE",
    })) as bigint;

    const txHash = await this.withRetry(() =>
      this.walletClient.writeContract({
        address: this.addresses.agentRegistry,
        abi: agentRegistryAbi,
        functionName: "register",
        args: [metadataURI],
        value: fee,
        account: this.account,
        chain: this.walletClient.chain,
      }),
    );
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    const logs = parseEventLogs({
      abi: agentRegistryAbi,
      eventName: "AgentRegistered",
      logs: receipt.logs,
    });
    const ev = logs.find((l) => l.args.controller?.toLowerCase() === this.account.address.toLowerCase());
    if (!ev) throw new Error(`AgentRegistered not found in receipt for tx ${txHash}`);
    return ev.args.agentId as bigint;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt === this.maxRetries) break;
        const backoff = this.pollIntervalMs * attempt;
        console.warn(`[agent] tx attempt ${attempt}/${this.maxRetries} failed, retrying in ${backoff}ms`);
        await sleep(backoff);
      }
    }
    throw lastErr;
  }
}
