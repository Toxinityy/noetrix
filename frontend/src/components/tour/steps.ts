export interface TourStep {
  id: string;
  selector: string;
  title: string;
  body: string;
}

export const LEADERBOARD_STEPS: TourStep[] = [
  {
    id: "category-tabs",
    selector: '[data-tour="category-tabs"]',
    title: "Pick an RWA market",
    body: "Switch between mETH staking APR, USDY treasury APY, and Aave-on-Mantle TVL. Each is its own on-chain category with a resolver and scorer.",
  },
  {
    id: "feed-value",
    selector: '[data-tour="feed-value"]',
    title: "The consensus feed",
    body: "A rank-weighted composite of the most calibrated agents — the value protocols subscribe to, with a live confidence band.",
  },
  {
    id: "agent-table",
    selector: '[data-tour="agent-table"]',
    title: "Ranked forecasters",
    body: "Every agent is an ERC-8004 soulbound identity, ranked by on-chain accuracy and calibration. Click a row to see its reasoning trace.",
  },
  {
    id: "top-agent",
    selector: '[data-tour="top-agent"]',
    title: "Category leader",
    body: "The current top agent for this market and its live reputation — accuracy, calibration, and resolved count.",
  },
  {
    id: "rwa-strategy",
    selector: '[data-tour="rwa-strategy"]',
    title: "Yield + risk, automated",
    body: "Forecasts drive a dynamic allocation across mETH and USDY plus an automated risk state — the AI x RWA core.",
  },
  {
    id: "how-it-works",
    selector: '[data-tour="how-it-works"]',
    title: "Go deeper",
    body: "Expand here to see exactly how scoring works — or try the no-wallet Earn simulator and the Consumer demo from the top nav.",
  },
];

export type TourId = "leaderboard" | "earn" | "alpha" | "build" | "try";

export const EARN_STEPS: TourStep[] = [
  {
    id: "earn-yields",
    selector: '[data-tour="earn-yields"]',
    title: "AI-forecast yields",
    body: "These cards show what AI agents predict you'd earn on mETH and USDY over the next day — and how confident they are.",
  },
  {
    id: "earn-simulator",
    selector: '[data-tour="earn-simulator"]',
    title: "Try it — no wallet",
    body: "Drag the deposit amount. The AI splits it across mETH and USDY for the best risk-adjusted yield. No wallet, no signup.",
  },
  {
    id: "earn-how",
    selector: '[data-tour="earn-how"]',
    title: "How your money is protected",
    body: "When the AIs lose confidence, the strategy automatically shifts toward safety. Expand here to see the rules.",
  },
  {
    id: "earn-more",
    selector: '[data-tour="earn-more"]',
    title: "Go deeper",
    body: "Want to see which AIs drive these numbers? Open the live leaderboard.",
  },
];

export const ALPHA_STEPS: TourStep[] = [
  {
    id: "alpha-proof",
    selector: '[data-tour="alpha-proof"]',
    title: "Proof, not promises",
    body: "How the best AIs beat the crowd. Every figure is graded on-chain — follow the explorer link to verify any of it.",
  },
  {
    id: "alpha-replay",
    selector: '[data-tour="alpha-replay"]',
    title: "Forecast vs. reality",
    body: "Each row replays a past AI forecast against what actually happened on-chain. In-range means the AI called it.",
  },
  {
    id: "alpha-findings",
    selector: '[data-tour="alpha-findings"]',
    title: "Where the crowd and proven AI split",
    body: "The most accurate AIs vs. the crowd, the biggest bull/bear split, and live anomalies.",
  },
  {
    id: "alpha-yourmove",
    selector: '[data-tour="alpha-yourmove"]',
    title: "Your move",
    body: "A plain-English briefing: the current risk state and how the AI is allocating right now.",
  },
];

export const BUILD_STEPS: TourStep[] = [
  {
    id: "build-steps",
    selector: '[data-tour="build-steps"]',
    title: "Ship an agent in 4 steps",
    body: "Register an on-chain identity, then commit and reveal forecasts. Every prediction is auto-scored.",
  },
  {
    id: "build-sdk",
    selector: '[data-tour="build-sdk"]',
    title: "The SDK does the plumbing",
    body: "One call handles the commit-reveal cycle and staking. Copy this snippet to start.",
  },
  {
    id: "build-consumer",
    selector: '[data-tour="build-consumer"]',
    title: "Read the feed",
    body: "Any Mantle protocol can read the composite feed in one call — see the consumer demo.",
  },
];

export const TRY_STEPS: TourStep[] = [
  {
    id: "try-refresh",
    selector: '[data-tour="try-refresh"]',
    title: "Write to the live protocol",
    body: "Connect a wallet, switch to Mantle Sepolia, and refresh the on-chain AI feed yourself — one permissionless transaction. No wallet? Use the Preview.",
  },
];

export const TOURS: Record<TourId, TourStep[]> = {
  leaderboard: LEADERBOARD_STEPS,
  earn: EARN_STEPS,
  alpha: ALPHA_STEPS,
  build: BUILD_STEPS,
  try: TRY_STEPS,
};

export const TOUR_PAGES: Record<TourId, string> = {
  leaderboard: "/terminal/leaderboard",
  earn: "/terminal/simulation",
  alpha: "/terminal/insights",
  build: "/terminal/submit",
  try: "/terminal/try",
};
