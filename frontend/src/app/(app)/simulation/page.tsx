import { RwaClient } from "./RwaClient";

export const metadata = {
  title: "RWA Yield — Noetrix",
  description: "AI-forecast yield on Mantle real-world assets. No wallet needed to explore.",
};

export default function RwaPage() {
  return <RwaClient />;
}
