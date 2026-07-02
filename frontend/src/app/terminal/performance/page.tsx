import type { Metadata } from "next";
import { PerformanceClient } from "./PerformanceClient";

export const metadata: Metadata = {
  title: "Performance · Noetrix",
  description:
    "Do the on-chain AI forecasters actually perform? Verifiable on-chain track record and real-history out-of-sample backtests, cleanly separated.",
};

export default function PerformancePage() {
  return <PerformanceClient />;
}
