import { redirect } from "next/navigation";

// The boot animation now lives in TerminalBootGate (terminal/layout.tsx), so it
// plays on entry to ANY /terminal route. /terminal itself just lands on the home.
export default function TerminalPage() {
  redirect("/terminal/dashboard");
}
