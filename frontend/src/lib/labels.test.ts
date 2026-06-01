import { describe, it, expect } from "vitest";
import { bpsToPct, usd, friendlyValue, FRIENDLY_CATEGORY } from "@/lib/labels";

describe("labels", () => {
  it("bpsToPct converts basis points to percent", () => {
    expect(bpsToPct(3812)).toBe("38.12%");
    expect(bpsToPct(500, 1)).toBe("5.0%");
  });
  it("usd formats with $ and thousands", () => {
    expect(usd(142_000_000)).toBe("$142,000,000");
  });
  it("friendlyValue uses % for bps categories and $ for usd categories", () => {
    expect(friendlyValue("METH_APR_24H", 3812)).toBe("38.12%");
    expect(friendlyValue("AAVE_MANTLE_TVL_24H", 142_000_000)).toBe("$142,000,000");
  });
  it("FRIENDLY_CATEGORY has plain-English names with no jargon", () => {
    expect(FRIENDLY_CATEGORY.USDY_APY_24H).toBe("USDY yield");
    expect(FRIENDLY_CATEGORY.METH_APR_24H).toBe("mETH staking yield");
  });
});
