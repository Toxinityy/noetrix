# 02 — Monorepo Layout

## pnpm workspace

Root `package.json`:
- Name: `predictor-index`
- Private, packageManager: `pnpm@10.33.3`
- Engines: `node >=20`
- Scripts: `build`, `dev`, `test`, `clean` — all delegate via `pnpm -r`.

Root `pnpm-workspace.yaml`:

```yaml
packages:
  - "frontend"
  - "indexer"
  - "agents/sdk"
  - "agents/arima-baseline"
  - "agents/deepseek-reasoner"
  - "agents/refresher"
```

Note: `contracts/` is NOT in pnpm workspace — it's a Foundry-only package. It carries a `package.json` only for `pnpm -r build` ergonomics (runs `forge build`), not for npm-style deps.

## Top-level tree (current)

```
mantle-hackathon/
├── .env.example
├── .gitignore
├── CLAUDE.md                  Session masterdoc
├── INDEX.md (none at root)
├── Prompt.md                  v2.2 build sequence
├── README.md                  v2.2 PRD
├── README.workspace.md        Workspace index (becomes root README at Prompt 13)
├── masterdoc/                 ← this directory
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
│
├── contracts/                 Foundry, NOT in pnpm workspace
│   ├── .env.example
│   ├── foundry.toml
│   ├── remappings.txt
│   ├── package.json           (scripts only)
│   ├── README.md              (forge init default; replace later)
│   ├── config/                Network configs (placeholder)
│   ├── deployments/           Deployment JSON output
│   ├── lib/
│   │   ├── forge-std/         (vendored via forge install)
│   │   └── openzeppelin-contracts/   v5.6.1
│   ├── script/                Foundry deploy/seed scripts
│   ├── src/
│   │   ├── interfaces/        ICategoryResolver, ICategoryScorer (planned)
│   │   ├── resolvers/         MethAprResolver, AaveMantleTvlResolver (planned)
│   │   ├── scorers/           RangeCrpsScorer (planned)
│   │   ├── mocks/             MockMethRateOracle, MockAaveTvlOracle (planned)
│   │   └── examples/          DemoFeedConsumer (planned)
│   └── test/
│       └── reference/         Python reference implementations (CRPS, calibration)
│
├── frontend/                  Next.js 16 + Tailwind 4 + Radix + Motion
│   ├── AGENTS.md              "Next.js you don't know" warning
│   ├── CLAUDE.md              (@AGENTS.md include)
│   ├── package.json
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   ├── tsconfig.json
│   ├── public/
│   └── src/
│       └── app/               App Router default layout + page
│
├── indexer/                   Ponder empty template
│   ├── package.json           ponder, hono, viem
│   ├── ponder.config.ts       (template)
│   └── ponder.schema.ts       (template)
│
└── agents/
    ├── sdk/
    │   ├── package.json       Exports viem-based helpers (planned)
    │   ├── tsconfig.json
    │   └── src/index.ts       Placeholder: exports PREDICTOR_SDK_VERSION
    │
    ├── arima-baseline/
    │   ├── package.json       deps: @predictor-index/sdk, viem, dotenv
    │   ├── tsconfig.json
    │   └── src/index.ts       Placeholder
    │
    ├── deepseek-reasoner/
    │   ├── package.json       deps: @predictor-index/sdk, viem, dotenv (OpenRouter via fetch — no LLM SDK)
    │   ├── tsconfig.json
    │   ├── fewshot/           Hand-written examples (Day-9 deliverable)
    │   └── src/index.ts       Placeholder
    │
    └── refresher/
        ├── package.json       deps: @predictor-index/sdk, viem
        ├── tsconfig.json
        └── src/index.ts       Placeholder
```

## Workspace dependencies

`@predictor-index/sdk` is the only internal workspace package. It's depended on (via `workspace:*`) by:
- `agents/arima-baseline`
- `agents/deepseek-reasoner`
- `agents/refresher`

Frontend and indexer don't currently depend on SDK (they read indexer REST + RPC respectively; no shared TS types yet — open question whether to share ABI types).

## Build entry points

| Command | What it does |
|---------|-------------|
| `pnpm install` (root) | Hydrates all workspace packages, links `@predictor-index/sdk`. |
| `pnpm -C contracts build` | `forge build` (PowerShell may need `$env:PATH += ";$env:USERPROFILE\.foundry\bin"`). |
| `pnpm -C contracts test` | `forge test`. |
| `pnpm -C contracts coverage` | `forge coverage`. |
| `pnpm -C frontend dev` | `next dev` on port 3000. |
| `pnpm -C indexer dev` | `ponder dev` on port 42069. |
| `pnpm -C agents/sdk build` | `tsc -p tsconfig.json`. |
| `pnpm -C agents/arima-baseline dev` | `tsx watch src/index.ts`. |
| `pnpm -C agents/deepseek-reasoner dev` | `tsx watch src/index.ts`. |
| `pnpm -C agents/refresher dev` | `tsx watch src/index.ts`. |

## .gitignore highlights (root)

- `node_modules/`, `.pnpm-store/`
- `.env`, `.env.*.local` (but allow `.env.example`)
- `contracts/out/`, `contracts/cache/`, `contracts/broadcast/`
- `frontend/.next/`, `frontend/out/`, `frontend/.vercel/`
- `indexer/.ponder/`, `indexer/generated/`
- `agents/**/dist/`, `agents/**/agent.state.json`, `agents/**/logs/`
