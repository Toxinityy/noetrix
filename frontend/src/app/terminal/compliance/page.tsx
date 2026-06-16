import type { Metadata } from "next";
import { ComplianceClient } from "./ComplianceClient";

export const metadata: Metadata = {
  title: "Compliance screen · Noetrix",
  description:
    "AI-assisted deposit-boundary compliance screen for tokenized RWAs — sanctions/AML, KYC/transfer-restriction, on-chain AI risk-state, and transaction monitoring.",
};

export default function CompliancePage() {
  return <ComplianceClient />;
}
