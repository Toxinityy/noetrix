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
  blendedApyPct: number; // nominal target blend (allocation-weighted raw yields, pre-risk)
  effectiveApyPct: number; // RISK-ADJUSTED: nominal blend haircut by per-asset confidence (on-chain eff)
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

  // Risk-adjusted return: haircut each asset's yield by its confidence (the on-chain eff = yield×conf/1e4),
  // THEN blend. As stress rises, both confidences fall → this falls monotonically. This is why a stressed
  // market pays LESS: the nominal blend can drift up when rotating to a higher-nominal-yield asset, but the
  // AI's *expected* (uncertainty-discounted) return drops — the number a depositor should actually read.
  const effMethPct = base.methApyPct * (methConfBps / 10_000);
  const effUsdyPct = base.usdyApyPct * (usdyConfBps / 10_000);
  const effectiveApyPct = (allocMethBps / 10_000) * effMethPct + (allocUsdyBps / 10_000) * effUsdyPct;

  return {
    allocMethBps,
    allocUsdyBps,
    riskState,
    methConfBps,
    usdyConfBps,
    blendedApyPct,
    effectiveApyPct,
  };
}

/// Stress-level classification — mirrors the 3-source logic in MarketStressMonitor on-chain
/// (backtest/src/stress.ts semantics): as the slider rises, simulated disagreementBps and
/// fear&greed cross the same Elevated/Stressed thresholds the contract uses.
///
/// Slider 0–100 → simulated disagreementBps 0–10000 (linear, 0→0 bps, 100→10000 bps).
/// Simulated F&G: falls from 60 (neutral) toward 10 (extreme-fear) as slider rises.
/// Starting from neutral (60) keeps the mapping monotone non-decreasing because neither
/// greed (≥75) nor fear (≤45) triggers at calm — only disagreementBps drives the level up.
///
/// Thresholds (from DEFAULT_STRESS in agents/backtest/src/stress.ts):
///   dHigh=4000, dMed=2000, fearExtreme=25, fearMed=45.
/// Level = Stressed if ANY source crosses the high threshold; Elevated if ANY medium; else Calm.
export type StressLevel = "Calm" | "Elevated" | "Stressed";

// Mirror DEFAULT_STRESS thresholds from agents/backtest/src/stress.ts
const D_HIGH = 4_000; // disagreementBps ≥ D_HIGH → Stressed
const D_MED = 2_000; // disagreementBps ≥ D_MED → Elevated
const FEAR_EXTREME = 25; // fearGreed ≤ FEAR_EXTREME → Stressed
const FEAR_MED = 45; // fearGreed ≤ FEAR_MED → Elevated

/// Maps the slider value (0–100) to simulated disagreementBps (0–10000, linear).
export function sliderToDisagreementBps(stress: number): number {
  return clamp(stress, 0, 100) * 100;
}

/// Maps the slider value (0–100) to a simulated Fear&Greed index (60→10, linear).
/// Starts in neutral territory (60), falls to extreme fear (10) at maximum stress.
/// Monotone decreasing — combined with disagreementBps, the overall level is monotone
/// non-decreasing across the slider range.
export function sliderToFearGreed(stress: number): number {
  const s = clamp(stress, 0, 100);
  // 0 → 60 (neutral), 100 → 10 (extreme fear)
  return Math.round(60 - (s / 100) * 50);
}

/// Returns the stress level for the given slider position (0–100), mirroring the on-chain
/// MarketStressMonitor 3-source classification. Monotone non-decreasing: Calm → Elevated → Stressed.
export function simulateStress(stress: number): StressLevel {
  const disagreementBps = sliderToDisagreementBps(stress);
  const fg = sliderToFearGreed(stress);

  let isStressed = false;
  let isElevated = false;

  if (disagreementBps >= D_HIGH) isStressed = true;
  else if (disagreementBps >= D_MED) isElevated = true;

  if (fg <= FEAR_EXTREME) isStressed = true;
  else if (fg <= FEAR_MED) isElevated = true;

  if (isStressed) return "Stressed";
  if (isElevated) return "Elevated";
  return "Calm";
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
