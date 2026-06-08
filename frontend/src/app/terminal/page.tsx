import type { Metadata } from "next";
import { TerminalBootClient } from "./TerminalBootClient";

export const metadata: Metadata = {
  title: "Initializing Terminal — Noetrix",
  description: "Boot into the Noetrix protocol terminal.",
};

export default function TerminalPage() {
  return <TerminalBootClient />;
}
