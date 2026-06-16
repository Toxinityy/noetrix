// AI-assisted compliance screening for the tokenized-RWA deposit boundary.
//
// A deterministic rule engine produces the substance (sanctions/AML, KYC/transfer
// restriction, AI risk-state circuit-breaker, transaction-monitoring), and an LLM
// "assist" layer writes the human-readable recommendation. The AI is grounded in the
// concrete checks — it explains the decision, it does not invent it.

export type ComplianceAsset = "meth" | "usdy";
export type ComplianceDecision = "ALLOW" | "REVIEW" | "DENY";
/** On-chain RiskManager.State (0 Normal, 1 Caution, 2 Frozen); -1 = unreachable. */
export type RiskState = 0 | 1 | 2 | -1;

export interface ComplianceInput {
  address: string;
  amountUsd: number;
  asset: ComplianceAsset;
  riskState: RiskState;
  sanctioned: boolean;
  kycVerified: boolean;
}

export interface ComplianceCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface ComplianceResult {
  decision: ComplianceDecision;
  checks: ComplianceCheck[];
  reasons: string[];
}

/** Enhanced-due-diligence threshold (USD). At/above this, deposits route to manual review. */
export const EDD_THRESHOLD_USD = 100_000;

// Sample OFAC SDN crypto addresses (publicly listed Tornado Cash entries). The demo
// screens against this set; production swaps in a live provider (Chainalysis / TRM /
// OFAC API) behind the same `screenSanctions` boundary.
const SANCTIONED = new Set<string>(
  [
    "0x8589427373D6D84E98730D7795D8f6f8731FDA16",
    "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",
    "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b",
    "0xDD4c48C0B24039969fC16D1cdF626eaB821d3384",
  ].map((a) => a.toLowerCase()),
);

/** Screen an address against the sanctions/blocklist. Pluggable; demo uses a sample OFAC set. */
export function screenSanctions(address: string): boolean {
  return SANCTIONED.has(address.trim().toLowerCase());
}

/** EVM address shape check. */
export function isAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s.trim());
}

/** Deterministic compliance rule engine. Any fail → DENY; else any warn → REVIEW; else ALLOW. */
export function evaluateCompliance(i: ComplianceInput): ComplianceResult {
  const checks: ComplianceCheck[] = [];

  // 1. Sanctions / AML screening
  checks.push(
    i.sanctioned
      ? { id: "sanctions", label: "Sanctions / AML screening", status: "fail", detail: "Address matches a sanctioned-entity (OFAC SDN) list — deposit blocked." }
      : { id: "sanctions", label: "Sanctions / AML screening", status: "pass", detail: "No match against the sanctioned-address list." },
  );

  // 2. KYC / transfer restriction (USDY is a KYC-gated, transfer-restricted Ondo instrument)
  if (i.asset === "usdy") {
    checks.push(
      i.kycVerified
        ? { id: "kyc", label: "KYC / accredited holder (USDY)", status: "pass", detail: "Holder is KYC-verified and allow-listed for USDY." }
        : { id: "kyc", label: "KYC / accredited holder (USDY)", status: "fail", detail: "USDY is transfer-restricted (Ondo): holder is not KYC-verified / allow-listed — blocked at the asset boundary." },
    );
  } else {
    checks.push({ id: "kyc", label: "KYC / transfer restriction", status: "pass", detail: "mETH is a permissionless liquid-staking token — no holder allow-list required." });
  }

  // 3. AI risk-state circuit breaker (driven by the forecast / anomaly engine via RiskManager)
  if (i.riskState === -1) {
    checks.push({ id: "risk", label: "AI risk-state (forecast engine)", status: "warn", detail: "On-chain risk manager unreachable — defaulting to manual review." });
  } else if (i.riskState === 2) {
    checks.push({ id: "risk", label: "AI risk-state (forecast engine)", status: "fail", detail: "Asset is Frozen by the AI risk engine (low forecast confidence / stale feed) — new deposits halted." });
  } else if (i.riskState === 1) {
    checks.push({ id: "risk", label: "AI risk-state (forecast engine)", status: "warn", detail: "Asset is in Caution (elevated forecast uncertainty) — deposit routed to review." });
  } else {
    checks.push({ id: "risk", label: "AI risk-state (forecast engine)", status: "pass", detail: "Asset risk state is Normal — AI forecast confidence is healthy." });
  }

  // 4. Transaction monitoring (structuring / large-notional enhanced due diligence)
  checks.push(
    i.amountUsd >= EDD_THRESHOLD_USD
      ? { id: "edd", label: "Transaction monitoring", status: "warn", detail: `Notional ≥ $${EDD_THRESHOLD_USD.toLocaleString("en-US")} EDD threshold — enhanced due diligence required.` }
      : { id: "edd", label: "Transaction monitoring", status: "pass", detail: "Notional below the enhanced-due-diligence threshold." },
  );

  const hasFail = checks.some((c) => c.status === "fail");
  const hasWarn = checks.some((c) => c.status === "warn");
  const decision: ComplianceDecision = hasFail ? "DENY" : hasWarn ? "REVIEW" : "ALLOW";
  const reasons = checks.filter((c) => c.status !== "pass").map((c) => `${c.label}: ${c.detail}`);
  return { decision, checks, reasons };
}

/** Prompt for the AI assist layer — grounded in the deterministic check results. */
export function buildComplianceMemoPrompt(i: ComplianceInput, r: ComplianceResult): string {
  const lines = r.checks.map((c) => `- ${c.label}: ${c.status.toUpperCase()} — ${c.detail}`).join("\n");
  return [
    `You are a compliance assistant for a tokenized-RWA deposit gateway on Mantle.`,
    `A deposit of $${i.amountUsd.toLocaleString("en-US")} into ${i.asset.toUpperCase()} from ${i.address} was screened.`,
    `Automated checks:`,
    lines,
    `Engine decision: ${r.decision}.`,
    `Write a 1–2 sentence compliance recommendation in plain English: state the decision and the single most important reason. Be precise and neutral. Reply with the memo only.`,
  ].join("\n");
}

/** Deterministic memo if the model is unavailable. */
export function fallbackMemo(i: ComplianceInput, r: ComplianceResult): string {
  if (r.decision === "ALLOW") {
    return `Deposit cleared: all automated AML, KYC, risk-state, and transaction-monitoring checks passed for ${i.asset.toUpperCase()}.`;
  }
  const top = r.reasons[0] ?? "a policy check did not pass";
  const verb = r.decision === "DENY" ? "blocked" : "routed to manual review";
  return `Deposit ${verb} — ${top}`;
}

/** AI-assisted memo with an injected fetcher; never throws (falls back deterministically). */
export async function assessWith(
  i: ComplianceInput,
  r: ComplianceResult,
  fetcher: (prompt: string) => Promise<string>,
): Promise<string> {
  try {
    const out = (await fetcher(buildComplianceMemoPrompt(i, r))).trim();
    return out || fallbackMemo(i, r);
  } catch {
    return fallbackMemo(i, r);
  }
}
