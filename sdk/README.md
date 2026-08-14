# @anonymous-whispers/sdk

Reusable core for private, sender-anonymous messaging on Midnight.

A recipient registers a public key on-chain; anyone encrypts a message to
that key in-browser using a fresh throwaway sender keypair (unlinkable,
untraceable); only the recipient's secret key can open it.

Status: extracted from the `anonymous-whispers` sample app (Level 4). Not
published; consumed locally via npm workspaces.

## Layout

- `src/keys.ts` — recipient keypair generation (pure)
- `src/envelope.ts` — encrypt/decrypt, 512-byte sealed envelope (pure)
- `src/chain.ts` — register/submit/fetch over the compiled contract
- `src/types.ts` — shared types
- `src/index.ts` — public API
