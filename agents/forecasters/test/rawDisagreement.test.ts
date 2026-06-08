import { describe, it, expect } from "vitest";
import { rawDisagreement, aggregateSwarm, CAL_SCALE } from "../src/index.js";

const dom = { domainMin: 0n, domainMax: 100_000n };

describe("rawDisagreement", () => {
  it("zero for a single identical-point band set (D=0, width=0)", () => {
    expect(rawDisagreement([50_000n], [50_000n], dom.domainMin, dom.domainMax)).toBe(0n);
  });
  it("wide bands at identical midpoints still register (Wbar term)", () => {
    const tight = rawDisagreement([49_800n, 49_800n], [50_200n, 50_200n], dom.domainMin, dom.domainMax);
    const wide = rawDisagreement([0n, 0n], [100_000n, 100_000n], dom.domainMin, dom.domainMax);
    expect(wide).toBeGreaterThan(tight);
  });
  it("is consistent with aggregateSwarm's normalized disagreementBps", () => {
    // disagreementBps = min(CAL_SCALE, rawDisagreement*CAL_SCALE/scale) * 10000 / CAL_SCALE
    const lo = [49_000n, 49_000n, 49_000n];
    const hi = [51_000n, 51_000n, 51_000n];
    const scale = 5_000n;
    const dRaw = rawDisagreement(lo, hi, dom.domainMin, dom.domainMax);
    let d = (dRaw * CAL_SCALE) / scale;
    if (d > CAL_SCALE) d = CAL_SCALE;
    const expectedBps = Number((d * 10_000n) / CAL_SCALE);
    const r = aggregateSwarm(lo, hi, [9_000, 9_000, 9_000], [0n, 0n, 0n], { ...dom, disagreeScale: scale });
    expect(r.disagreementBps).toBe(expectedBps);
  });
});
