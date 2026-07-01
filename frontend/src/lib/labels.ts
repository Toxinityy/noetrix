import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { fmtBps, fmtUSD } from "@/lib/format";

// Single source of truth for number formatting lives in format.ts. These aliases
// keep the humane-label call sites (bpsToPct / usd) readable without a second impl.
/** Basis points (1/100 of a percent) to a human percent string. 382 to "3.82%". */
export const bpsToPct = fmtBps;
/** USD with $ and thousands; no decimals by default. */
export const usd = fmtUSD;

/** Format a category's value in its own unit, Web2-friendly (% or $). */
export function friendlyValue(category: CategoryId, value: number): string {
  return CATEGORIES[category].unit === "usd" ? usd(value) : bpsToPct(value);
}

/** Plain-English metric name per category. No APR/APY/bps/feed jargon. */
export const FRIENDLY_CATEGORY: Record<CategoryId, string> = {
  METH_APR_24H: "mETH staking yield",
  USDY_APY_24H: "USDY yield",
  AAVE_MANTLE_TVL_24H: "Aave-on-Mantle deposits",
  MNT_USD_SPOT: "MNT/USD spot price",
};

/** Web2 glossary for tooltips/disclosure copy. */
export const GLOSSARY = {
  consensus:
    "The combined view of every qualifying AI forecaster. We call it the 'AI consensus'.",
  smartMoney:
    "The forecasters with the best on-chain track record: most accurate, and honest about their confidence.",
  accuracyScore:
    "How close an AI's past forecasts landed to the real outcome, graded automatically on-chain.",
  range: "The band an AI is confident the value will fall within.",
  uncertainty:
    "How much the AIs disagree right now. More disagreement means less certainty.",
} as const;
