"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PERSONA_PATHS } from "@/lib/personaPaths";
import { useTour } from "@/components/tour/TourProvider";
import { cn } from "@/lib/cn";

/// "What do you want to do?" needs-picker. Open-state lives in TourProvider:
/// it shows once on first run AND re-opens whenever the Guide button is clicked.
/// Picking a persona routes to its page and arms that goal's tour; "Just looking" dismisses.
export function OnboardingModal() {
  const { requestStart, onboardingOpen, closeOnboarding } = useTour();

  const pick = React.useCallback(
    (tourId: Parameters<typeof requestStart>[0]) => {
      closeOnboarding();
      requestStart(tourId); // routes to the page + arms the tour
    },
    [closeOnboarding, requestStart],
  );

  return (
    <Dialog.Root open={onboardingOpen} onOpenChange={(o) => (!o ? closeOnboarding() : undefined)}>
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
            onClick={closeOnboarding}
            className="mt-4 w-full text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            Just looking
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
