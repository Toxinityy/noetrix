import { AppHeader } from "@/components/app/AppHeader";
import { AppFooter } from "@/components/app/AppFooter";
import { TourProvider } from "@/components/tour/TourProvider";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider>
      <OnboardingModal />
      <div className="flex min-h-svh flex-col bg-[var(--color-bg)]">
        <AppHeader />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <AppFooter />
      </div>
    </TourProvider>
  );
}
