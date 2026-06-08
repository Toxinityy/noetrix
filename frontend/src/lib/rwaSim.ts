/// Pure, deterministic client mirror of the on-chain RWA decision math, driven by a single
/// "market conditions" stress input (0 = calm, 100 = stressed). It exists so the /rwa
/// DepositSimulator can let a user (or a demo judge) move ONE control and watch both the
/// allocation re-weight and the safety state flip — the AI-x-RWA causal story, live.
///
/// Why a stress input and not a raw confidence: allocation is a confidence-weighted RATIO
/// (allocMeth = methYield·conf / (methYield·conf + usdyYield·conf)). A single SHARED confidence
/// cancels in that ratio, so it would move the safety badge but never the bar. Modelling stress as
/// a flight-to-safety — confidence in the volatile asset (mETH/LST) falls faster than the stable
/// one (USDY/treasuries) — makes one control move BOTH, and matches the real risk story.
///
/// Thresholds mirror contracts/src/examples/{YieldAllocator,RiskManager}.sol EXACTLY:
///   YieldAllocator: eff = yield × conf / 1e4; allocMeth = em·1e4/(em+eu); 50/50 when total==0.
///   RiskManager:    conf < 4000 → Frozen; conf < 7500 → Caution; else Normal.
/// Keep these in sync if the contracts change.

export const CONF_FLOOR_BPS = 4_000; // RiskManager.CONF_FLOOR_BPS — below → Frozen
export const CONF_CAUTION_BPS = 7_500; // RiskManager.CONF_CAUTION_BPS — below → Caution
const METH_STRESS_PENALTY_BPS = 60; // volatile asset: confidence falls 60 bps per stress point
const USDY_STRESS_PENALTY_BPS = 25; // stable asset: falls slower

export type RiskState = 0 | 1 | 2; // Normal | Caution | Frozen — matches RiskManager.State

export interface MarketBase {
  methApyPct: number; // forecast mETH yield, %
  usdyApyPct: number; // forecast USDY yield, %
  baseConfBps: number; // AI confidence at calm (stress 0), 0–10000
}

export interface MarketResult {
  allocMethBps: number; // 0–10000, sums to 10000 with usdy
  allocUsdyBps: number;
  riskState: RiskState; // worst (highest) of the two assets, like RwaClient's headline badge
  methConfBps: number;
  usdyConfBps: number;
  blendedApyPct: number; // allocation-weighted blended yearly return
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/// Mirrors RiskManager.riskState for a single asset's confidence.
export function riskFromConfBps(confBps: number): RiskState {
  if (confBps < CONF_FLOOR_BPS) return 2;
  if (confBps < CONF_CAUTION_BPS) return 1;
  return 0;
}

/// Pure decision fn. Deterministic: same inputs → same output. No I/O, no Date/random.
export function simulateMarket(stress: number, base: MarketBase): MarketResult {
  const s = clamp(stress, 0, 100);
  const methConfBps = clamp(base.baseConfBps - s * METH_STRESS_PENALTY_BPS, 0, 10_000);
  const usdyConfBps = clamp(base.baseConfBps - s * USDY_STRESS_PENALTY_BPS, 0, 10_000);

  // eff yield = yield × conf / 1e4 (the /1e4 cancels in the ratio, kept for parity with the contract).
  const em = base.methApyPct * methConfBps;
  const eu = base.usdyApyPct * usdyConfBps;
  const total = em + eu;

  let allocMethBps: number;
  if (total <= 0) {
    allocMethBps = 5_000; // YieldAllocator's safe 50/50 default
  } else {
    allocMethBps = Math.round((em * 10_000) / total);
  }
  const allocUsdyBps = 10_000 - allocMethBps;

  const riskState = Math.max(riskFromConfBps(methConfBps), riskFromConfBps(usdyConfBps)) as RiskState;

  const blendedApyPct =
    (allocMethBps / 10_000) * base.methApyPct + (allocUsdyBps / 10_000) * base.usdyApyPct;

  return { allocMethBps, allocUsdyBps, riskState, methConfBps, usdyConfBps, blendedApyPct };
}

/// One-line plain-English reason for the current safety state, shown under the badge when it
/// leaves Normal so a non-crypto judge reads WHY it flipped (not a glitch). Empty when Normal.
export function riskReason(r: MarketResult): string {
  if (r.riskState === 0) return "";
  const driver = r.methConfBps <= r.usdyConfBps ? "mETH staking" : "USDY treasury";
  if (r.riskState === 2) {
    return `AI confidence in ${driver} fell below 40%, so the protocol pauses new deposits until conditions settle.`;
  }
  return `Lower AI confidence in ${driver}, so the protocol shifts toward the safer asset and tightens limits.`;
}
