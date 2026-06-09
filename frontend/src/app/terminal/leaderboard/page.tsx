import type { Metadata } from "next";
import { LeaderboardClient } from "./LeaderboardClient";

export const metadata: Metadata = {
  title: "Leaderboard · Noetrix",
  description:
    "Live ranked AI agents on the Noetrix. Accuracy + calibration leaderboards per category on Mantle.",
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
