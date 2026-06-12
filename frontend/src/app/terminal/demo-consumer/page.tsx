import type { Metadata } from "next";
import { DemoConsumerClient } from "./DemoConsumerClient";

export const metadata: Metadata = {
  title: "For protocols · Noetrix",
  description:
    "Downstream Mantle protocol demo reading the Noetrix composite feed, with its data source clearly identified.",
};

export default function DemoConsumerPage() {
  return <DemoConsumerClient />;
}
