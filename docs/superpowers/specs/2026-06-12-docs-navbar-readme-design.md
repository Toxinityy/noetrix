# Docs navbar link + README run instructions — design

**Date:** 2026-06-12
**Status:** Approved (user, via brainstorming)
**Scope:** Frontend nav (2 files) + root README. No contract/agent/indexer changes.

## Goal

1. Add a "Docs" link to both navbars pointing to the GitBook: `https://noetrix.gitbook.io/product-docs/`.
2. Make the root README tell judges/builders how to run the repo, leading with a zero-setup path.

## Part 1 — Docs link in both navbars

**Approach (chosen): `external` flag on nav item data, shared by all render sites.** Rejected alternative: hardcoded standalone `<a>` per render site (3 copies, drift risk).

### `frontend/src/components/app/AppHeader.tsx` (terminal nav)

- Add to `moreNav`, after "About": `{ href: "https://noetrix.gitbook.io/product-docs/", label: "Docs", external: true }`.
- Both render sites that map nav items (More dropdown, mobile menu via `allNav`) check `item.external`:
  - external → plain `<a href target="_blank" rel="noopener noreferrer">` (not Next `<Link>`), same classes as siblings, plus a 13px lucide `ExternalLink` icon (`aria-hidden`) after the label.
  - internal → unchanged `<Link>`.
- `isActiveNavItem` must never mark an external item active (it can't match `pathname` anyway, but `moreActive` computation should be safe — `startsWith` on an `https://` href never matches a pathname, so no code change needed; verify only).

### `frontend/src/components/landing/Nav.tsx` (landing nav)

- Add `["Docs", "https://noetrix.gitbook.io/product-docs/"]` to the link array, between "FAQ" and "For builders".
- The map renders plain `<a>`s already; when `href` starts with `http`, add `target="_blank" rel="noopener noreferrer"` + the same `ExternalLink` icon.

### Styling / placement rationale

- Label "Docs" (not "Documentation") — nav is 11px mono uppercase wide-tracking; long labels crowd it.
- Terminal placement: More dropdown (utility tier) — does not displace the 5 pitch-priority primary items.
- Icon signals leaves-site; matches existing lucide usage (ChevronDown, Menu).

## Part 2 — README run instructions

Surgical edits to the existing Quick start; no restructure.

1. **"Run it in 60 seconds" block** at the top of Quick start:
   - Zero-effort: live app at https://noetrix.vercel.app (nothing to install).
   - Judge path: `pnpm install` → `cd frontend && pnpm dev` → http://localhost:3000 on demo/snapshot data — no env, no chain, no keys.
2. **Agents block fixes:** add `naive-baseline`, `resolver` (note: delete `agents/resolver/resolver.state.json` after any redeploy), `swarm-runner`. Note run order: forecaster agents → resolver → refresher.
3. **Frontend test commands:** `pnpm --filter frontend test` (vitest) + `pnpm --filter frontend test:e2e` (Playwright).
4. **GitBook link:** one-liner near the top (after the intro paragraphs) + entry in Live links section.

## Error handling

None beyond standard external-link attrs (`rel="noopener noreferrer"` prevents tab-napping).

## Testing / verification

- `pnpm --filter frontend lint` — 0 errors/warnings.
- `npx tsc --noEmit` (frontend) — 0.
- `pnpm --filter frontend test` — vitest suite green (55).
- `pnpm --filter frontend test:e2e` — 9/9 (no e2e asserts nav item counts; verify by grep before assuming).
- README: markdown renders; commands match real package scripts (`register`, `start`, `dev`, `test`, `test:e2e`).
