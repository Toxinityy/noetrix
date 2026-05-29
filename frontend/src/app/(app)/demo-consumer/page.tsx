import type { Metadata } from "next";
import { DemoConsumerClient } from "./DemoConsumerClient";

export const metadata: Metadata = {
  title: "Consumer demo — Noetrix",
  description:
    "Live mock of a downstream Mantle protocol reading the Noetrix composite feed. Code, code, code — verifiable values, on-chain.",
};

export default function DemoConsumerPage() {
  return <DemoConsumerClient />;
}
