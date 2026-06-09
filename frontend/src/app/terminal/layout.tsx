import { AppHeader } from "@/components/app/AppHeader";
import { AppFooter } from "@/components/app/AppFooter";
import { TourProvider } from "@/components/tour/TourProvider";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { TerminalBootGate } from "./TerminalBootGate";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider>
      <OnboardingModal />
      <div className="relative flex min-h-svh flex-col overflow-hidden bg-[var(--color-bg)]">
        <div aria-hidden className="pointer-events-none fixed inset-0 opacity-40 [background-image:linear-gradient(rgba(51,234,179,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(51,234,179,.05)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(51,234,179,.12),transparent_42%)]" />
        <AppHeader />
        <main id="main" tabIndex={-1} className="relative z-10 flex-1 pt-20 focus:outline-none">
          <TerminalBootGate>{children}</TerminalBootGate>
        </main>
        <AppFooter />
      </div>
    </TourProvider>
  );
}
