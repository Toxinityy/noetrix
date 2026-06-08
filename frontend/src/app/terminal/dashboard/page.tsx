import type { Metadata } from "next";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = {
  title: "Terminal Dashboard · Predictor Index",
  description: "Protocol dashboard for Predictor Index feed, agent, prediction, and network status.",
};

export default function TerminalDashboardPage() {
  return <DashboardClient />;
}
