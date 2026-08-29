# Level 4 SDK Extraction — Progress

Status as of 2026-08-07, branch `level-4-restructure`. Not committed — this file is a working note for whoever (human or Claude) picks this up next, especially across the Linux→Windows machine switch.

## 2026-08-29 — Aliit Builder rejection fix (in-circuit privacy)

Reviewer's rejection (paraphrased): the private input `report_content` was
declared but never used in the circuit body; the disclosed values were all
caller-supplied, so the ZK proof did not attest to anything about the private
witness. Confidentiality came entirely from off-chain nacl.box encryption
rather than from any Midnight in-circuit constraint.

Fix (surgical, only the contract and its immediate callers touched):

- `submit_report(report_content: Bytes<256>)` — signature simplified. The
  circuit now computes `const content_hash = persistentHash<Bytes<256>>(report_content);`
  in-circuit and discloses only that hash into `latest_report_hash`. The
  private witness deterministically constrains a public output, so the ZK
  proof binds the caller to a specific preimage.
- `submit_encrypted_report(ciphertext: Bytes<512>, plaintext: Bytes<256>)` —
  the caller-supplied `ciphertext_hash` argument was replaced with a private
  `plaintext` witness. The circuit computes
  `persistentHash<Bytes<256>>(plaintext)` in-circuit and discloses that as
  `latest_report_hash`. Ciphertext remains publicly disclosed (that is the
  delivery channel); the commitment on-chain is now bound to knowledge of
  the plaintext rather than a value the caller could fabricate.
- `persistentHash` is Compact's SHA-256-based standard-library compression
  function (`circuit persistentHash<T>(value: T): Bytes<32>`). Same guarantee
  the reviewer named ("SHA-256 preimage binding"), correct Compact spelling.
- Follow-through: `sdk/src/chain.ts` `level3CallTx` type updated to
  `(ciphertext, plaintext)`; `frontend/src/components/EncryptedReportForm.tsx`
  now hands the padded 256-byte plaintext straight to the prover instead of
  a caller-computed envelope hash; `contract/scripts/cli.ts` no longer
  precomputes SHA-256 for `submit_report`; the dead
  `frontend/src/components/CircuitCall.tsx` was updated to the new
  single-argument signature for typecheck cleanliness.
- Tests rewritten to assert the binding property directly: identical
  witnesses produce identical disclosed hashes, distinct witnesses produce
  distinct disclosed hashes, and the private bytes never appear in
  serialised ledger state. Exact hash values are not hard-coded — they come
  out of the circuit at runtime.

Ledger shape unchanged. No frontend UI change beyond passing the witness
that already existed in the encryption path.

Redeployed to Preprod on 2026-08-29 via /deploy on the 1am wallet. New
contract address: `0b24b5da3eaf66860c1b69a6d31f3e86089b5c4af48c2dc4be6f6c5b7f4b34f5`.
The previous `e64ad6c5…` address ran the pre-fix circuits and cannot
accept the new (ciphertext, plaintext) call shape, so the address bump
had to land at the same time as the circuit change.


## SDK extraction: COMPLETE (Phases 1–5, all committed)

```
cf09751 build(workspace): add root npm workspaces and scaffold @anonymous-whispers/sdk
7619fd5 feat(sdk): extract pure crypto core into @anonymous-whispers/sdk
d5bb31a test(sdk): add pure crypto round-trip and property tests
13dfe13 feat(sdk): wire encrypted chain layer over the contract workspace
9e28144 refactor(frontend): consume @anonymous-whispers/sdk, remove duplicated core
```

`@anonymous-whispers/sdk` now exists as a real npm workspace (root `package.json` → `["contract", "frontend", "sdk"]`) and is the single source of truth for:

- **Pure crypto** (`sdk/src/keys.ts`, `sdk/src/envelope.ts`) — moved byte-for-byte from `frontend/src/lib/crypto.ts` (diff-audited symbol by symbol; only relocated, not rewritten). `deriveFingerprint` deliberately **not** built — deferred to L5 with key-change-detection.
- **Chain layer** (`sdk/src/chain.ts`, `sdk/src/dapp-connector-wallet-provider.ts`) — `connectToContract`, `level3CallTx` (register_recipient + submit_encrypted_report), `readPublicState`, `isUnregisteredKey`, `NETWORK_ID`, `CONTRACT_ADDRESS`. Legacy `submit_report` (`CIRCUIT_ID`, `REPORT_CONTENT_BYTES`) deliberately excluded from the SDK surface — it's L1/L2-only.
- `frontend/` fully consumes the SDK now — `PublicLedger`, `Report`, `App`, `Inbox`, `WalletConnect`, `EncryptedReportForm` all import from `@anonymous-whispers/sdk`. `frontend/src/lib/contract.ts` is trimmed to 20 lines (re-exports `connectToContract`/`DeployedWhispersContract` from the SDK + keeps `REPORT_CONTENT_BYTES` locally) purely so `CircuitCall.tsx`'s legacy flow keeps compiling. Dead `frontend/src/lib/dapp-connector-wallet-provider.ts` deleted.

**Verified (Linux sandbox):**
- `sdk` — `tsc --noEmit` clean, **4/4 unit tests pass** (round-trip, unlinkability, wrong-key-fails, 512-byte shape) — no network required.
- `frontend` — `tsc --noEmit` clean, `vite build` succeeds.
- `contract` — **16/16 tests pass** (4 circuit + 12 Level 3, including the crypto round-trip that now crosses into `sdk/`). `contract/managed` untouched by the extraction (confirmed via diff after every compile check).

## FIRST THING TO DO ON WINDOWS

Run `npm run dev` (frontend) and open the app in a **real browser** — Chrome, not headless — and click through `/`, `/report`, `/inbox`.

Why this matters: in the Linux sandbox, headless Chrome hit `TypeError: Class extends value undefined is not a constructor or null` from `abstract-level` (a transitive dep of `midnight-js-level-private-state-provider`), leaving `#root` empty in both `npm run dev` and a built+previewed `vite build`. **This is confirmed pre-existing** — I reproduced the identical crash on the pre-refactor code via `git stash`, so it's not something the SDK extraction caused. It's most likely specific to running headless Chrome in this sandboxed environment (missing something `abstract-level`'s browser build expects at runtime) rather than a real bug — **the app rendered fine in an actual browser earlier today**, before this crash was even noticed. Still, this needs a real-browser confirmation on Windows before trusting that pages render, since the sandbox couldn't prove it either way for the current code.

If it does reproduce in a real browser too, start with `abstract-level`/`browser-level`/`level` in `frontend/node_modules` and `@midnight-ntwrk/midnight-js-level-private-state-provider`'s dependency on them — check for a version mismatch or a Vite 8 (rolldown) pre-bundling issue.

## Open threads

1. **Nick's package-dupe fix for the `ChargedState` blocker.** Nick has a fix in his PR [midnightntwrk/example-private-party#25](https://github.com/midnightntwrk/example-private-party/pull/25) — force `@midnight-ntwrk/ledger` and `@midnight-ntwrk/onchain-runtime` to matching versions via root-level overrides. Next step: run `npm ls @midnight-ntwrk/ledger` (and `onchain-runtime`) to check for duplicate versions across the workspace, then add the equivalent overrides to the root `package.json`. This is the likely fix for the long-standing `expected instance of ChargedState` error (both Preview and Preprod moved to protocolVersion 1000000, current SDK pin is 4.1.1) — do this **before** the Preprod deploy below, not after.

2. **Preprod is now compulsory, and sync takes ~3 hours.** Network requirements changed — Preprod is no longer optional/parked, it's required. Preprod sync takes roughly 3 hours, so kick it off early, not right before a deploy deadline. At deploy time: switch `NETWORK_ID` from `'preview'` to `'preprod'` in `sdk/src/chain.ts` (currently the only place it's defined — `frontend/src/components/landing/facts.ts` has its own deliberately-literal copy that must be kept in sync, per its own comment). **Do the package-dupe version fix (#1) before this deploy**, not after — deploying on a still-broken SDK pin wastes the sync wait.

3. **`CircuitCall.tsx` is dead L1/L2 code.** Confirmed unreachable — not routed or rendered anywhere in the current app (`App.tsx` only routes `/`, `/report`, `/inbox`; nothing imports `<CircuitCall>`). It still compiles today only because `frontend/src/lib/contract.ts` was deliberately kept alive for it during the SDK extraction. Worth a decision: delete it (and then `lib/contract.ts` + `REPORT_CONTENT_BYTES` can go too, closing out the last non-SDK contract wiring in `frontend/`), or keep it around as a reference implementation of the Level 1/2 flow. Not removed yet — flagged for a separate decision.

## Remaining Level 4 work

- CI/CD (nothing wired yet for the new `sdk/` + `contract/` + `frontend/` workspace layout)
- README / docs update (needs to describe the SDK as its own package, not just app internals)
- The package-dupe version fix (open thread #1)
- Preprod deploy (open thread #2 — start the sync early)
- Round-trip verify against the live Preprod deployment once deployed (register → encrypt → submit → decrypt, real wallet)
- Demo video

## Aug 12 EOD checkpoint

- CI/CD pipeline landed on this branch (099ccbd) — three-job workflow
  (sdk/frontend/contract), badge in README. Live verification pending
  first GitHub Actions run.
- Deploy.ts stale-path bug fixed (1150ad9): 'contracts/managed' ->
  'managed' after Phase 1 restructure. scripts/cli.ts:38 has the same
  stale path but is out of scope and untouched.
- Preprod deploy still running in tmux session 'deploy'. Wallet sync
  hit a Wallet.Sync FiberFailure at ~363s elapsed, then continued showing
  "Still syncing" past 1219s. Unclear if genuinely progressing or stuck.
  Tomorrow: tmux attach -t deploy, check state. If stuck, restart proof
  server (contract/: npm run proof-server:stop && npm run
  proof-server:start) and re-run deploy — wallet state is persisted so
  sync resumes.
- Preview vs Preprod: both networks show protocolVersion 1000000 now;
  ChargedState was fixed by pinning onchain-runtime-v3 (see 1150ad9's
  parent). Preprod submission-network requirement still to confirm.

## Aug 13 checkpoint

- Yesterday's tmux deploy died overnight (machine restart). Docker was
  reinstalled, the proof server was started, and the deploy was re-launched
  in a fresh tmux session. It is currently syncing to Preprod.
- CI/CD landed green on `level-4-restructure` (commit 099ccbd). The stale
  `main`-branch CI failure is from the deleted L3 workflow and can be
  ignored; it will resolve when the branch is eventually merged to main.
- SDK extraction is complete and pushed (phases 1 through 5, all
  committed).
- ChargedState fix is live (commit 1150ad9, `onchain-runtime-v3` pinned to
  `3.0.0` via npm overrides).
- Deploy path bug is fixed (commit c93b0df).
- `contract/scripts/cli.ts:38` still has the stale `contracts/` path.
  Deferred, not in scope for this docs pass.
- Docs pass for Level 4 done this session (not committed yet): README.md
  rewritten with Vision, Architecture diagram, Privacy Model, Tech Stack,
  and the Onboarded Users table skeletons; docs/USAGE.md added; this
  checkpoint appended. `sdk/src/chain.ts` still points at the Level 3
  Preview address pending the Preprod cutover, called out explicitly in
  the README so it doesn't read as already deployed.
- Remaining Level 4 work:
  1. Preprod deploy completes, then paste the address into README and take
     a deployment screenshot.
  2. X profile created and linked in README.
  3. Google Form created and linked in README.
  4. Demo video recorded.
  5. Final round-trip verification against Preprod (register, encrypt,
     submit, decrypt, real wallet).

## Aug 14 checkpoint

- Preprod deployment succeeded via the browser `/deploy` route on the 1am
  wallet, 2026-08-14 ~06:31 UTC. Address:
  `e64ad6c52fe4fa1a5fa39df58350a722c2d4f9e02d09aaf36c9b9c0d97a22ac9`.
- The Lace attempt earlier failed: the DUST designation transaction
  confirmed, but the tDUST tank stayed empty for 5+ hours amid Preprod
  congestion, so proving never had fees to spend.
- Switched to the 1am wallet, which sponsors DUST out of the box. The same
  `/deploy` flow then succeeded immediately.
- `CONTRACT_ADDRESS` in `sdk/src/chain.ts` updated to the new address; the
  retired Preview address is no longer kept as a commented-out fallback —
  removed entirely now that the app is fully on Preprod.
- README.md and docs/USAGE.md updated to mention the 1am wallet path (README
  Contract Address/Tech Stack/Prerequisites; USAGE What You Need plus a new
  troubleshooting entry for DUST-stuck transactions).
- Remaining Level 4 work:
  1. Deployment screenshot (`deploy-level4.png`) added to the repo root.
  2. Round-trip verification against the live Preprod contract (Report +
     Inbox: register, encrypt, submit, decrypt, real wallet).
  3. Demo video recorded.
  4. Submission.
