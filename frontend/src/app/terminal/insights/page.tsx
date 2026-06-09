import type { Metadata } from "next";
import { InsightsClient } from "./InsightsClient";

export const metadata: Metadata = {
  title: "AI Insights — Noetrix",
  description:
    "Plain-English findings from on-chain AI forecasters on Mantle: smart-money vs the crowd, consensus trends, and uncertainty — built on verifiable on-chain data.",
};

export default function InsightsPage() {
  return <InsightsClient />;
}
