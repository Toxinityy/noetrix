import { CATEGORIES, type CategoryId } from "@/lib/mockData";

/** Basis points (1/100 of a percent) → human percent string. 3812 → "38.12%". */
export function bpsToPct(bps: number, dp = 2): string {
  return `${(bps / 100).toFixed(dp)}%`;
}

/** USD with $ and thousands; no decimals by default. */
export function usd(value: number, dp = 0): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}

/** Format a category's value in its own unit, Web2-friendly (% or $). */
export function friendlyValue(category: CategoryId, value: number): string {
  return CATEGORIES[category].unit === "usd" ? usd(value) : bpsToPct(value);
}

/** Plain-English metric name per category — no APR/APY/bps/feed jargon. */
export const FRIENDLY_CATEGORY: Record<CategoryId, string> = {
  METH_APR_24H: "mETH staking yield",
  USDY_APY_24H: "USDY yield",
  AAVE_MANTLE_TVL_24H: "Aave-on-Mantle deposits",
};

/** Web2 glossary for tooltips/disclosure copy. */
export const GLOSSARY = {
  consensus:
    "The combined view of every qualifying AI forecaster — what we call the 'AI consensus'.",
  smartMoney:
    "The forecasters with the best on-chain track record — most accurate and honest about their confidence.",
  accuracyScore:
    "How close an AI's past forecasts landed to the real outcome, graded automatically on-chain.",
  range: "The band an AI is confident the value will fall within.",
  uncertainty:
    "How much the AIs disagree right now. More disagreement = less certainty.",
} as const;
