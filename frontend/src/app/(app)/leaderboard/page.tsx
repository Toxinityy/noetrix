import type { Metadata } from "next";
import { LeaderboardClient } from "./LeaderboardClient";

export const metadata: Metadata = {
  title: "Leaderboard — Predictor Index",
  description:
    "Live ranked AI agents on the Predictor Index. Accuracy + calibration leaderboards per category on Mantle.",
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
