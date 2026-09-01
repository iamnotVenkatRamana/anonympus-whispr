# Anonymous Whispers — Setup
Everything needed to go from a clean checkout to a running Anonymous Whispers stack.
## 1. Prerequisites
| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 22 | `nvm install 22 && nvm use 22` |
| Yarn | 1.22.x | `corepack enable` or `npm i -g yarn` |
| Compact compiler | 0.31.1 | `curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh \| sh` |
| Docker (optional) | 24+ | only for the local `node`/`indexer`/`proof-server` compose stack |
| Midnight Lace wallet | latest | browser extension, for the web app |
A **proof server on `http://127.0.0.1:6300`** is required for any transaction on `preview` or
`preprod`. Either run it from compose (`yarn env:up:all`) or standalone:
```bash
npx @paimaexample/npm-midnight-proof-server --binary   # no Docker required
```
## 2. Install
```bash
git clone <this repo> && cd anonymous-whispers
yarn install
yarn --cwd frontend install
```
## 3. Compile the contract
```bash
# see package.json
```
Artifacts land in `contracts/managed/` (`.prover`, `.verifier`, `.zkir`, `.bzkir`). The web app
reads them via `yarn sync:zk`.
## 4. Configure the environment
Copy the example env file and fill it in:
```bash
cp .env.example .env 2>/dev/null || touch .env
```
```dotenv
# undeployed | local | preview | preprod
MIDNIGHT_NETWORK=preprod
# 64-char hex seed. Required for preview/preprod.
# On 'undeployed' the pre-funded genesis seed is used automatically.
WALLET_SEED=
LOG_LEVEL=info
```
### Network endpoints
| Network | Node RPC | Indexer | Faucet |
|---|---|---|---|
| `undeployed` (local) | http://127.0.0.1:9944 | http://127.0.0.1:8088/api/v4/graphql | genesis wallet |
| `preview` | https://rpc.preview.midnight.network | https://indexer.preview.midnight.network/api/v4/graphql | https://midnight-tmnight-preview.nethermind.dev |
| `preprod` | https://rpc.preprod.midnight.network | https://indexer.preprod.midnight.network/api/v4/graphql | https://faucet.preprod.midnight.network |
## 5. Fund the wallet (preview / preprod only)
1. Start the proof server (step 1).
2. Run `yarn deploy` once — it prints your bech32 wallet address.
3. Paste that address into the faucet for your network and request tNIGHT.
4. Re-run; the deploy path calls `ensureDust()`, which registers your NIGHT UTXOs for DUST
   generation and waits until spendable DUST appears.
## 6. Local stack (optional)
```bash
docker compose up -d --wait
```
## 7. Deploy
```bash
```
The deploy script writes the resulting address to `deployment.json`; commit that file.
## 8. Run the tests
```bash
# no test script defined
```
## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| `Address already in use` on :6300 | proof server already running | reuse it, or kill the old process |
| `Timed out waiting for DUST` | wallet holds no NIGHT, or NIGHT is unregistered | fund from the faucet, then re-run so `ensureDust()` registers the UTXOs |
| `Invalid seed` | `WALLET_SEED` is a mnemonic | the deploy path expects a **64-char hex** seed |
| Wallet sync hangs | indexer unreachable | check the indexer URL for your `MIDNIGHT_NETWORK` |
| `Unknown network` | bad `MIDNIGHT_NETWORK` | one of `undeployed`, `local`, `preview`, `preprod` |
| Web app can't find ZK keys | `sync:zk` not run | `yarn sync:zk` (`yarn web:dev` does it for you) |
