import type { Metadata } from "next";
import { TryClient } from "./TryClient";

export const metadata: Metadata = {
  title: "Try it live · Noetrix",
  description: "Connect a wallet and write to the live on-chain AI feed on Mantle Sepolia.",
};

export default function TryPage() {
  return <TryClient />;
}
