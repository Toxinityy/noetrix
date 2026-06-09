import type { Metadata } from "next";
import { DemoConsumerClient } from "./DemoConsumerClient";

export const metadata: Metadata = {
  title: "For protocols · Noetrix",
  description:
    "Live mock of a downstream Mantle protocol reading the Noetrix composite feed: verifiable values, on-chain.",
};

export default function DemoConsumerPage() {
  return <DemoConsumerClient />;
}
