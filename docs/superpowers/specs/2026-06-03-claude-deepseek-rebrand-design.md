# Design — Claude → DeepSeek reasoner rebrand

**Date:** 2026-06-03
**Status:** Approved (brainstorming)
**Topic:** Align all displayed/spec references to the *actually deployed* reasoner model.

---

## 1. Problem & driver

The live, deployed reference reasoner agent runs **`deepseek/deepseek-chat-v3.1`** via OpenRouter
(model corrected 2026-05-30 — see CLAUDE.md; `deepseek-v4-flash` returns `content:null` and breaks the
JSON parser). Its **on-chain registered identity is already `"DeepSeek Reasoner"`** (`register.ts`).

But the frontend display, the cached fallback data, the agent package name, and the living spec docs all
still call it **"Claude"** (`claude-reasoner-α`, glyph `CL`, "Claude Opus 4.7", etc.). For a protocol whose
entire thesis is **verifiable, on-chain honesty**, displaying a Claude brand while running DeepSeek is a
credibility risk: a judge inspecting the on-chain agent metadata or a reasoning trace's raw IPFS payload
would find DeepSeek, contradicting the UI.

**Goal:** every *displayed* and *living-spec* reference to the reasoner names the real model (DeepSeek),
without rewriting append-only history and without corrupting references to **Claude Code** (the coding
harness that authored these docs).

A working-tree diff partially did this for 8 files (frontend display + glyph + README + `fallback-leaderboard.json`).
**Update 2026-06-03 (post-merge):** that diff is now a **stale `git stash`** — after pulling origin's 16 commits,
re-applying it produces **3 content conflicts** (`fallback-leaderboard.json`, `AgentDetailClient.tsx`,
`LeaderboardClient.tsx`), and origin intentionally shrank `fallback-leaderboard.json` by ~184 lines (re-applying
the stash would bloat it back). **Decision:** the rebrand edits are trivial string swaps → **drop the stash and
redo fresh against the merged tree** per the scope below (cheaper + safer than conflict surgery). Do NOT
`git stash drop` until the fresh rebrand is committed.

**Confirmations against the merged tree (2026-06-03):**
- Pkg rename is **safe** — zero source imports of `@predictor-index/claude-reasoner` (only its own `package.json`
  + append-only history docs).
- Tier 1 item 5 (env vars) is **already done** — `config.ts` + `.env.example` read `OPENROUTER_API_KEY` /
  `OPENROUTER_MODEL` (default `deepseek/deepseek-chat-v3.1`). No change needed there.
- Tier 1 item 4 (correctness fix) is **real**: `agents/claude-reasoner/scripts/register.ts:30` still defaults to
  the broken `deepseek/deepseek-v4-flash` → fix to `deepseek/deepseek-chat-v3.1`.
- Folder rename + README are **coupled**: the README rename of `agents/claude-reasoner → agents/deepseek-reasoner`
  (architecture diagram + repo layout) is only honest if the folder is actually `git mv`'d. Full scope chosen, so
  both happen together.

---

## 2. The disambiguation rule (load-bearing)

"Claude" appears in this repo with **two distinct meanings**. They must be treated differently:

| Meaning | Examples | Action |
|---------|----------|--------|
| **The reasoner agent** (product) | `claude-reasoner-α`, "Claude Opus 4.7" badge, glyph `CL`, pkg `@predictor-index/claude-reasoner`, "Claude-driven reasoning agent" | **Rename → DeepSeek** |
| **Claude Code** (the coding harness / this agent) | "new Claude Code session", "fed to Claude", `CLAUDE.md` filename, session-log author voice, `.claude/` config | **Preserve unchanged** |

Therefore the rebrand is **surgical per-occurrence**, never a mechanical `s/Claude/DeepSeek/`. Any
ambiguous occurrence is read in context before editing.

---

## 3. Scope

### Tier 1 — Code + assets (mechanical, no judgment)

1. **Frontend display (redo fresh on merged tree — stash dropped, 6 files):** `mockData.ts` agent
   names/badges/descriptions, `AgentDetailClient.tsx` glyph `CL→DS` + comment, `LeaderboardClient.tsx`
   `KindGlyph` label `CL→DS`, `InsightsClient.tsx` caption (`a Claude/DeepSeek reasoner` → `a DeepSeek reasoner`),
   `indexer.ts` + `snapshot.ts` `inferKind` add `deepseek`/`reasoner` matchers (keep `claude` matcher for
   on-chain back-compat). *These were the stash content; reproduce them directly — they are the correct target.*
2. **`frontend/public/fallback-leaderboard.json` (8 refs — MISSED by the working-tree diff):** the cached
   display tier, user-visible. **Regenerate** via `pnpm --filter frontend gen:fallback` *after* the
   `mockData.ts` edit (it is mock-derived when no indexer is set, so names propagate automatically). If the
   script env points at a dead indexer, hand-edit the four agent names + leave `kind:"CLAUDE"` (enum, see §4).
3. **Agent package rename** (`agents/claude-reasoner` → `agents/deepseek-reasoner`). **Safe: no source file
   imports `@predictor-index/claude-reasoner`** (verified — only its own `package.json` + history docs
   reference it).
   - `git mv agents/claude-reasoner agents/deepseek-reasoner`
   - `package.json` `name` → `@predictor-index/deepseek-reasoner`
   - `pnpm-workspace.yaml` entry → `agents/deepseek-reasoner`
   - regenerate `pnpm-lock.yaml` (`pnpm install`)
   - 2 source comments ("fed to Claude") → "fed to the reasoner" / "DeepSeek"
   - `index.ts` IPFS provenance literal `agent: "claude-reasoner"` → `"deepseek-reasoner"`
4. **Correctness fix (not branding):** stale default model `deepseek/deepseek-v4-flash` in
   `scripts/register.ts` (and any config default) → `deepseek/deepseek-chat-v3.1`. v4-flash breaks the
   parser per CLAUDE.md; the live `.env` already overrides, but the committed default should be correct.
5. Check the agent pkg `.env.example` / `config.ts` var names: ensure provider/model vars read OpenRouter
   (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`), not stale `ANTHROPIC_API_KEY`/`CLAUDE_MODEL`. Align if stale.

### Tier 2 — Living-spec docs (surgical, product-refs only)

Rewrite **reasoner-product** references → DeepSeek in: `README.md`, `docs/PRD.md`, `docs/PREFLIGHT.md`,
`Prompt.md`, `masterdoc/*`. This is a **spec-truth update, not just a token swap** — where a doc describes
the reasoner's provider/model/keys, align to reality:
- provider: Anthropic API → **OpenRouter**
- model: `claude-opus-4-7` / Haiku → **`deepseek/deepseek-chat-v3.1`**
- key: `ANTHROPIC_API_KEY` → **`OPENROUTER_API_KEY`** (where the ref is about the reasoner)

**Preserve** every Claude-Code/harness reference per §2.

### Tier 2b — History (append-only, NOT rewritten)

Leave untouched: past dated `CLAUDE.md` session entries, `docs/superpowers/specs/*`,
`docs/superpowers/plans/*`, `docs/superpowers/RESUME-*`. They record what was true when written. Instead,
**add ONE new dated `CLAUDE.md` session entry** documenting: the rebrand, the new pkg path
`agents/deepseek-reasoner`, the fallback-json regen, and a pointer that "the reasoner has always run DeepSeek
since 2026-05-30; this session aligned the display/spec naming."

---

## 4. Non-goals (explicit)

- **Do NOT rename the internal `AgentKind` enum value `"CLAUDE"`** or the `kind === "CLAUDE"` gating checks
  or the `KindGlyph`/`kindShort` map keys. It is internal, not user-visible, and renaming it touches the
  type union + every consumer for zero judge-facing benefit. The `inferKind` "claude" fallback matcher stays
  (back-compat for any historical on-chain name). *(Optional future: neutralize enum to `REASONER`.)*
- **Do NOT rewrite append-only history** (§2b).
- **Do NOT switch the live agent to a Claude model.** The deployed reality is DeepSeek; we align to it.
- No re-deploy / re-registration of contracts or agents (on-chain identity is already "DeepSeek Reasoner").

---

## 5. Verification gate

Run from repo root after each tier:
- Frontend: `pnpm --filter frontend exec tsc --noEmit` → `pnpm --filter frontend lint` →
  `pnpm --filter frontend test` → `pnpm --filter frontend build`.
- Agent pkg (post-rename): `pnpm --filter @predictor-index/deepseek-reasoner exec tsc --noEmit` (confirm
  build still resolves under the new name).
- Workspace: `pnpm install` clean (lockfile updated, no dangling `claude-reasoner` workspace ref).
- **Final sweep:** `grep -ri "claude\|haiku\|opus\|anthropic"` repo-wide → confirm every remaining hit is
  either (a) a Claude-Code/harness reference, (b) the internal `CLAUDE` enum / `inferKind` matcher, or
  (c) untouched append-only history. Zero stray product-reasoner "Claude" refs.

---

## 6. Risks

- **Mechanical-replace temptation:** the single biggest risk is a blind find/replace corrupting Claude-Code
  references. Mitigation: §2 disambiguation rule + the final-sweep verification reads each remaining hit.
- **Lockfile / workspace churn from the pkg rename:** mitigated by verifying `pnpm install` resolves and the
  pkg typechecks under the new name before committing.
- **fallback json regen needs the gen script to run** (or a hand-edit); if the dev `.env` indexer URL is dead
  the script falls back to mock-derived, which is what we want — names come from the edited `mockData.ts`.
- The `kind:"CLAUDE"` enum staying means an attentive code-reader sees "CLAUDE" internally; acceptable and
  documented as a deliberate non-goal.
