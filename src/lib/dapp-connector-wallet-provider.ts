/**
 * Bridges the Lace DApp Connector API to the `WalletProvider` / `MidnightProvider`
 * interfaces that `MidnightProviders` expects.
 *
 * These two sides do not speak the same language, which is the whole reason this
 * file exists:
 *
 *   - Midnight.js hands us live ledger WASM objects. `balanceTx` receives an
 *     `UnboundTransaction` (`Transaction<SignatureEnabled, Proof, PreBinding>`)
 *     and must return a `FinalizedTransaction`
 *     (`Transaction<SignatureEnabled, Proof, Binding>`).
 *   - The connector only accepts and returns *serialized* transactions as
 *     strings, because it has to cross the extension message boundary.
 *
 * So every call round-trips through `serialize()` → hex → connector → hex →
 * `Transaction.deserialize(...)`.
 *
 * The Node-side equivalent of this adapter is `createProviders` in src/deploy.ts,
 * which talks to the wallet-sdk's rich object API instead and therefore needs
 * none of this. Do not try to share code between them.
 */
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import {
  Transaction,
  type FinalizedTransaction,
  type TransactionId,
  type CoinPublicKey,
  type EncPublicKey,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';

/**
 * `MidnightProviders` takes `walletProvider` and `midnightProvider` separately,
 * but a single object can satisfy both, which is what src/deploy.ts does too.
 */
export type DAppConnectorWalletProvider = WalletProvider & MidnightProvider;

/**
 * The subset of the connected wallet this adapter actually uses. Narrowing it
 * keeps the adapter testable with a stub and makes the dependency explicit.
 */
export type DAppConnectorWalletAPI = Pick<
  ConnectedAPI,
  'getShieldedAddresses' | 'balanceUnsealedTransaction' | 'submitTransaction'
>;

/**
 * Builds the wallet provider for a connected wallet.
 *
 * This is async (and has to be) because `WalletProvider.getCoinPublicKey` and
 * `getEncryptionPublicKey` are *synchronous*, while the only way to obtain those
 * keys from the connector (`getShieldedAddresses`) is a promise. So the keys are
 * fetched once here and closed over, rather than fetched per call.
 *
 * @param api The object returned by `InitialAPI.connect()`, never the
 *            `InitialAPI` itself, which has none of these methods.
 */
export const createDAppConnectorWalletProvider = async (
  api: DAppConnectorWalletAPI,
): Promise<DAppConnectorWalletProvider> => {
  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } = await api.getShieldedAddresses();

  return {
    // Bech32m strings, as documented by the connector. `CoinPublicKey` and
    // `EncPublicKey` are both bare `string` aliases in the ledger types.
    getCoinPublicKey: (): CoinPublicKey => shieldedCoinPublicKey,

    getEncryptionPublicKey: (): EncPublicKey => shieldedEncryptionPublicKey,

    /**
     * Hands the proven-but-unbalanced transaction to the wallet, which pays the
     * fees, adds whatever inputs and outputs are needed to remove imbalances,
     * and binds it.
     *
     * The `ttl` argument Midnight.js may pass is deliberately dropped: the
     * connector's `balanceUnsealedTransaction` exposes no equivalent option
     * (only `payFees`), so the wallet picks the validity window itself.
     */
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const { tx: balanced } = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      // The wallet returns a sealed transaction: signatures, proofs, and
      // binding all applied, hence the 'binding' marker rather than the
      // 'pre-binding' the input carried.
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced));
    },

    /**
     * Submits via the wallet acting as a relayer.
     *
     * `submitTransaction` resolves to `void`, but `MidnightProvider.submitTx`
     * must produce a `TransactionId`, so the identifier is read off the
     * transaction before it goes out. `identifiers()` is the value the docs
     * point at for watching a specific transaction; `transactionHash()` is
     * explicitly not safe for that, because merging can change it.
     */
    async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
      const [transactionId] = tx.identifiers();
      if (transactionId === undefined) {
        throw new Error('Balanced transaction carried no identifiers; cannot track submission.');
      }
      await api.submitTransaction(toHex(tx.serialize()));
      return transactionId;
    },
  };
};
