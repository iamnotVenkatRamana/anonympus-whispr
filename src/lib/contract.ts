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
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { CostModel } from '@midnight-ntwrk/midnight-js-protocol/ledger';

import { Contract, ledger } from '../../contracts/managed/anonymous-whispers/contract/index.js';
import { createDAppConnectorWalletProvider } from './dapp-connector-wallet-provider';

/**
 * Preview, not Preprod. Preprod was unavailable when this contract was
 * deployed during Level 1, so the live deployment lives on Preview and every
 * network reference in this app must match.
 */
export const NETWORK_ID = 'preview';

/** Address of the Level 1 deployment on Preview. */
export const CONTRACT_ADDRESS =
  '5f4f45e862ad11072d41a4aace8589f51248e0766510b431cab44c1825394ff0';

const INDEXER_URI = 'https://indexer.preview.midnight.network/api/v4/graphql';
const INDEXER_WS_URI = 'wss://indexer.preview.midnight.network/api/v4/graphql/ws';

/** Matches PRIVATE_STATE_ID in src/deploy.ts and src/cli.ts. */
const PRIVATE_STATE_ID = 'anonymousWhispersPrivateState';

/** The contract's only circuit. */
export const CIRCUIT_ID = 'submit_report';

/** `submit_report`'s `report_content` parameter is a fixed-width `Bytes<256>`. */
export const REPORT_CONTENT_BYTES = 256;

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
 * `{}` — there is nothing secret in this store to protect. A real secret would
 * be required the moment a witness is added.
 */
const PRIVATE_STATE_PASSWORD = 'Frontend-Devnet-Development-Placeholder-1';

const compiledContract = CompiledContract.make('anonymous-whispers', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  // Resolved relative to the ZK config provider's base, so this is the path
  // segment under public/zk — not a filesystem path as it is in deploy.ts.
  CompiledContract.withCompiledFileAssets('anonymous-whispers'),
);

/**
 * The third argument is not optional in practice, despite its type.
 *
 * The provider defaults `webSocketImpl` to `ws.WebSocket` from `isomorphic-ws`,
 * whose browser build exports no such named binding — so the default resolves to
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

/** Public ledger state of the contract: the report counter and latest hash. */
export type PublicState = {
  counter: bigint;
  latestReportHash: Uint8Array;
};

/**
 * Reads the contract's public state straight from the indexer. Needs no wallet,
 * so the counter can be shown before the user connects.
 */
export const readPublicState = async (): Promise<PublicState | null> => {
  const contractState = await publicDataProvider.queryContractState(CONTRACT_ADDRESS);
  if (!contractState) return null;
  const ledgerState = ledger(contractState.data);
  return {
    counter: ledgerState.counter,
    latestReportHash: ledgerState.latest_report_hash,
  };
};

/**
 * Assembles the providers and resolves the deployed contract.
 *
 * @param api The connected wallet — the object `InitialAPI.connect()` returned.
 * @param accountId The wallet's unshielded address, used to scope private-state
 *                  storage so two wallets in one browser stay isolated.
 */
export const connectToContract = async (api: ConnectedAPI, accountId: string) => {
  const zkConfigProvider = new FetchZkConfigProvider<typeof CIRCUIT_ID>(ZK_CONFIG_BASE_URL);
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
