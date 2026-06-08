import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseYieldChart, parseFearGreed, parseProtocolChainTvl, parseChainTvl, pickUsdyPool } from "../src/parsers.js";

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));

describe("parsers", () => {
  it("parseYieldChart → ascending {ts, value=apyBase%}", () => {
    const pts = parseYieldChart(fx("meth-chart.json"));
    expect(pts.length).toBe(3);
    expect(pts[0].value).toBe(3.10);
    expect(pts[0].ts).toBe(Math.floor(Date.parse("2025-02-05T00:00:00.000Z") / 1000));
    expect(pts[0].ts < pts[1].ts).toBe(true);
  });
  it("parseFearGreed → numeric values ascending by ts", () => {
    const pts = parseFearGreed(fx("fng.json"));
    expect(pts.map((p) => p.value)).toEqual([45, 52, 20]);
    expect(pts[0].ts).toBe(1738713600);
  });
  it("parseProtocolChainTvl picks the Mantle chain only", () => {
    const pts = parseProtocolChainTvl(fx("aave-protocol.json"), "Mantle");
    expect(pts.length).toBe(3);
    expect(pts[0].value).toBe(365216006);
  });
  it("parseChainTvl reads the {date,tvl} shape", () => {
    const pts = parseChainTvl(fx("chain-tvl.json"));
    expect(pts[0].value).toBe(156000000);
  });
  it("pickUsdyPool finds the Mantle Ondo USDY pool UUID", () => {
    expect(pickUsdyPool(fx("pools.json"))).toBe("usdy-mantle-uuid");
  });
});
