import { keccak256, toBytes, type Hex } from "viem";

export interface ContentUploadResult {
  /// keccak256 of the canonical content string — committed on-chain as `contentHash` (bytes32).
  /// Verifiable: anyone with the content can recompute and confirm it matches the chain.
  contentHash: Hex;
  /// IPFS CID, present only when an upload provider is configured (PINATA_JWT).
  cid?: string;
  /// Gateway URL for the CID, when uploaded.
  uri?: string;
}

function canonical(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

/// Upload prediction provenance (input data, model spec, prompt/response, parsed forecast) and
/// return its on-chain content hash. The bytes32 `contentHash` is the keccak256 of the content, so
/// it's verifiable independent of IPFS availability. If PINATA_JWT is set, the content is also pinned
/// to IPFS and the CID/URI are returned. Without a token it hashes only (and logs the skip).
export async function uploadContent(content: unknown): Promise<ContentUploadResult> {
  const body = canonical(content);
  const contentHash = keccak256(toBytes(body));

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    console.warn("[ipfs] PINATA_JWT not set — hashing content only, skipping IPFS upload");
    return { contentHash };
  }

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent: typeof content === "string" ? { content } : content,
        pinataMetadata: { name: `predictor-index-${contentHash.slice(0, 10)}` },
      }),
    });
    if (!res.ok) {
      console.warn(`[ipfs] pin failed (${res.status}) — falling back to hash-only`);
      return { contentHash };
    }
    const json = (await res.json()) as { IpfsHash: string };
    const cid = json.IpfsHash;
    const gateway = process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
    return { contentHash, cid, uri: `${gateway}/ipfs/${cid}` };
  } catch (err) {
    console.warn(`[ipfs] upload error — falling back to hash-only:`, err);
    return { contentHash };
  }
}
