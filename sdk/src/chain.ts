/**
 * Browser-side wiring for the deployed anonymous-whispers contract.
 *
 * Moved verbatim from frontend/src/lib/contract.ts (Level 4 SDK extraction),
 * scoped to the encrypted flow: connect, register, submit_encrypted_report,
 * and the public read. The legacy `submit_report` (Level 1/2 hash-only) flow
 * is NOT part of this SDK's surface — it stays behind in
 * frontend/src/lib/contract.ts for CircuitCall.tsx, which the SDK does not
 * touch.
 *
 * This is the browser counterpart to `createProviders` in
 * contract/scripts/deploy.ts and contract/scripts/cli.ts. The contract and
 * circuit are the same; only the providers differ, because nothing here may
 * touch the filesystem or hold a wallet seed:
 *
 *   Node (Level 1)                   Browser (Level 2)
 *   ─────────────────────────────    ─────────────────────────────────────
 *   NodeZkConfigProvider (fs)     →  FetchZkConfigProvider (HTTP, public/zk)
 *   httpClientProofProvider       →  dappConnectorProofProvider (wallet proves)
 *   wallet-sdk wallet object      →  createDAppConnectorWalletProvider (Lace)
 *   levelPrivateStateProvider     →  same, but IndexedDB-backed
 */
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { dappConnectorProofProvider } from '@midnight-ntwrk/midnight-js-dapp-connector-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { CostModel } from '@midnight-ntwrk/midnight-js-protocol/ledger';

import { Contract, ledger } from '@contract/anonymous-whispers/contract/index.js';
import { createDAppConnectorWalletProvider } from './dapp-connector-wallet-provider';

/**
 * Preprod. A Lace-wallet deploy via /deploy stalled for 5+ hours on
 * 2026-08-13: the DUST designation transaction confirmed, but the tDUST tank
 * stayed empty amid Preprod congestion, so proving never had fees to spend.
 * Switching to the 1am wallet (which sponsors DUST, bypassing Lace's
 * designation delay) let the same /deploy flow succeed immediately, on
 * 2026-08-14 ~06:31 UTC. Previously targeted Preview because the Preprod
 * indexer was reported lagging by the Midnight team on 2026-07-23 — that was
 * stale by the time this switched.
 */
export const NETWORK_ID = 'preprod';

// The ledger WASM reads a process-global network id when serializing
// transactions; nothing in the browser path sets it (the Node path gets it
// from setNetworkId in contract/scripts/wallet.ts, which never runs here).
// Without this, submit fails with "Network ID has not been configured"; the
// read path survives only because indexer GraphQL queries never touch that
// global. Module scope so it runs once, before any wallet or contract
// operation.
setNetworkId(NETWORK_ID);

/** Deployed via /deploy on the 1am wallet, 2026-08-14 ~06:31 UTC. */
export const CONTRACT_ADDRESS =
  'e64ad6c52fe4fa1a5fa39df58350a722c2d4f9e02d09aaf36c9b9c0d97a22ac9';

const INDEXER_URI = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const INDEXER_WS_URI = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';

/** Matches PRIVATE_STATE_ID in contract/scripts/deploy.ts and cli.ts. */
const PRIVATE_STATE_ID = 'anonymousWhispersPrivateState';

/**
 * The SDK's circuit surface: registration and the encrypted submission. The
 * legacy `submit_report` circuit exists on the same deployed contract but is
 * out of scope for this SDK (see module header); the narrower type here is
 * compile-time only (`at runtime the provider fetches whatever circuit id it
 * is asked for`, per FetchZkConfigProvider below), so this changes nothing
 * observable, only which circuit ids are typed as available through the SDK.
 */
export type CircuitId = 'register_recipient' | 'submit_encrypted_report';

/** `submit_encrypted_report`'s `ciphertext` parameter is a `Bytes<512>`. */
export const CIPHERTEXT_BYTES = 512;

/**
 * FetchZkConfigProvider runs `new URL(baseURL)` in its constructor and rejects
 * anything that isn't http(s), so a root-relative '/zk/...' throws on
 * construction. It must be absolute.
 */
const ZK_CONFIG_BASE_URL = `${window.location.origin}/zk/anonymous-whispers`;

/**
 * Placeholder that satisfies the private-state store's password policy (16+
 * chars, 3 of 4 character classes, no runs, no sequential patterns).
 *
 * This contract declares no witnesses, so its private state is permanently
 * `{}`: there is nothing secret in this store to protect. A real secret would
 * be required the moment a witness is added. The recipient's curve25519
 * secret key is deliberately NOT in this store; it never touches the Midnight
 * SDK at all (see this package's envelope.ts).
 */
const PRIVATE_STATE_PASSWORD = 'Frontend-Devnet-Development-Placeholder-1';

const compiledContract = CompiledContract.make('anonymous-whispers', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  // Resolved relative to the ZK config provider's base, so this is the path
  // segment under public/zk, not a filesystem path as it is in deploy.ts.
  CompiledContract.withCompiledFileAssets('anonymous-whispers'),
);

/**
 * The third argument is not optional in practice, despite its type.
 *
 * The provider defaults `webSocketImpl` to `ws.WebSocket` from `isomorphic-ws`,
 * whose browser build exports no such named binding, so the default resolves to
 * `undefined` and every subscription (which is how the SDK waits for a
 * transaction to be included) fails. The browser's native WebSocket is the
 * correct implementation here; the Node paths in contract/scripts/deploy.ts and
 * cli.ts solve the same problem by assigning `globalThis.WebSocket` from the
 * `ws` package instead.
 */
export const publicDataProvider = indexerPublicDataProvider(
  INDEXER_URI,
  INDEXER_WS_URI,
  // The parameter is typed against the Node `ws` package, which the browser's
  // native WebSocket is call-compatible with but not structurally identical to
  // (it has no Server/WebSocketServer statics). Referencing the parameter type
  // rather than naming `ws` keeps this honest if the signature ever changes.
  WebSocket as unknown as NonNullable<Parameters<typeof indexerPublicDataProvider>[2]>,
);

/**
 * Shape of the Level 3 additions to the generated ledger projector. The
 * committed artifacts under contract/managed may predate the Level 3
 * recompile, so these fields are read structurally and treated as optional at
 * runtime; after `npm run compile` regenerates the projector they are all
 * present. The List projector exposes iteration plus a bigint length().
 */
type Level3Ledger = {
  recipient_public_key: Uint8Array;
  recipient_key_version: bigint;
  ciphertexts: Iterable<Uint8Array> & { length(): bigint };
};

/** Public ledger state of the contract: everything anyone can ever read. */
export type PublicState = {
  counter: bigint;
  latestReportHash: Uint8Array;
  /** Null until the Level 3 contract is deployed and a recipient registers. */
  recipientPublicKey: Uint8Array | null;
  recipientKeyVersion: bigint;
  /** Newest first (the contract pushes to the front of the list). */
  ciphertexts: Uint8Array[];
};

/** True for a missing or all-zero key, i.e. "no recipient registered". */
export const isUnregisteredKey = (key: Uint8Array | null): boolean =>
  key === null || key.every((byte) => byte === 0);

/**
 * Reads the contract's public state straight from the indexer. Needs no wallet,
 * so everything (counter, recipient key, inbox) renders before connecting.
 */
export const readPublicState = async (): Promise<PublicState | null> => {
  const contractState = await publicDataProvider.queryContractState(CONTRACT_ADDRESS);
  if (!contractState) return null;
  const ledgerState = ledger(contractState.data) as ReturnType<typeof ledger> &
    Partial<Level3Ledger>;

  const ciphertexts: Uint8Array[] = [];
  const rawList = ledgerState.ciphertexts;
  if (rawList && typeof rawList[Symbol.iterator] === 'function') {
    for (const entry of rawList) ciphertexts.push(entry);
  }

  const recipientPublicKey = ledgerState.recipient_public_key ?? null;
  return {
    counter: ledgerState.counter,
    latestReportHash: ledgerState.latest_report_hash,
    recipientPublicKey: isUnregisteredKey(recipientPublicKey) ? null : recipientPublicKey,
    recipientKeyVersion: ledgerState.recipient_key_version ?? 0n,
    ciphertexts,
  };
};

/**
 * Assembles the browser provider set shared by connectToContract (below) and
 * deployWhispersContract. Both need the same wallet-backed proving, indexer,
 * and private-state wiring; only what they hand to Midnight.js afterwards
 * (findDeployedContract vs deployContract) differs.
 *
 * @param api The connected wallet: the object `InitialAPI.connect()` returned.
 * @param accountId The wallet's unshielded address, used to scope private-state
 *                  storage so two wallets in one browser stay isolated.
 */
const buildBrowserProviders = async (api: ConnectedAPI, accountId: string) => {
  // The constructor's default fetchFunc is cross-fetch's re-export of
  // window.fetch, a detached reference the provider invokes as
  // `this.fetchFunc(...)`, which throws "Illegal invocation" in browsers.
  // Passing an explicitly window-bound fetch keeps the required this-binding.
  // Typed with the narrowest circuit id on purpose: the committed artifacts on
  // this machine may still be the Level 2 build, and a narrow provider type is
  // assignable to the wider post-recompile ContractProviders type while the
  // reverse is not. At runtime the provider fetches whatever circuit id it is
  // asked for, so this affects types only.
  const zkConfigProvider = new FetchZkConfigProvider<CircuitId>(
    ZK_CONFIG_BASE_URL,
    window.fetch.bind(window),
  );
  const walletProvider = await createDAppConnectorWalletProvider(api);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'anonymous-whispers-state',
      accountId,
      privateStoragePasswordProvider: () => PRIVATE_STATE_PASSWORD,
    }),
    publicDataProvider,
    zkConfigProvider,
    // Proving happens inside the wallet, so the prover key and ZKIR are handed
    // to it rather than to a local proof server. This is the browser's whole
    // reason for not needing docker compose running.
    proofProvider: await dappConnectorProofProvider(
      api,
      zkConfigProvider,
      CostModel.initialCostModel(),
    ),
    walletProvider,
    midnightProvider: walletProvider,
  };
};

/** Resolves the deployed contract at CONTRACT_ADDRESS. */
export const connectToContract = async (api: ConnectedAPI, accountId: string) => {
  const providers = await buildBrowserProviders(api, accountId);

  return findDeployedContract(providers, {
    compiledContract,
    contractAddress: CONTRACT_ADDRESS,
    privateStateId: PRIVATE_STATE_ID,
    // No witnesses on this contract, so there is no private state to seed.
    initialPrivateState: {},
  });
};

export type DeployedWhispersContract = Awaited<ReturnType<typeof connectToContract>>;

/**
 * Deploys a brand new anonymous-whispers instance on Preprod from the
 * browser. Used by the /deploy admin route; ordinary reporters and
 * organizations never call this — they use connectToContract against the
 * already-deployed CONTRACT_ADDRESS above.
 *
 * @param api The connected wallet: the object `InitialAPI.connect()` returned.
 * @param accountId The wallet's unshielded address, used to scope private-state
 *                  storage so two wallets in one browser stay isolated.
 */
export const deployWhispersContract = async (api: ConnectedAPI, accountId: string) => {
  const providers = await buildBrowserProviders(api, accountId);

  // No `args`: unlike contract/scripts/deploy.ts (which loads the contract
  // dynamically via `import()`, widening its constructor-args type to
  // `any[]` and requiring an explicit `[]`), `compiledContract` here is built
  // from a statically-imported `Contract`, so its no-arg constructor is
  // known at the type level and `args` is not a valid property at all.
  return deployContract(providers, {
    compiledContract,
    privateStateId: PRIVATE_STATE_ID,
    // No witnesses on this contract, so there is no private state to seed.
    initialPrivateState: {},
  });
};

/** The slice of a callTx result the UI consumes. */
type CallTxOutcome = { public: { txId: string } };

/**
 * Level 3 circuit calls, typed structurally.
 *
 * The static callTx type is derived from the committed compiled artifacts,
 * which may still be the two-circuit Level 2 build on this machine (the
 * Compact toolchain has no Windows binary; CI compiles on Ubuntu). The cast
 * below keeps the code compiling against either generation of artifacts; at
 * runtime the circuits exist exactly when the deployed contract and synced
 * zk assets are the Level 3 build.
 */
export const level3CallTx = (contract: DeployedWhispersContract) =>
  contract.callTx as unknown as {
    register_recipient(newPublicKey: Uint8Array): Promise<CallTxOutcome>;
    // Signature matches the on-chain circuit: (ciphertext, plaintext), where
    // plaintext is the padded 256-byte report that gets passed through the
    // circuit as a PRIVATE witness. The circuit computes persistentHash of it
    // in-circuit and discloses only the hash into latest_report_hash — the
    // plaintext bytes themselves never touch the ledger. See the contract's
    // submit_encrypted_report circuit for the privacy analysis.
    submit_encrypted_report(
      ciphertext: Uint8Array,
      plaintext: Uint8Array,
    ): Promise<CallTxOutcome>;
  };
