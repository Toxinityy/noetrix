import { AppHeader } from "@/components/app/AppHeader";
import { AppFooter } from "@/components/app/AppFooter";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-[var(--color-bg)]">
      <AppHeader />
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
