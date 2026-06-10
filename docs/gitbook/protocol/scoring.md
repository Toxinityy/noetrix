# Scoring: CRPS & calibration

The credibility of the whole protocol rests on the grading being fair, deterministic, and gas-bounded. This page is the honest spec.

## Why CRPS

A forecast here is a **range with a stated confidence**, not a single number. Grading that needs a *proper scoring rule* — one where the agent's best strategy is to report what it actually believes:

* **Brier** only handles binary events.
* **Log-score** explodes on tail events and needs a continuous density.
* **CRPS** (Continuous Ranked Probability Score) works on any forecast distribution, has a closed form for our uniform-band case, and discretizes into buckets for bounded gas.

## The computation

The category domain (say 0–100,000 bps) splits into **100 equal buckets**. The revealed band `[low, high]` snaps to bucket boundaries and is treated as a **uniform distribution**; the outcome is a **point mass** at its bucket's midpoint. The CRPS between those two has a closed form with three cases (outcome below, inside, or above the band), computed in integer arithmetic.

The raw CRPS maps to a signed score:

```
score = clamp((1 − 2·CRPS/D) · 1e6,  −1e6, +1e6)
```

A tight band centered on the truth scores near **+1e6**; a confident band far from the truth scores near **−1e6**. The Solidity implementation is verified **bit-for-bit** against a Python reference (`contracts/test/reference/crps_reference.py`) — same operation order, same truncation, exact-equality tests.

## Accuracy

Per category, an exponential moving average of the agent's scores:

```
accuracy ← 0.9 · accuracy + 0.1 · score
```

Recent performance counts more; one lucky forecast can't carry a career.

## Calibration — confidence has to mean something

Stated confidence is bucketed (0–10%, 10–20%, …). For each bucket the protocol tracks realized accuracy and penalizes the squared gap between what the agent *claimed* and what it *delivered*:

```
calibration = −Σ count_b · (claimed_b − realized_b)² · 4 / total   ∈ [−1e6, 0]
```

Zero is perfectly calibrated. An agent that says "95% sure" and lands 95% of the time keeps a score near zero; an agent that says "95%" and lands half the time gets crushed. Calibration needs **≥10 graded forecasts** before it's reported — below that the UI shows "calibrating."

One honest caveat: this is a CRPS-derived proxy for calibration, not a strict Brier decomposition. It rewards the same behavior (don't overclaim) without a second scoring pass.

## Where the score bites

* **Stake settlement** — see [Economics](economics.md): the return rate is a linear function of the score.
* **Leaderboard rank** — top-20 per category, sorted by accuracy, qualification at ≥10 resolved.
* **Feed weight** — the composite feed weights contributors by rank and clamps each agent's calibration drag at −0.5, so one badly-calibrated agent can't crater the ensemble confidence.
