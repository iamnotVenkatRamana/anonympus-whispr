/**
 * Browser-side wiring for the deployed anonymous-whispers contract.
 *
 * This is the browser counterpart to `createProviders` in src/deploy.ts and
 * src/cli.ts. The contract and circuit are the same; only the providers differ,
 * because nothing here may touch the filesystem or hold a wallet seed:
 *
 *   Node (Level 1)                   Browser (Level 2)
 *   ─────────────────────────────    ─────────────────────────────────────
 *   NodeZkConfigProvider (fs)     →  FetchZkConfigProvider (HTTP, public/zk)
 *   httpClientProofProvider       →  dappConnectorProofProvider (wallet proves)
 *   wallet-sdk wallet object      →  createDAppConnectorWalletProvider (Lace)
 *   levelPrivateStateProvider     →  same, but IndexedDB-backed
 */
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { dappConnectorProofProvider } from '@midnight-ntwrk/midnight-js-dapp-connector-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { CostModel } from '@midnight-ntwrk/midnight-js-protocol/ledger';

import { Contract, ledger } from '../../contracts/managed/anonymous-whispers/contract/index.js';
import { createDAppConnectorWalletProvider } from './dapp-connector-wallet-provider';

/**
 * Level 3 targets Preprod (indexer verified healthy on 2026-07-23). The Level
 * 1/2 deployment remains on Preview at
 * 5f4f45e862ad11072d41a4aace8589f51248e0766510b431cab44c1825394ff0.
 */
export const NETWORK_ID = 'preprod';

// The ledger WASM reads a process-global network id when serializing
// transactions; nothing in the browser path sets it (the Node path gets it
// from setNetworkId in src/wallet.ts, which never runs here). Without this,
// submit fails with "Network ID has not been configured"; the read path
// survives only because indexer GraphQL queries never touch that global.
// Module scope so it runs once, before any wallet or contract operation.
setNetworkId(NETWORK_ID);

/**
 * Address of the Level 3 deployment on Preprod.
 *
 * PLACEHOLDER: still the Level 1 Preview address. Replace with the output of
 * `npm run deploy -- --network preprod` (also recorded in
 * .midnight-state.json under deployments.preprod).
 */
export const CONTRACT_ADDRESS =
  '5f4f45e862ad11072d41a4aace8589f51248e0766510b431cab44c1825394ff0';

const INDEXER_URI = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const INDEXER_WS_URI = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';

/** Matches PRIVATE_STATE_ID in src/deploy.ts and src/cli.ts. */
const PRIVATE_STATE_ID = 'anonymousWhispersPrivateState';

/**
 * All circuits on the Level 3 contract. submit_report is the legacy Level 1/2
 * hash-only flow, kept for backward compatibility; the Level 3 UI drives the
 * other two.
 */
export type CircuitId = 'submit_report' | 'register_recipient' | 'submit_encrypted_report';

export const CIRCUIT_ID: CircuitId = 'submit_report';

/** `submit_report`'s `report_content` parameter is a fixed-width `Bytes<256>`. */
export const REPORT_CONTENT_BYTES = 256;

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
 * SDK at all (see src/lib/crypto.ts).
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
 * correct implementation here; the Node paths in src/deploy.ts and src/cli.ts
 * solve the same problem by assigning `globalThis.WebSocket` from the `ws`
 * package instead.
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
 * committed artifacts under contracts/managed may predate the Level 3
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
 * Assembles the providers and resolves the deployed contract.
 *
 * @param api The connected wallet: the object `InitialAPI.connect()` returned.
 * @param accountId The wallet's unshielded address, used to scope private-state
 *                  storage so two wallets in one browser stay isolated.
 */
export const connectToContract = async (api: ConnectedAPI, accountId: string) => {
  // The constructor's default fetchFunc is cross-fetch's re-export of
  // window.fetch, a detached reference the provider invokes as
  // `this.fetchFunc(...)`, which throws "Illegal invocation" in browsers.
  // Passing an explicitly window-bound fetch keeps the required this-binding.
  // Typed with the narrowest circuit id on purpose: the committed artifacts on
  // this machine may still be the Level 2 build, and a narrow provider type is
  // assignable to the wider post-recompile ContractProviders type while the
  // reverse is not. At runtime the provider fetches whatever circuit id it is
  // asked for, so this affects types only.
  const zkConfigProvider = new FetchZkConfigProvider<typeof CIRCUIT_ID>(
    ZK_CONFIG_BASE_URL,
    window.fetch.bind(window),
  );
  const walletProvider = await createDAppConnectorWalletProvider(api);

  const providers = {
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

  return findDeployedContract(providers, {
    compiledContract,
    contractAddress: CONTRACT_ADDRESS,
    privateStateId: PRIVATE_STATE_ID,
    // No witnesses on this contract, so there is no private state to seed.
    initialPrivateState: {},
  });
};

export type DeployedWhispersContract = Awaited<ReturnType<typeof connectToContract>>;

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
    submit_encrypted_report(
      ciphertext: Uint8Array,
      ciphertextHash: Uint8Array,
    ): Promise<CallTxOutcome>;
  };
