# Level 4 Rebuild — Progress

Status as of 2026-08-06, branch `level-4-restructure`. Not committed — this file is a working note for whoever (human or Claude) picks this up next.

## Done

**Phase 0 — Inventory & safety**
- Confirmed starting branch was `main` (clean tree); created `level-4-restructure` before any changes.
- Read and mapped the full Level 3 codebase against the PRESERVE list (Buffer polyfill order, bound `window.fetch`, `hintUsage` fallback, `setNetworkId` init, `dapp-connector-api@4.0.1` `ConnectedAPI` shape, error surfacing, Compact/Docker/Node requirements).
- Found one contradiction: the PRESERVE list said "Preprod, not Preview," but the actual Level 3 code deliberately targets **Preview** (code comment: Preprod's indexer was lagging as of 2026-07-23) and the live deployed contract is on Preview. Flagged to the user; decided to keep Preview for now (see Open Threads below).

**Phase 1 — Restructure into `contract/` + `frontend/`**
- Moved every file with `git mv` (history preserved) into the target layout:
  - `contract/`: `src/anonymous-whispers.compact`, `managed/`, `scripts/` (deploy, cli, setup, network, wallet, wallet-state, check-balance, e2e-check, sync-zk-assets), `test/`, `package.json`, `tsconfig.json`, `docker-compose.yml`.
  - `frontend/`: `src/` (components, pages, lib, App.tsx, main.tsx, polyfills.ts), `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vercel.json`.
- Split the single root `package.json`/lockfile into two, dependencies assigned by actual per-file import analysis (not guessed).
- Added `@contract` alias (`frontend/vite.config.ts` `resolve.alias` + `frontend/tsconfig.json` `paths`) → `../contract/managed`, and repointed the compiled-artifact import in `frontend/src/lib/contract.ts`.
- Fixed every path broken by the move (`sync-zk-assets.mjs` now writes into the sibling `frontend/public/zk/`; test files' `path.resolve` calls updated).
- `contract/test/level-3.test.ts` deliberately still imports crypto logic from `frontend/src/lib/crypto.ts` (documented inline) rather than duplicating it — Node resolves `tweetnacl` from `frontend/node_modules` since that's where the imported file lives.
- Updated `.gitignore` comments/patterns for the new paths.
- Verified: `frontend` — `tsc --noEmit` clean, `vite build` succeeds. `contract` — `vitest run` → 16/16 tests pass (4 circuit + 12 Level 3, including the crypto round-trip crossing into `frontend/`).

**Phase 2 — Design tokens + motion foundation**
- Installed `lenis`, `gsap`, `framer-motion` in `frontend/`.
- Added `frontend/src/styles/tokens.css`: the monochrome two-world palette (`--ink`/`--paper`, `--hair`, `--signal`), Readex Pro (300–700) + IBM Plex Mono via Google Fonts, `.hero-title`, and global `body`/`html`/`#root` reset.
- Added `frontend/src/hooks/useLenis.ts`: smooth-scroll hook for the landing page only, skips initializing entirely under `prefers-reduced-motion`, not wired into `/report` or `/inbox` on purpose.
- Wired `tokens.css` into `main.tsx` after `index.css`.
- Verified: `tsc --noEmit` clean, `vite build` succeeds.
- Transitional note: the new global body font/color now applies app-wide, including to the not-yet-re-skinned `/report` and `/inbox` — expected until Phase 4.

## Next

**Phase 3 — Immersive landing page (`/`)**
Hero (pill navbar, staggered headline, anonymous-figure background + grain fallback, truthful stat blocks), statement band, the two-world dark→light scroll morph (GSAP ScrollTrigger, the signature privacy-model visualization), how-it-works, the two doors into `/report` and `/inbox`, tech strip + footer with placeholder logo.

## Open threads

1. **`npm run compile` not yet verified from scratch.** The `compact` CLI isn't installed in this sandbox, so Phase 1's contract move was validated against the already-committed `contract/managed/` artifacts (tests pass against them) but a real compile was never run post-move. Needs a Linux machine with the Compact toolchain to confirm `contract/src/anonymous-whispers.compact` still compiles cleanly into `contract/managed/` from its new path.
2. **Preprod-vs-Preview is parked, not resolved.** Currently left on Preview (matches what's actually deployed). Revisit at the deploy/docs phase: either the README documents Preview as the real target with the honest reason (Preprod indexer lag), or a fresh Preprod deploy happens and the contract address/network config gets updated together.
3. **Hero asset.** Plan is to self-generate a monochrome anonymous "finger to lips" image/video and drop it in as `frontend/public/hero/figure.mp4` + `figure-poster.jpg`. If that doesn't happen before Phase 3, Phase 3 ships with the authored grain/noise + vignette + silhouette fallback instead — never a blank hero.

## Environment note

Contract compile and deploy are **Linux-only** (no Compact compiler binary for Windows). A Windows machine can do all of Phase 3's frontend work (landing page, motion, styling) but cannot run `contract` package scripts (`compile`, `deploy`, `cli`, `setup`, `test:e2e`) or verify open thread #1 above.
