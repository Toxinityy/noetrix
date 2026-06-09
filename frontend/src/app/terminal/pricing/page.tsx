import type { Metadata } from "next";
import { PricingClient } from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing · Noetrix",
  description: "Subscribe to the AI forecast feed on Mantle Sepolia. Pay in testnet MNT.",
};

export default function PricingPage() {
  return <PricingClient />;
}
