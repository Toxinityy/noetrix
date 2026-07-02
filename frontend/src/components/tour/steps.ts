export interface TourStep {
  id: string;
  /** Optional terminal route this step lives on. When set and different from the
   *  current page, the Spotlight navigates there before highlighting the anchor.
   *  Single-page tours omit it. */
  page?: string;
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
    body: "A rank-weighted composite of the most calibrated agents: the value protocols subscribe to, with a live confidence band.",
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
    body: "The current top agent for this market and its live reputation: accuracy, calibration, and resolved count.",
  },
  {
    id: "rwa-strategy",
    selector: '[data-tour="rwa-strategy"]',
    title: "Yield + risk, automated",
    body: "Forecasts drive a dynamic allocation across mETH and USDY plus an automated risk state, the AI x RWA core.",
  },
  {
    id: "how-it-works",
    selector: '[data-tour="how-it-works"]',
    title: "Go deeper",
    body: "Expand here to see exactly how scoring works, or try the no-wallet Earn simulator and the protocol demo from the top nav.",
  },
];

export type TourId = "full" | "leaderboard" | "earn" | "alpha" | "build" | "try";

export const EARN_STEPS: TourStep[] = [
  {
    id: "earn-yields",
    selector: '[data-tour="earn-yields"]',
    title: "AI-forecast yields",
    body: "These cards show what AI agents predict you'd earn on mETH and USDY over the next day, and how confident they are.",
  },
  {
    id: "earn-simulator",
    selector: '[data-tour="earn-simulator"]',
    title: "Try it, no wallet",
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
    body: "Any Mantle protocol can read the composite feed in one call. See the consumer demo.",
  },
];

export const TRY_STEPS: TourStep[] = [
  {
    id: "try-refresh",
    selector: '[data-tour="try-refresh"]',
    title: "Write to the live protocol",
    body: "Connect a wallet, switch to Mantle Sepolia, and refresh the on-chain AI feed yourself: one permissionless transaction. No wallet? Use the Preview.",
  },
];

/// The full "essentials" walkthrough: a cross-page tour through every core surface.
/// Used as the default auto-start when entering the terminal. Each step names the
/// page it lives on, so the Spotlight navigates between surfaces as it advances.
export const FULL_STEPS: TourStep[] = [
  {
    id: "full-dashboard",
    page: "/terminal/dashboard",
    selector: '[data-tour="dash-overview"]',
    title: "Welcome to Noetrix",
    body: "Every number here was predicted BEFORE the outcome and graded on-chain — nothing can be faked or backdated. That's the whole idea. Let's walk the essentials.",
  },
  {
    id: "full-feed",
    page: "/terminal/leaderboard",
    selector: '[data-tour="feed-value"]',
    title: "The AI consensus feed",
    body: "A rank-weighted forecast from the most calibrated AIs, with a confidence band. Any protocol can read it on-chain in one call.",
  },
  {
    id: "full-agents",
    page: "/terminal/leaderboard",
    selector: '[data-tour="agent-table"]',
    title: "Ranked AI forecasters",
    body: "Every forecaster is an ERC-8004 soulbound identity, ranked by on-chain accuracy and honesty. This leaderboard is the benchmark.",
  },
  {
    id: "full-reasoning",
    // Agent 2 = the live DeepSeek reasoner — its page features the REAL pinned trace.
    page: "/terminal/agent/2",
    selector: '[data-tour="agent-reasoning"]',
    title: "Verifiable reasoning",
    body: "Open any agent to read its full reasoning trace, committed on-chain before the outcome was known. No hindsight, no faking it.",
  },
  {
    id: "full-insights",
    page: "/terminal/performance",
    selector: '[data-tour="alpha-proof"]',
    title: "Proof, not promises",
    body: "Do the AIs actually perform? Here's the evidence — a verifiable on-chain track record and real-history, out-of-sample backtests, kept cleanly separate. Every figure is checkable.",
  },
  {
    id: "full-simulator",
    page: "/terminal/simulation",
    selector: '[data-tour="earn-simulator"]',
    title: "Try it, no wallet",
    body: "Drag the market conditions and watch the AI reallocate yield across mETH and USDY in real time. No wallet, no signup.",
  },
  {
    id: "full-try",
    page: "/terminal/try",
    selector: '[data-tour="try-refresh"]',
    title: "Write to the live feed",
    body: "Connect a wallet and refresh the on-chain AI feed yourself, one permissionless transaction. Or stay in Preview, no wallet needed.",
  },
  {
    id: "full-build",
    page: "/terminal/submit",
    selector: '[data-tour="build-steps"]',
    title: "Build your own agent",
    body: "Register an agent, commit and reveal forecasts, and climb the leaderboard. The SDK handles the plumbing. That's the tour!",
  },
];

export const TOURS: Record<TourId, TourStep[]> = {
  full: FULL_STEPS,
  leaderboard: LEADERBOARD_STEPS,
  earn: EARN_STEPS,
  alpha: ALPHA_STEPS,
  build: BUILD_STEPS,
  try: TRY_STEPS,
};

export const TOUR_PAGES: Record<TourId, string> = {
  full: "/terminal/dashboard",
  leaderboard: "/terminal/leaderboard",
  earn: "/terminal/simulation",
  alpha: "/terminal/insights",
  build: "/terminal/submit",
  try: "/terminal/try",
};
