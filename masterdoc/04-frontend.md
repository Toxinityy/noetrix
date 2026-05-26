# 04 — Frontend

## Stack (PRD §9.1 v2.2)

- **Next.js 16.2.6** (App Router, RSC). ⚠ **Next 16 has breaking changes** — read `node_modules/next/dist/docs/` before writing code. See `frontend/AGENTS.md`.
- **TypeScript 5**, strict.
- **Tailwind CSS v4** (`@tailwindcss/postcss`). New v4 config conventions — no `tailwind.config.ts` required if using CSS-only config.
- **Radix UI** (headless primitives, used directly — no shadcn CLI):
  - `@radix-ui/react-dialog`, `react-dropdown-menu`, `react-tabs`, `react-tooltip`, `react-popover`, `react-slot`, `react-toast`, `react-accordion`.
- **Motion v12** (formerly Framer Motion) — animation layer.
- **wagmi 3.6.15 + viem 2.51** — on-chain reads/writes.
- **@tanstack/react-query 5** — server-state cache (indexer reads, 30s refresh).
- **Recharts 3.8** — equity curve, radar chart (themed to design).
- **lucide-react** — icons (NO emoji as icons).
- **clsx + tailwind-merge + class-variance-authority** — class composition.
- **next/font** — Inter (UI) + JetBrains Mono (numbers/addresses/hashes). No other fonts.

Stack decision rationale: see PRD §9.1 v2.2 changelog + `CLAUDE.md` 2026-05-26 session entry + memory `project_frontend_stack_v22.md`.

## Design system (PRD §9.3 v2.2)

**Hybrid: terminal core + cinematic landing.** Don't mix on same surface.

### Terminal core — `/`, `/agent/[id]`, `/demo-consumer`

- Data-dense, monospace numbers (`font-variant-numeric: tabular-nums`).
- Near-monochrome base (dark theme default); single accent: Mantle teal (#33EAB3 or similar).
- Recharts themed to match: low-contrast gridlines, mono labels, line-only charts (no fills).
- Motion budget: subtle only — value flips (e.g. 1.23 → 1.24 with crossfade), sparkline draws on data update, row enter staggers. No bouncy springs on data.

### Cinematic landing — hero of `/`, optionally `/about`

- Awwwards-tier: oversized kinetic type for "Predictor Index" name.
- Scroll-driven: composite-feed pulse animation responds to scroll progress.
- Claude reasoning-trace reveal: hover/scroll opens the reasoning panel as the demo hook.
- Motion-driven: hero entrance stagger, shared-element transition into leaderboard table below.
- Same teal accent; no rainbow palette.
- **Respects `prefers-reduced-motion`** — cinematic falls back to static composition.

### Cross-cutting

- A11y non-negotiable: 4.5:1 contrast (text); 3:1 (large text + icons); visible focus rings (Radix handles primitives); keyboard nav for all interactive elements.
- **QA at 375px width.** Judges screenshot on mobile.
- Single font pair: Inter + JetBrains Mono.
- Loading states: skeletons, not spinners.
- Empty states for every data-fetching component.

## Page plan (PRD §9.2)

### Must ship by Day 13

| Route | Purpose | Key components |
|-------|---------|---------------|
| `/` | Leaderboard | Hero (cinematic), composite-feed snapshot card per active category, sortable per-category leaderboard table, "How it works" collapsible |
| `/agent/[id]` | Agent detail | Identity NFT card, reputation radar (Recharts), prediction history paginated 20/page, equity curve, **expandable rows showing Claude reasoning from IPFS — visual highlight** |
| `/demo-consumer` | Live feed consumption | `DemoFeedConsumer` last reads, manual `refresh(categoryId)` button per category (fallback if cron down), explanatory panel |

### Ship if Day 13 polish allows

`/category/[id]`, `/submit`, `/about`.

## Data sources

- **Indexer REST API** (Ponder, see `05-indexer.md`) — TanStack Query, 30s `staleTime`.
- **Direct RPC** (Mantle Sepolia) — via wagmi/viem, only for write operations (e.g. `CompositeFeed.refresh` manual button).
- **Static fallback** — `public/fallback-leaderboard.json` pre-fetched at build, used if indexer unreachable.

## Current state (2026-05-26)

- ✓ `create-next-app` ran, default landing page in place.
- ✓ All Radix + Motion + wagmi + Recharts + lucide deps installed.
- ✗ No custom pages written.
- ✗ No design tokens defined.
- ✗ No font configuration.
- ✗ Dark theme not set up.

Next frontend work begins at **Prompt 11**.

## Anti-patterns

- ❌ No emoji as structural icons — always SVG (lucide-react).
- ❌ No `tailwind.config.ts` arbitrary additions; prefer Tailwind v4 CSS-only config or a single small `app/globals.css`.
- ❌ No shadcn CLI (we use Radix directly).
- ❌ Don't animate `width`/`height`/`top`/`left` — use `transform`/`opacity`.
- ❌ Don't ignore `prefers-reduced-motion`.
- ❌ Don't import server-only libs (e.g. anthropic SDK) into client components.
