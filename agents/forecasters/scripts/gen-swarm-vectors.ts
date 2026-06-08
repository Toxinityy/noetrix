import { writeFileSync, mkdirSync } from "node:fs";
import { aggregateSwarm, type SwarmParams } from "../src/swarm.js";

interface Case { name: string; lo: string[]; hi: string[]; stated: number[]; cal: string[]; params: { domainMin: string; domainMax: string; disagreeScale: string } }

const cases: Case[] = [
  { name: "meth-agree-n3", lo: ["49000", "49000", "49000"], hi: ["51000", "51000", "51000"], stated: [9800, 9800, 9800], cal: ["0", "0", "0"], params: { domainMin: "0", domainMax: "100000", disagreeScale: "5000" } },
  { name: "meth-scatter-n3", lo: ["10000", "49000", "88000"], hi: ["12000", "51000", "90000"], stated: [9000, 9000, 9000], cal: ["0", "0", "0"], params: { domainMin: "0", domainMax: "100000", disagreeScale: "5000" } },
  { name: "meth-lone-n1", lo: ["48000"], hi: ["52000"], stated: [9600], cal: ["0"], params: { domainMin: "0", domainMax: "100000", disagreeScale: "5000" } },
  { name: "usdy-agree-n3", lo: ["480", "490", "485"], hi: ["520", "510", "515"], stated: [9000, 9000, 9000], cal: ["0", "0", "0"], params: { domainMin: "0", domainMax: "2000", disagreeScale: "120" } },
];

const out = cases.map((c) => {
  const p: SwarmParams = { domainMin: BigInt(c.params.domainMin), domainMax: BigInt(c.params.domainMax), disagreeScale: BigInt(c.params.disagreeScale) };
  const r = aggregateSwarm(c.lo.map(BigInt), c.hi.map(BigInt), c.stated, c.cal.map(BigInt), p);
  return { ...c, expected: { ensemble: r.ensemble.toString(), confidenceBps: r.confidenceBps, disagreementBps: r.disagreementBps, contributors: r.contributors } };
});

mkdirSync("test/vectors", { recursive: true });
writeFileSync("test/vectors/swarm-vectors.json", JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${out.length} swarm vectors`);
