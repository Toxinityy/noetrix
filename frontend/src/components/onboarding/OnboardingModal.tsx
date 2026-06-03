"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PERSONA_PATHS } from "@/lib/personaPaths";
import { useTour, ONBOARDED_KEY } from "@/components/tour/TourProvider";
import { cn } from "@/lib/cn";

/// First-run intent modal. Shows once per browser (localStorage ONBOARDED_KEY).
/// Picking a persona routes to its page and arms that goal's tour; "Just looking"
/// dismisses. Owns first-run, so the leaderboard auto-tour stands down.
export function OnboardingModal() {
  const { requestStart } = useTour();
  const [open, setOpen] = React.useState(false);

  // Client-only first-run check (avoids SSR/hydration mismatch). Deferred out of
  // the effect body (React-Compiler: no synchronous setState in effects).
  React.useEffect(() => {
    let onboarded = false;
    try {
      onboarded = localStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {}
    if (onboarded) return;
    const t = setTimeout(() => setOpen(true), 0);
    return () => clearTimeout(t);
  }, []);

  const markOnboarded = React.useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
  }, []);

  const dismiss = React.useCallback(() => {
    markOnboarded();
    setOpen(false);
  }, [markOnboarded]);

  const pick = React.useCallback(
    (tourId: Parameters<typeof requestStart>[0]) => {
      markOnboarded();
      setOpen(false);
      requestStart(tourId); // routes to the page + arms the tour
    },
    [markOnboarded, requestStart],
  );

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (!o ? dismiss() : setOpen(o))}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[71] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-6 shadow-2xl focus:outline-none"
          aria-describedby="onb-desc"
        >
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)]">
            New here? What do you want to do?
          </Dialog.Title>
          <Dialog.Description id="onb-desc" className="mt-1 text-sm text-[var(--color-text-dim)]">
            Pick a path and we&apos;ll show you around in a few steps.
          </Dialog.Description>

          <div className="mt-5 flex flex-col gap-2.5">
            {PERSONA_PATHS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p.tourId)}
                  className={cn(
                    "group flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-left transition-colors",
                    "hover:border-[var(--color-accent)]",
                  )}
                >
                  <Icon size={20} className="text-[var(--color-accent)]" aria-hidden />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-[var(--color-text)]">{p.label}</span>
                    <span className="text-xs text-[var(--color-text-dim)]">{p.blurb}</span>
                  </span>
                  <span
                    aria-hidden
                    className="ml-auto text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="mt-4 w-full text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            Just looking
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
