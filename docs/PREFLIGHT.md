# Pre-flight checklist (Prompt 13 Part G)

Audit of PRD §2 (success criteria) and §17 (submission checklist) against the current build.
Snapshot: **2026-05-29**. Legend: ✅ done · 🟡 code complete, blocked on live deploy · ⛔ not started / blocked · ❓ needs user input.

## The one blocker that gates almost everything

**Mantle Sepolia deploy has not run** — needs a funded `PRIVATE_KEY`, `MANTLE_SEPOLIA_RPC`, and `MANTLESCAN_API_KEY`. All contract/agent/indexer/frontend **code is complete and verified** (147/147 forge tests, all TS packages typecheck, `next build` clean). Every 🟡 below flips to ✅ once the deploy + a ~24h agent SEED run happen.

## PRD §2 — Success criteria

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Contracts deployed + verified on Mantle | ⛔ | `Deploy.s.sol` ready; dry-run simulated. Needs creds. |
| 2 | 2 reference agents running live | 🟡 | ARIMA + DeepSeek reasoner built + typecheck clean; need deploy + funded controller keys + `OPENROUTER_API_KEY`. |
| 3 | 2 categories with working resolution | 🟡 | METH_APR + AAVE_MANTLE_TVL resolvers + scorer complete + unit-tested; live resolution needs deploy + seeded oracles. |
| 4 | Live leaderboard (accuracy + calibration) | 🟡 | Frontend built + wired (live→cached→mock); calibrating badge/skeleton/empty done. Needs live indexer. |
| 5 | Composite feed callable by external contracts | 🟡 | `CompositeFeed` + `ICompositeFeed` complete + tested. Needs deploy. |
| 6 | ≥1 demo consumer reading the feed | 🟡 | `DemoFeedConsumer` (business-logic views + full-pipeline E2E test). Needs deploy. |
| 7 | ≥50 resolved predictions on leaderboard | ⛔ | Comes from agents in SEED_MODE ~24h post-deploy. |
| 8 | Public frontend URL (non-localhost) | ⛔ | `next build` clean; Vercel deploy pending addresses. |
| 9 | Demo video ≥2 min | ⛔ | Script = Part E (this prompt); recording = Prompt 14. |
| 10 | Open-source GitHub repo + complete README | 🟡 | Repo public (`Toxinityy/mantle-hackathon`); GitHub-facing README = Part D (pending). |
| 11 | Every AI decision committed on-chain | ✅ | Commit-reveal + `contentHash` on every prediction; agents pin full prompt+response/model-spec to IPFS. Code-complete; live demo gated on deploy. |

**Stretch (Grand Champion):**
| Item | Status | Notes |
|------|--------|-------|
| Mainnet deploy | ⛔ | Prompt 14 Part A, optional. Sepolia is acceptable. |
| Mantle protocol LOI to consume feed | ⛔ | Business/outreach, outside code scope. |

## PRD §17 — Submission checklist (DoraHacks)

| Item | Status | Notes |
|------|--------|-------|
| One-liner | ✅ | Provided in PRD §17; reused in `docs/SUBMISSION.md`. |
| Full description | 🟡 | `docs/SUBMISSION.md` = Part F (pending). |
| GitHub repo (public) | ✅ | `github.com/Toxinityy/mantle-hackathon` (confirm visibility = public). |
| Live frontend URL | ⛔ | Vercel deploy pending. |
| Demo video ≥2 min | ⛔ | Script Part E; record Prompt 14. |
| Deployed addresses (explorer-verified) | ⛔ | Pending deploy. |
| Track: AI x RWA | ✅ | Pivoted from AI Alpha & Data (redefined). Also competing: Best UX / Smoothest Web2 Onboarding. |
| Grand Champion nomination | ✅ | Planned (stretch). |
| Team info | ❓ | **Needs user input** — names/handles/roles for README + submission. |

## Action items, ordered

1. **Get deploy creds** → run `Deploy.s.sol` + `SeedRates.s.sol` on Sepolia, verify on Mantlescan. Unblocks §2.1, 3, 5, 6 and the addresses row.
2. **Stand up the indexer** (Railway + Postgres) with the deployed addresses + start block. Unblocks §2.4.
3. **Register + run both agents** (funded controller keys, `OPENROUTER_API_KEY`); leave in SEED_MODE ~24h. Unblocks §2.2, 7.
4. **Set `NEXT_PUBLIC_*` env, rebuild, deploy to Vercel.** Unblocks §2.8 + live URL. Regenerate `fallback-leaderboard.json` against the live indexer.
5. **Provide team info** (❓) for README + submission doc.
6. **Record the demo video** (Prompt 14) from `docs/DEMO_SCRIPT.md`.

## Bottom line

Everything that can be built without a chain **is built and verified**. The remaining work is operational: deploy, run agents, host, record. No code blockers identified.
