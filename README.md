# Anonymous Whispers

> Submit an anonymous report on Midnight. Prove you did. Reveal nothing.

## Live Demo

[https://anonymous-whispers.vercel.app](https://anonymous-whispers.vercel.app)

## Contract Address

| Network | Address |
|---------|---------|
| Preview | `5f4f45e862ad11072d41a4aace8589f51248e0766510b431cab44c1825394ff0` |

Note: the challenge template lists Preprod, but this dApp is deployed to Preview.
Preprod was unavailable during the challenge period (confirmed by the Midnight
team), so the contract lives on Preview and every network reference in the app
matches that.

## What This Does

Anonymous Whispers is a whistleblowing dApp. A user writes a report in the
frontend and submits it anonymously. The report content is hashed client-side
with SHA-256, inside the browser, before anything else happens.

A zero-knowledge proof is then generated in the user's Lace wallet. The proof
attests that the published hash was computed correctly from the actual report
content, without the content ever being part of the transaction. The wallet
balances, signs, and submits the transaction to the Midnight Preview network.

Only two things are stored on-chain: the SHA-256 hash of each submission and a
public counter of total reports. The actual report content never leaves the
browser. It is dropped from memory the moment proving begins, and there is no
code path that could transmit, store, or log it.

## Privacy Model

What is PUBLIC:

- The counter of total reports submitted.
- The SHA-256 hash of each submission.
- The wallet address that signed, visible to anyone inspecting the transaction
  on-chain.

What is PRIVATE:

- The actual report content, always. Never transmitted, never stored, never
  logged.

What the user PROVES without revealing:

- That they know a 256-byte buffer whose SHA-256 matches the published
  `content_hash`. This proves they submitted something without revealing what.

## Privacy Claim

An on-chain observer sees which wallet submitted a report and when, and the
hash of the content, but cannot recover the content itself. Not from us, not
from Midnight, not from anyone. The only way for content to become known is if
the submitter chooses to share it.

## Tech Stack

- Midnight Network (Preview)
- Compact language
- Midnight.js SDK 4.1.x
- React 19
- Vite 8
- TypeScript
- Tailwind CSS
- Lace wallet extension

## Prerequisites

- Lace wallet browser extension installed and set to the Preview network
- Preview tNIGHT balance funded from
  [https://midnight-tmnight-preview.nethermind.dev](https://midnight-tmnight-preview.nethermind.dev)
- Preview tDUST auto-generates from tNIGHT (allow a few minutes after funding)
- For local development: Node.js v22+, npm

## Run Locally

```bash
git clone https://github.com/Emmanuellsensai/anonymous-whispers.git
cd anonymous-whispers
npm install --legacy-peer-deps
npm run dev
```

Then open http://localhost:5173, connect Lace (Preview), and submit a report.
The frontend needs no proof server and no Docker: proving happens inside the
Lace wallet.

## Demo Video

[Video link will be added after recording.]

## Level 1 (Contract Deployment)

Level 1 (the Compact contract and backend deployment) is complete and
reviewed. The contract source is at `contracts/anonymous-whispers.compact` and
the deployment CLI is at `src/cli.ts` (run with `npm run cli`). The offline
test suite runs with `npm test`, and `npm run deploy -- --network preview`
deploys a fresh instance against a local proof server
(`npm run proof-server:start`).

## Screenshots

![Compile Output](./compile.png)

![Deploy Output](./deploy.png)
