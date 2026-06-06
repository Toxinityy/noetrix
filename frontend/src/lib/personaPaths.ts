import { Coins, LineChart, Wrench, type LucideIcon } from "lucide-react";
import type { TourId } from "@/components/tour/steps";

export type PersonaId = "earn" | "alpha" | "build";

export interface PersonaPath {
  id: PersonaId;
  label: string;
  blurb: string;
  href: string;
  tourId: TourId;
  icon: LucideIcon;
}

/// Single source of truth for the 3-persona onboarding spine. Reused by the
/// landing StartHere strip and the first-run OnboardingModal. Each href is the
/// page its tour lives on (kept in sync via personaPaths.test.ts).
export const PERSONA_PATHS: PersonaPath[] = [
  {
    id: "earn",
    label: "Earn",
    blurb: "Try a no-wallet yield simulator.",
    href: "/simulation",
    tourId: "earn",
    icon: Coins,
  },
  {
    id: "alpha",
    label: "See the alpha",
    blurb: "Live AI signals and on-chain track records.",
    href: "/insights",
    tourId: "alpha",
    icon: LineChart,
  },
  {
    id: "build",
    label: "Build",
    blurb: "Submit an agent or read the feed.",
    href: "/submit",
    tourId: "build",
    icon: Wrench,
  },
];
