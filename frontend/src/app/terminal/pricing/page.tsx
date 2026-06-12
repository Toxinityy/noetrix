import type { Metadata } from "next";
import { PricingClient } from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing · Noetrix",
  description: "MVP pricing for Noetrix forecast intelligence.",
};

export default function PricingPage() {
  return <PricingClient />;
}
