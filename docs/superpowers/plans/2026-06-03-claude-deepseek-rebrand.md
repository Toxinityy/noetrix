# Claude → DeepSeek Reasoner Rebrand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align every *displayed* and *living-spec* reference to the reference reasoner agent to the model it actually runs (DeepSeek via OpenRouter), without rewriting append-only history or corrupting "Claude Code" (the coding harness) references.

**Architecture:** Surgical, per-occurrence edits across three tiers — (1) frontend display + agent package + a correctness fix, (2) living-spec docs (README/PRD/PREFLIGHT/Prompt/masterdoc), (2b) one new CLAUDE.md session entry. The reasoner already calls OpenRouter→`deepseek/deepseek-chat-v3.1` via raw `fetch` and its on-chain identity is already "DeepSeek Reasoner"; this plan makes the *naming* honest. The prior partial attempt is a stale `git stash` (3 merge conflicts) — it is **dropped**, not applied; all edits are reproduced fresh on the merged tree.

**Tech Stack:** pnpm workspace (Next.js 16 frontend, TypeScript agent under `agents/`), Foundry contracts (untouched), Markdown docs.

**Source of truth:** `docs/superpowers/specs/2026-06-03-claude-deepseek-rebrand-design.md` (approved, post-merge update committed `ccfd314`).

**Disambiguation rule (load-bearing — applies to every task):** "Claude" has two meanings. **Rename → DeepSeek** only when it names the *reasoner agent/product* (`claude-reasoner`, "Claude Opus 4.7" badge, glyph `CL`, "Claude-driven", `@predictor-index/claude-reasoner`). **Preserve unchanged** when it names *Claude Code* (the coding harness): `CLAUDE.md` filename, `.claude/` config, session-log author voice, "fed to Claude Code". Never run a blind `s/Claude/DeepSeek/`.

**Out of scope (do NOT touch):** the internal `AgentKind` enum value `"CLAUDE"` and its `kind === "CLAUDE"` gates / `KindGlyph` map keys (internal, not user-visible); append-only history (`CLAUDE.md` dated entries, `docs/superpowers/specs/*`, `docs/superpowers/plans/*`, `docs/superpowers/RESUME-*`); contract/agent re-deploy; and the README **track positioning** text (the stash bundled an AI-x-RWA→Alpha-&-Data change — that is a separate concern, leave README track/submission wording exactly as the merged tree has it).

---

## Task 1: Rename the agent package + fix in-folder content

Rename `agents/claude-reasoner` → `agents/deepseek-reasoner`, update the workspace + package name, fix the stale broken model default, and align the IPFS provenance literal + two source comments. Safe: **no source file imports `@predictor-index/claude-reasoner`** (verified — only its own `package.json` + history docs).

**Files:**
- Rename: `agents/claude-reasoner/` → `agents/deepseek-reasoner/` (via `git mv`)
- Modify: `agents/deepseek-reasoner/package.json` (name)
- Modify: `pnpm-workspace.yaml` (workspace entry)
- Modify: `agents/deepseek-reasoner/scripts/register.ts:30` (model default)
- Modify: `agents/deepseek-reasoner/src/index.ts:87` (provenance literal)
- Modify: `agents/deepseek-reasoner/src/context.ts:15` (comment)
- Modify: `agents/deepseek-reasoner/src/config.ts:8` (comment)
- Regenerate: `pnpm-lock.yaml`

- [ ] **Step 1: Rename the folder with git**

```bash
git mv agents/claude-reasoner agents/deepseek-reasoner
```

- [ ] **Step 2: Update the package name**

In `agents/deepseek-reasoner/package.json`, line 2:
```
  "name": "@predictor-index/claude-reasoner",
```
→
```
  "name": "@predictor-index/deepseek-reasoner",
```

- [ ] **Step 3: Update the workspace entry**

In `pnpm-workspace.yaml`, change the entry:
```
  - "agents/claude-reasoner"
```
→
```
  - "agents/deepseek-reasoner"
```
(If the entry is a glob like `agents/*`, no change is needed — verify with `grep -n claude-reasoner pnpm-workspace.yaml` and only edit if an explicit entry exists.)

- [ ] **Step 4: Fix the stale broken model default (correctness, not branding)**

In `agents/deepseek-reasoner/scripts/register.ts`, line ~30:
```ts
  const model = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
```
→
```ts
  const model = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3.1";
```
(`deepseek-v4-flash` is a reasoning model that returns `content:null` and breaks the JSON parser — see CLAUDE.md 2026-05-30. `config.ts:47` already defaults correctly; this aligns `register.ts`.)

- [ ] **Step 5: Fix the IPFS provenance literal**

In `agents/deepseek-reasoner/src/index.ts`, line ~87:
```ts
    agent: "claude-reasoner",
```
→
```ts
    agent: "deepseek-reasoner",
```

- [ ] **Step 6: Fix the two source comments ("fed to Claude" = product context, not the harness)**

`agents/deepseek-reasoner/src/context.ts:15`:
```ts
/// Render a structured Markdown context block fed to Claude as the bulk of the user prompt.
```
→
```ts
/// Render a structured Markdown context block fed to the reasoner model as the bulk of the user prompt.
```

`agents/deepseek-reasoner/src/config.ts:8`:
```ts
  /// Human description of what's being predicted + units (fed to Claude).
```
→
```ts
  /// Human description of what's being predicted + units (fed to the reasoner model).
```

- [ ] **Step 7: Regenerate the lockfile + verify the workspace resolves**

Run:
```bash
pnpm install
```
Expected: completes clean; `pnpm-lock.yaml` updated; no dangling `claude-reasoner` workspace reference. Confirm:
```bash
grep -c "claude-reasoner" pnpm-lock.yaml
```
Expected: `0`.

- [ ] **Step 8: Typecheck the renamed package**

Run:
```bash
pnpm --filter @predictor-index/deepseek-reasoner exec tsc --noEmit
```
Expected: exit 0, no errors (confirms the rename + edits resolve under the new name).

- [ ] **Step 9: Commit**

```bash
git add -A agents/deepseek-reasoner pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "refactor(agent): rename claude-reasoner package to deepseek-reasoner + fix model default

The reference reasoner runs deepseek/deepseek-chat-v3.1 via OpenRouter, not
Claude. Rename the pkg/folder, fix register.ts stale v4-flash default, align
provenance literal + comments. No source imports the old pkg name.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Frontend display strings (6 files)

Reproduce the (dropped) stash's frontend edits directly on the merged tree. These swap user-visible agent names, badges, descriptions, the glyph label `CL→DS`, the insights caption, and extend the `inferKind` matchers. **Do NOT** change the internal `kind: "CLAUDE"` enum values (out of scope).

**Files:**
- Modify: `frontend/src/lib/mockData.ts` (4 agents)
- Modify: `frontend/src/app/(app)/agent/[id]/AgentDetailClient.tsx` (comment + glyph)
- Modify: `frontend/src/app/(app)/leaderboard/LeaderboardClient.tsx` (glyph)
- Modify: `frontend/src/app/(app)/insights/InsightsClient.tsx` (caption)
- Modify: `frontend/src/lib/indexer.ts` (`inferKind`)
- Modify: `frontend/src/lib/snapshot.ts` (`inferKind`)

- [ ] **Step 1: Edit `frontend/src/lib/mockData.ts` — agent id 1**

```
    name: "claude-reasoner-α",
```
→ `name: "deepseek-reasoner-α",`
```
    metadataURI: "ipfs://bafkreieclaudereasoneralpha",
```
→ `metadataURI: "ipfs://bafkreiedeepseekreasoneralpha",`
```
    badges: ["Top-1 mETH 7d", "Reasoning trace", "Claude Opus 4.7"],
```
→ `badges: ["Top-1 mETH 7d", "Reasoning trace", "DeepSeek V3.1"],`
```
      "Claude-driven reasoning agent. Posts a structured 4-step trace (frame → search → infer → forecast) to IPFS with every commit; reveals are auto-decrypted post-window.",
```
→ replace `Claude-driven` with `DeepSeek-driven` (rest of the sentence unchanged).

- [ ] **Step 2: Edit `frontend/src/lib/mockData.ts` — agent id 4**

```
    name: "claude-reasoner-β",
```
→ `name: "deepseek-reasoner-β",`
```
    metadataURI: "ipfs://bafkreiclaudereasonerbeta",
```
→ `metadataURI: "ipfs://bafkreideepseekreasonerbeta",`
```
      "Variant of claude-reasoner with confidence-tempering: deliberately understates confidence to climb the calibration leaderboard. Lower accuracy, far higher calibration.",
```
→ replace `claude-reasoner` with `deepseek-reasoner` (rest unchanged).

- [ ] **Step 3: Edit `frontend/src/lib/mockData.ts` — agent id 6**

```
    name: "claude-reasoner-γ",
```
→ `name: "deepseek-reasoner-γ",`
```
    metadataURI: "ipfs://bafkreiclaudereasonergamma",
```
→ `metadataURI: "ipfs://bafkreideepseekreasonergamma",`

- [ ] **Step 4: Edit `frontend/src/lib/mockData.ts` — agent id 8**

```
    name: "claude-haiku-fast",
```
→ `name: "deepseek-chat-fast",`
```
    metadataURI: "ipfs://bafkreiclaudehaikufast",
```
→ `metadataURI: "ipfs://bafkreideepseekchatfast",`
```
    badges: ["Claude Haiku 4.5", "Low-cost"],
```
→ `badges: ["DeepSeek V3.1", "Low-cost"],`
```
      "Lightweight Haiku-driven agent for cheap, fast forecasts. Lower accuracy ceiling but submits 5x more often.",
```
→ replace `Haiku-driven` with `DeepSeek-driven` (rest unchanged).

- [ ] **Step 5: Edit `AgentDetailClient.tsx` — comment + glyph**

`frontend/src/app/(app)/agent/[id]/AgentDetailClient.tsx`, the featured-reasoning comment:
```tsx
      {/* Featured reasoning — the visual peak (Claude agents only) */}
```
→
```tsx
      {/* Featured reasoning — the visual peak (DeepSeek reasoner agents only) */}
```
And in `kindShort`, the `CLAUDE` case return:
```tsx
    case "CLAUDE":
      return "CL";
```
→
```tsx
    case "CLAUDE":
      return "DS";
```
(Keep the `case "CLAUDE":` label — only the returned glyph string changes.)

- [ ] **Step 6: Edit `LeaderboardClient.tsx` — KindGlyph**

`frontend/src/app/(app)/leaderboard/LeaderboardClient.tsx`, in the `KindGlyph` map:
```tsx
    CLAUDE: { label: "CL", color: "var(--color-accent)" },
```
→
```tsx
    CLAUDE: { label: "DS", color: "var(--color-accent)" },
```

- [ ] **Step 7: Edit `InsightsClient.tsx` — caption**

`frontend/src/app/(app)/insights/InsightsClient.tsx`, the data-source caption:
```tsx
          <span className="text-[var(--color-text)]">AI&apos;s role:</span> independent agents (a Claude/DeepSeek
```
→
```tsx
          <span className="text-[var(--color-text)]">AI&apos;s role:</span> independent agents (a DeepSeek
```
(Leaves "a DeepSeek reasoner and an ARIMA baseline" — the next line is unchanged.)

- [ ] **Step 8: Extend `inferKind` matchers — `frontend/src/lib/indexer.ts`**

```ts
  if (n.includes("claude") || n.includes("haiku") || n.includes("opus")) return "CLAUDE";
```
→
```ts
  if (n.includes("deepseek") || n.includes("reasoner") || n.includes("claude") || n.includes("haiku") || n.includes("opus")) return "CLAUDE";
```
(Keep the `claude`/`haiku`/`opus` matchers for on-chain back-compat with any historical name; add `deepseek`/`reasoner`.)

- [ ] **Step 9: Extend `inferKind` matchers — `frontend/src/lib/snapshot.ts`**

```ts
  if (n.includes("claude") || n.includes("haiku") || n.includes("opus") || n.includes("reasoner")) return "CLAUDE";
```
→
```ts
  if (n.includes("deepseek") || n.includes("claude") || n.includes("haiku") || n.includes("opus") || n.includes("reasoner")) return "CLAUDE";
```

- [ ] **Step 10: Typecheck (defer lint/test/build to Task 3 after the json regen)**

Run:
```bash
pnpm --filter frontend exec tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 11: Commit**

```bash
git add frontend/src
git commit -m "feat(web): rebrand reasoner display Claude→DeepSeek (names, badges, glyph DS, inferKind)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Regenerate `fallback-leaderboard.json` + frontend verification gate

The cached display tier is mock-derived when no indexer env is set, so regenerating it after the `mockData.ts` edit propagates the new names automatically. Do **not** hand-apply the stash's json (origin shrank it ~184 lines; re-applying would bloat it).

**Files:**
- Regenerate: `frontend/public/fallback-leaderboard.json`

- [ ] **Step 1: Regenerate from mock-derived source**

Run (no `INDEXER_URL` env → mock-derived, which is what we want):
```bash
pnpm --filter frontend gen:fallback
```
Expected: writes `frontend/public/fallback-leaderboard.json`, source = mock.

- [ ] **Step 2: Verify the names propagated and no product "claude" remains in display strings**

Run:
```bash
grep -niE "claude-reasoner|claude-haiku|claude reasoner" frontend/public/fallback-leaderboard.json
```
Expected: **no matches**. (The `"kind": "CLAUDE"` enum values WILL still be present — that is the intentional non-goal; verify they are enum values only, e.g. `grep -c '"kind": "CLAUDE"'` is non-zero and acceptable.)

If the gen script fails because the dev `.env` points at a dead indexer URL, instead hand-edit the four agent `name` fields in the json (`deepseek-reasoner-α/β/γ`, `deepseek-chat-fast`) and leave `"kind": "CLAUDE"` untouched.

- [ ] **Step 3: Full frontend verification gate**

Run in order:
```bash
pnpm --filter frontend exec tsc --noEmit
pnpm --filter frontend lint
pnpm --filter frontend test
pnpm --filter frontend build
```
Expected: tsc exit 0; lint 0 errors/0 warnings; tests all pass; build green (all routes, only the known benign Recharts SSR width/height warning).

- [ ] **Step 4: Commit**

```bash
git add frontend/public/fallback-leaderboard.json
git commit -m "chore(web): regenerate fallback-leaderboard with DeepSeek agent names

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: README rebrand (reasoner refs only — NOT track text)

Swap the 4 reasoner-product references. Leave all track/submission positioning wording exactly as the merged tree has it (out of scope).

**Files:**
- Modify: `README.md` (lines ~19, ~37, ~84, ~133)

- [ ] **Step 1: Mermaid node — declaration (line ~19)**

```
      CLAUDE["claude-reasoner agent"]
```
→
```
      DEEPSEEK["deepseek-reasoner agent"]
```

- [ ] **Step 2: Mermaid node — edge (line ~37)**

```
    ARIMA & CLAUDE -->|commit/reveal via SDK| PM
```
→
```
    ARIMA & DEEPSEEK -->|commit/reveal via SDK| PM
```
(Both the node id `CLAUDE` and its use must change together so the mermaid graph stays valid.)

- [ ] **Step 3: Quick-start run command (line ~84)**

```
cd agents/claude-reasoner  && pnpm register && pnpm start
```
→
```
cd agents/deepseek-reasoner && pnpm register && pnpm start
```

- [ ] **Step 4: Repo layout line (line ~133)**

```
agents/      sdk, arima-baseline, claude-reasoner, refresher
```
→
```
agents/      sdk, arima-baseline, deepseek-reasoner, refresher
```

- [ ] **Step 5: Verify no reasoner-product "claude" remains in README**

Run:
```bash
grep -niE "claude-reasoner|claude reasoner|CLAUDE\[|& CLAUDE" README.md
```
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs(readme): rebrand reasoner refs Claude→DeepSeek (mermaid + paths)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: PRD + PREFLIGHT + Prompt rebrand (spec-truth, product refs only)

Rewrite reasoner-product references and align provider/model/key to reality (OpenRouter, `deepseek/deepseek-chat-v3.1`, `OPENROUTER_API_KEY`). Read each occurrence in context; preserve any Claude-Code/harness reference.

**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/PREFLIGHT.md`
- Modify: `Prompt.md`

- [ ] **Step 1: `docs/PRD.md` — apply each edit**

| Line | Old | New |
|------|-----|-----|
| ~36 | `Few-shot examples for Claude reasoner spec'd as Day-9 deliverable (§8.3)` | `Few-shot examples for DeepSeek reasoner spec'd as Day-9 deliverable (§8.3)` |
| ~200 | `Claude reasoner (highlight)` | `DeepSeek reasoner (highlight)` |
| ~540 | `"name": "Claude Reasoner",` | `"name": "DeepSeek Reasoner",` |
| ~542 | `"model": "claude-opus-4-7",` | `"model": "deepseek/deepseek-chat-v3.1",` |
| ~562 | `### 8.3 Reference agent 2 — Claude reasoner (DEMO HIGHLIGHT)` | `### 8.3 Reference agent 2 — DeepSeek reasoner (DEMO HIGHLIGHT)` |
| ~568 | `2. Send to Claude (claude-opus-4-7 or claude-sonnet-4-5).` | `2. Send to the model via OpenRouter (deepseek/deepseek-chat-v3.1).` |
| ~575 | `...in \`agents/claude-reasoner/fewshot/*.json\`...` | `...in \`agents/deepseek-reasoner/fewshot/*.json\`...` (only the path token changes) |
| ~612 | `**For Claude reasoner: expandable rows with full reasoning from IPFS.**` | `**For the DeepSeek reasoner: expandable rows with full reasoning from IPFS.**` |
| ~695 | `...ARIMA running. Claude reasoner running...` | `...ARIMA running. DeepSeek reasoner running...` |
| ~791 | `│   ├── claude-reasoner/` | `│   ├── deepseek-reasoner/` |

- [ ] **Step 2: `docs/PREFLIGHT.md` — line ~15**

```
| 2 | 2 reference agents running live | 🟡 | ARIMA + Claude reasoner built + typecheck clean; need deploy + funded controller keys + `OPENROUTER_API_KEY`. |
```
→ replace `Claude reasoner` with `DeepSeek reasoner` (rest of the row unchanged — `OPENROUTER_API_KEY` already correct).

- [ ] **Step 3: `Prompt.md` — apply each edit**

| Line | Old | New |
|------|-----|-----|
| ~49 | `Two sub-packages under agents/: arima-baseline/, claude-reasoner/` | `Two sub-packages under agents/: arima-baseline/, deepseek-reasoner/` |
| ~634 | `## Prompt 10 — Claude reasoner agent (THE DEMO HIGHLIGHT)` | `## Prompt 10 — DeepSeek reasoner agent (THE DEMO HIGHLIGHT)` |
| ~637 | `Build the Claude reasoner per §8.3 of README.md...` | `Build the DeepSeek reasoner per §8.3 of docs/PRD.md...` |
| ~639 | `Part A — agents/claude-reasoner/:` | `Part A — agents/deepseek-reasoner/:` |
| ~641 | `- Uses @anthropic-ai/sdk` | `- Calls OpenRouter (OpenAI-compatible Chat Completions) via fetch — no LLM SDK dependency` |
| ~647 | `2. Build prompt (use claude-opus-4-7 or claude-sonnet-4-5):` | `2. Build prompt (use deepseek/deepseek-chat-v3.1 via OpenRouter):` |
| ~658 | `- Few-shot examples live in agents/claude-reasoner/fewshot/*.json...` | `- Few-shot examples live in agents/deepseek-reasoner/fewshot/*.json...` (only path token) |
| ~665 | `- name: "Claude Reasoner"` | `- name: "DeepSeek Reasoner"` |
| ~667 | `- model: "claude-opus-4-7"` | `- model: "deepseek/deepseek-chat-v3.1"` |
| ~706 | `- For Claude reasoner: rows are expandable...` | `- For the DeepSeek reasoner: rows are expandable...` |

- [ ] **Step 4: Verify**

Run:
```bash
grep -niE "claude-reasoner|claude reasoner|claude-opus|claude-haiku|claude-sonnet|@anthropic-ai/sdk|Claude Reasoner" docs/PRD.md docs/PREFLIGHT.md Prompt.md
```
Expected: no matches. (Any remaining "Claude Code" / harness mention is fine and should be left.)

- [ ] **Step 5: Commit**

```bash
git add docs/PRD.md docs/PREFLIGHT.md Prompt.md
git commit -m "docs(spec): rebrand reasoner Claude→DeepSeek in PRD/PREFLIGHT/Prompt + align provider/model/key

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: masterdoc/* rebrand (spec-truth, product refs only)

Rewrite reasoner-product references and correct factual errors (the agent has **no `@anthropic-ai/sdk` dependency** — it calls OpenRouter via raw `fetch`; real deps are `@predictor-index/sdk`, `viem`, `dotenv`). Preserve Claude-Code/harness references.

**Files:**
- Modify: `masterdoc/00-overview.md`, `01-architecture.md`, `02-monorepo.md`, `04-frontend.md`, `06-agents.md`, `07-conventions.md`, `08-environment.md`, `09-build-status.md`, `INDEX.md`

- [ ] **Step 1: `00-overview.md:26`**

```
└── agents/                    sdk, arima-baseline, claude-reasoner, refresher
```
→ replace `claude-reasoner` with `deepseek-reasoner`.

- [ ] **Step 2: `01-architecture.md`**

Line ~25: `  claude-reasoner  (demo highlight)` → `  deepseek-reasoner  (demo highlight)`
Line ~64:
```
- **agents/claude-reasoner:** Build market context → call Claude → parse JSON forecast → store full reasoning to IPFS → submitFullCycle. Demo highlight.
```
→
```
- **agents/deepseek-reasoner:** Build market context → call DeepSeek (via OpenRouter) → parse JSON forecast → store full reasoning to IPFS → submitFullCycle. Demo highlight.
```

- [ ] **Step 3: `02-monorepo.md`**

Line ~19: `  - "agents/claude-reasoner"` → `  - "agents/deepseek-reasoner"`
Line ~89: `    ├── claude-reasoner/` → `    ├── deepseek-reasoner/`
Line ~90:
```
    │   ├── package.json       deps: @predictor-index/sdk, @anthropic-ai/sdk
```
→
```
    │   ├── package.json       deps: @predictor-index/sdk, viem, dotenv (OpenRouter via fetch — no LLM SDK)
```
Line ~105: `- \`agents/claude-reasoner\`` → `- \`agents/deepseek-reasoner\``
Line ~122: `| \`pnpm -C agents/claude-reasoner dev\` | \`tsx watch src/index.ts\`. |` → replace `claude-reasoner` with `deepseek-reasoner`.

- [ ] **Step 4: `04-frontend.md:86`**

```
- ❌ Don't import server-only libs (e.g. anthropic SDK) into client components.
```
→
```
- ❌ Don't import server-only libs / secrets (e.g. OPENROUTER_API_KEY) into client components.
```

- [ ] **Step 5: `06-agents.md`**

Line ~57: `## agents/claude-reasoner` → `## agents/deepseek-reasoner`
Line ~65: `2. Call Claude (\`claude-opus-4-7\` or \`claude-sonnet-4-6\`).` → `2. Call DeepSeek via OpenRouter (\`deepseek/deepseek-chat-v3.1\`).`
Line ~74: `...\`agents/claude-reasoner/fewshot/*.json\`...` → replace path token with `agents/deepseek-reasoner/fewshot/*.json`.
Line ~76:
```
**Current state:** placeholder + empty `fewshot/`. deps: `@predictor-index/sdk`, `@anthropic-ai/sdk`, `viem`, `dotenv`.
```
→
```
**Current state:** built + few-shot examples present. deps: `@predictor-index/sdk`, `viem`, `dotenv` (OpenRouter via fetch — no LLM SDK).
```
Line ~97: `pnpm -C agents/arima-baseline register   # or claude-reasoner` → replace `claude-reasoner` with `deepseek-reasoner`.
Line ~114: `ANTHROPIC_API_KEY=              claude-reasoner only` → `OPENROUTER_API_KEY=             deepseek-reasoner only`
Line ~115: `CRYPTOPANIC_API_KEY=            claude-reasoner only (optional)` → replace `claude-reasoner` with `deepseek-reasoner`.

- [ ] **Step 6: `07-conventions.md`**

Line ~14: `| Folders | \`kebab-case\` (\`arima-baseline\`, \`claude-reasoner\`) |` → replace `claude-reasoner` with `deepseek-reasoner`.
Line ~65: `- Server-only deps (e.g. \`@anthropic-ai/sdk\`) must NEVER be imported into client components.` → `- Server-only secrets (e.g. \`OPENROUTER_API_KEY\`) must NEVER be imported into client components.`

- [ ] **Step 7: `08-environment.md`**

Line ~48: `ANTHROPIC_API_KEY=` → `OPENROUTER_API_KEY=`
Line ~83: `- \`ANTHROPIC_API_KEY\` (claude-reasoner only)` → `- \`OPENROUTER_API_KEY\` (deepseek-reasoner only)`
Line ~84: `- \`CRYPTOPANIC_API_KEY\` (claude-reasoner only, optional)` → replace `claude-reasoner` with `deepseek-reasoner`.

- [ ] **Step 8: `09-build-status.md`**

Line ~100: `- Next: consumed by Prompt 10 (Claude reasoner) + Prompt 11 (refresher).` → replace `Claude reasoner` with `DeepSeek reasoner`.
Line ~110: `### agents/claude-reasoner (Prompt 10 — demo highlight)` → replace `claude-reasoner` with `deepseek-reasoner`.
Line ~112: replace `Anthropic \`messages.create\`` with `OpenRouter \`chat/completions\``.
Line ~115: `Default model \`claude-opus-4-7\` (CLAUDE_MODEL override).` → `Default model \`deepseek/deepseek-chat-v3.1\` (OPENROUTER_MODEL override).`
Line ~116: replace `ANTHROPIC_API_KEY` with `OPENROUTER_API_KEY` and `Anthropic call path unexercised` with `OpenRouter call path` (keep the rest of the historical note).
Line ~138: `| \`tsc\` agents/claude-reasoner ...` → replace `claude-reasoner` with `deepseek-reasoner`.
Line ~139: `| claude-reasoner few-shot load (3+3) | ✓ |` → replace `claude-reasoner` with `deepseek-reasoner`.
Line ~175: `| 5 | Claude reasoner produces bland predictions in cold-start | ...` → replace `Claude reasoner` with `DeepSeek reasoner`.

- [ ] **Step 9: `INDEX.md:17`**

```
| 06 | [agents.md](./06-agents.md) | SDK + ARIMA + Claude reasoner + refresher |
```
→ replace `Claude reasoner` with `DeepSeek reasoner`.

- [ ] **Step 10: Verify masterdoc is clean of product refs**

Run:
```bash
grep -rniE "claude-reasoner|claude reasoner|claude-opus|claude-sonnet|@anthropic-ai/sdk|ANTHROPIC_API_KEY|CLAUDE_MODEL" masterdoc/
```
Expected: no matches.

- [ ] **Step 11: Commit**

```bash
git add masterdoc/
git commit -m "docs(masterdoc): rebrand reasoner Claude→DeepSeek + correct deps (OpenRouter via fetch, no anthropic SDK)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: New CLAUDE.md session entry (append-only)

Document the rebrand without rewriting any prior dated entry.

**Files:**
- Modify: `CLAUDE.md` (insert a new dated entry at the TOP of §6 Session history, directly under the `## 6. Session history` heading and above the most recent entry)

- [ ] **Step 1: Insert the new session entry**

Add this block as the first entry under `## 6. Session history` (do not edit any existing entry):

```markdown
### 2026-06-03 (later) — Claude→DeepSeek reasoner rebrand (display + spec + pkg rename, merged tree)
**Type:** Refactor + docs. Spec: `docs/superpowers/specs/2026-06-03-claude-deepseek-rebrand-design.md` (approved; post-merge update `ccfd314`). Plan: `docs/superpowers/plans/2026-06-03-claude-deepseek-rebrand.md`.

**Why:** the reference reasoner has run **`deepseek/deepseek-chat-v3.1` via OpenRouter since 2026-05-30** and its on-chain identity is already "DeepSeek Reasoner", but the frontend display, cached fallback, agent package, and living-spec docs still said "Claude". For a verifiable-honesty protocol, displaying a Claude brand while running DeepSeek is a credibility risk. This session aligned the *naming* to reality — **no model/agent change, no re-deploy.**

**What changed:**
- **Agent pkg renamed** `agents/claude-reasoner` → `agents/deepseek-reasoner` (`@predictor-index/deepseek-reasoner`); workspace + lockfile updated; no source imported the old name. Fixed `register.ts` stale default model `deepseek-v4-flash` → `deepseek-chat-v3.1` (the broken reasoning-model default). Aligned IPFS provenance literal + 2 source comments.
- **Frontend display** (6 files): agent names/badges/descriptions, glyph `CL→DS`, insights caption, `inferKind` +`deepseek`/`reasoner` matchers. Regenerated `fallback-leaderboard.json` (mock-derived).
- **Living-spec docs**: README (mermaid + paths), PRD/PREFLIGHT/Prompt, masterdoc/* — rebranded reasoner refs + corrected provider/model/key to OpenRouter/DeepSeek. **Corrected a factual error:** the agent has no `@anthropic-ai/sdk` dep (calls OpenRouter via raw `fetch`).

**Decisions:**
- **Stash dropped, not applied.** The prior partial attempt was a stale `git stash` (3 conflicts after origin's 16-commit merge; origin had shrunk `fallback-leaderboard.json` ~184 lines). Reproduced fresh on the merged tree instead of conflict surgery.
- **Internal `AgentKind` enum `"CLAUDE"` kept** (not user-visible; renaming touches the type union + every consumer for zero judge-facing benefit). `inferKind` keeps the `claude`/`haiku`/`opus` matchers for on-chain back-compat.
- **README track/submission text left as-is** — the stash had bundled an AI-x-RWA→Alpha&Data reposition; that is a separate concern, deliberately excluded.
- **Append-only history preserved** — prior dated entries, specs, plans, RESUME docs untouched.

**Verification:** frontend `tsc`/lint/test/build green; `deepseek-reasoner` pkg typechecks; `pnpm install` clean (0 `claude-reasoner` refs in lockfile); repo-wide final sweep confirms remaining "claude" hits are only Claude-Code/harness, the internal `CLAUDE` enum/matcher, or append-only history.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): session entry — Claude→DeepSeek reasoner rebrand

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Final verification gate + drop the stale stash

**Files:** none (verification + stash cleanup only)

- [ ] **Step 1: Repo-wide final sweep**

Run:
```bash
grep -rniE "claude|haiku|opus|anthropic" \
  --include=*.ts --include=*.tsx --include=*.json --include=*.md --include=*.yaml \
  -l . | grep -vE "node_modules|/dist/|pnpm-lock|docs/superpowers/(specs|plans)|RESUME-" 
```
Then inspect each remaining hit and confirm it is one of: **(a)** a Claude-Code/harness reference (e.g. `CLAUDE.md` filename, `.claude/`, session-log author voice, "fed to Claude Code"), **(b)** the internal `CLAUDE` `AgentKind` enum / `inferKind` matcher, or **(c)** untouched append-only history. Expected: **zero stray reasoner-product "Claude" references.** Note: `dist/` JS still contains old strings until rebuilt — that is build output, not source; ignore (or rebuild the agent with `pnpm --filter @predictor-index/deepseek-reasoner build`).

- [ ] **Step 2: Re-run the frontend gate once more (post all edits)**

```bash
pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend lint && pnpm --filter frontend test && pnpm --filter frontend build
```
Expected: all green.

- [ ] **Step 3: Confirm git tree is clean and all rebrand commits are present**

```bash
git status --short
git log --oneline -8
```
Expected: clean working tree (aside from the pre-existing untracked `docs/superpowers/RESUME-2026-06-02.md`); the 7 rebrand commits present.

- [ ] **Step 4: Drop the now-obsolete stash**

Only after the fresh rebrand is fully committed and verified:
```bash
git stash list
git stash drop stash@{0}
```
Expected: `stash@{0}` ("session: claude->deepseek rebrand + README (2026-06-03)") removed. Its content has been fully reproduced fresh.

---

## Self-Review notes (for the executor)

- **Spec coverage:** Tier 1 item 1 (frontend) → Task 2; item 2 (fallback json) → Task 3; item 3 (pkg rename) → Task 1; item 4 (register.ts fix) → Task 1 Step 4; item 5 (env vars) → already correct, no task needed (noted in spec post-merge update). Tier 2 (README/PRD/PREFLIGHT/Prompt/masterdoc) → Tasks 4/5/6. Tier 2b (new CLAUDE.md entry) → Task 7. Verification gate (§5) → Tasks 3 + 8.
- **Non-goals honored:** `AgentKind` enum `"CLAUDE"` untouched (Tasks 2/3 explicitly keep it); append-only history untouched (Task 7 inserts, never edits prior entries); no re-deploy.
- **Ordering:** Task 1 renames the folder first so all later references point to `agents/deepseek-reasoner`. Frontend (2) before json regen (3) so the regen picks up new names. Docs after code.
