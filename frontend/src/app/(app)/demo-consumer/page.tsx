import type { Metadata } from "next";
import { DemoConsumerClient } from "./DemoConsumerClient";

export const metadata: Metadata = {
  title: "Consumer demo — Predictor Index",
  description:
    "Live mock of a downstream Mantle protocol reading the Predictor Index composite feed. Code, code, code — verifiable values, on-chain.",
};

export default function DemoConsumerPage() {
  return <DemoConsumerClient />;
}
