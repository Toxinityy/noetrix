import { describe, it, expect } from "vitest";
import {
  screenSanctions,
  isAddress,
  evaluateCompliance,
  fallbackMemo,
  assessWith,
  EDD_THRESHOLD_USD,
  type ComplianceInput,
} from "./compliance";

const CLEAN = "0x1111111111111111111111111111111111111111";
const SANCTIONED = "0x722122df12d4e14e13ac3b6895a86e84145b6967"; // sample OFAC SDN (Tornado router)

function input(over: Partial<ComplianceInput> = {}): ComplianceInput {
  return {
    address: CLEAN,
    amountUsd: 1_000,
    asset: "usdy",
    riskState: 0,
    sanctioned: false,
    kycVerified: true,
    ...over,
  };
}

describe("screenSanctions", () => {
  it("flags a sanctioned address (case-insensitive)", () => {
    expect(screenSanctions(SANCTIONED)).toBe(true);
    expect(screenSanctions(SANCTIONED.toUpperCase().replace("0X", "0x"))).toBe(true);
  });
  it("passes a clean address", () => {
    expect(screenSanctions(CLEAN)).toBe(false);
  });
});

describe("isAddress", () => {
  it("validates EVM address shape", () => {
    expect(isAddress(CLEAN)).toBe(true);
    expect(isAddress("0x123")).toBe(false);
    expect(isAddress("not-an-address")).toBe(false);
  });
});

describe("evaluateCompliance", () => {
  it("ALLOWs a clean, KYC'd, Normal-risk, small USDY deposit", () => {
    expect(evaluateCompliance(input()).decision).toBe("ALLOW");
  });

  it("DENYs a sanctioned address regardless of everything else", () => {
    const r = evaluateCompliance(input({ sanctioned: true }));
    expect(r.decision).toBe("DENY");
    expect(r.checks.find((c) => c.id === "sanctions")?.status).toBe("fail");
  });

  it("DENYs USDY when the holder is not KYC-verified (transfer restriction)", () => {
    const r = evaluateCompliance(input({ kycVerified: false }));
    expect(r.decision).toBe("DENY");
    expect(r.checks.find((c) => c.id === "kyc")?.status).toBe("fail");
  });

  it("does NOT require KYC for permissionless mETH", () => {
    const r = evaluateCompliance(input({ asset: "meth", kycVerified: false }));
    expect(r.checks.find((c) => c.id === "kyc")?.status).toBe("pass");
    expect(r.decision).toBe("ALLOW");
  });

  it("DENYs when the asset is Frozen by the AI risk engine", () => {
    expect(evaluateCompliance(input({ riskState: 2 })).decision).toBe("DENY");
  });

  it("routes to REVIEW on Caution risk state", () => {
    expect(evaluateCompliance(input({ riskState: 1 })).decision).toBe("REVIEW");
  });

  it("routes to REVIEW for large notional (>= EDD threshold)", () => {
    const r = evaluateCompliance(input({ amountUsd: EDD_THRESHOLD_USD }));
    expect(r.decision).toBe("REVIEW");
    expect(r.checks.find((c) => c.id === "edd")?.status).toBe("warn");
  });

  it("REVIEWs when the risk manager is unreachable", () => {
    expect(evaluateCompliance(input({ riskState: -1 })).decision).toBe("REVIEW");
  });
});

describe("assessWith", () => {
  it("uses the model output when available", async () => {
    const r = evaluateCompliance(input());
    const memo = await assessWith(input(), r, async () => "Cleared per policy.");
    expect(memo).toBe("Cleared per policy.");
  });

  it("falls back deterministically when the model throws", async () => {
    const i = input({ sanctioned: true });
    const r = evaluateCompliance(i);
    const memo = await assessWith(i, r, async () => {
      throw new Error("model down");
    });
    expect(memo).toBe(fallbackMemo(i, r));
    expect(memo).toContain("blocked");
  });
});
