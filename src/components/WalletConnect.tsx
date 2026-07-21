/**
 * Wallet discovery and connection against the Lace DApp Connector.
 *
 * Two things about this API are easy to get wrong and worth stating plainly:
 *
 *   1. `connect()` returns a *different* object than the one it was called on.
 *      The injected `InitialAPI` has only { rdns, name, icon, apiVersion,
 *      connect }. Everything useful — addresses, balancing, submitting — lives
 *      on the `ConnectedAPI` that `connect()` resolves to. Keeping a reference
 *      to the injected object after connecting gets you nothing but undefined.
 *
 *   2. There is no `disconnect()`. Disconnecting is purely a local act: drop
 *      the `ConnectedAPI` reference and stop using it.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

import { NETWORK_ID } from '../lib/contract';

export type WalletConnection = {
  api: ConnectedAPI;
  address: string;
};

type Props = {
  connection: WalletConnection | null;
  onConnect: (connection: WalletConnection) => void;
  onDisconnect: () => void;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'error'; message: string; hint?: string };

/**
 * Wallets inject under `window.midnight` keyed by UUID, and a single wallet may
 * register more than one entry (e.g. one per supported API version). Lace is
 * preferred when present; otherwise the first injected wallet is used, since
 * any connector-compliant wallet will work.
 */
const discoverWallets = (): InitialAPI[] => Object.values(window.midnight ?? {});

const findPreferredWallet = (wallets: InitialAPI[]): InitialAPI | undefined =>
  wallets.find((wallet) => wallet.rdns.toLowerCase().includes('lace')) ?? wallets[0];

/** `mn_shield-addr1abc...4ysm` — enough to recognize, too little to read out. */
const truncateAddress = (address: string): string =>
  address.length <= 22 ? address : `${address.slice(0, 12)}...${address.slice(-4)}`;

export function WalletConnect({ connection, onConnect, onDisconnect }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [wallets, setWallets] = useState<InitialAPI[]>([]);

  // Extensions inject asynchronously, so a single read on mount can race and
  // find nothing. Re-check briefly before concluding no wallet is installed.
  useEffect(() => {
    const found = discoverWallets();
    if (found.length > 0) {
      setWallets(found);
      return;
    }
    let attempts = 0;
    const timer = window.setInterval(() => {
      const retry = discoverWallets();
      attempts += 1;
      if (retry.length > 0 || attempts >= 10) {
        setWallets(retry);
        window.clearInterval(timer);
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, []);

  const handleConnect = useCallback(async () => {
    setStatus({ kind: 'connecting' });

    const wallet = findPreferredWallet(discoverWallets());
    if (!wallet) {
      setStatus({
        kind: 'error',
        message: 'No Midnight wallet detected.',
        hint: 'Install the Lace wallet extension, then reload this page.',
      });
      return;
    }

    let api: ConnectedAPI;
    try {
      api = await wallet.connect(NETWORK_ID);
    } catch (error) {
      // The wallet rejects for one reason that matters here: the user declined
      // the prompt. Anything else is surfaced verbatim rather than guessed at.
      setStatus({
        kind: 'error',
        message: 'Connection request was rejected.',
        hint:
          error instanceof Error && error.message
            ? error.message
            : `Approve the connection in ${wallet.name} to continue.`,
      });
      return;
    }

    try {
      // A wallet can be connected to a network other than the one hinted, so
      // the hint passed to connect() is not a guarantee. This contract only
      // exists on Preview; calling it from any other network would fail deep
      // inside proving with a far less obvious message.
      const connectionStatus = await api.getConnectionStatus();
      if (connectionStatus.status !== 'connected') {
        setStatus({
          kind: 'error',
          message: 'Wallet reported a disconnected session.',
          hint: 'Unlock the wallet and try again.',
        });
        return;
      }
      if (connectionStatus.networkId !== NETWORK_ID) {
        setStatus({
          kind: 'error',
          message: `Wrong network: wallet is on "${connectionStatus.networkId}".`,
          hint: `Switch ${wallet.name} to ${NETWORK_ID} and reconnect.`,
        });
        return;
      }

      // Returns an object, not a string.
      const { unshieldedAddress } = await api.getUnshieldedAddress();

      setStatus({ kind: 'idle' });
      onConnect({ api, address: unshieldedAddress });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: 'Could not read wallet details.',
        hint: error instanceof Error ? error.message : String(error),
      });
    }
  }, [onConnect]);

  const handleDisconnect = useCallback(() => {
    // No API call exists — and none is needed. Releasing the reference is the
    // disconnect.
    setStatus({ kind: 'idle' });
    onDisconnect();
  }, [onDisconnect]);

  if (connection) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 rounded-full border border-edge bg-surface px-3 py-1.5">
          <span
            className="animate-pulse-ring size-1.5 rounded-full bg-signal"
            aria-hidden="true"
          />
          <span className="font-mono text-xs text-dim" title={connection.address}>
            {truncateAddress(connection.address)}
          </span>
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          className="text-xs text-muted transition-colors hover:text-dim"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleConnect}
        disabled={status.kind === 'connecting'}
        className="rounded-full border border-edge-lit bg-surface px-4 py-1.5 text-xs text-dim transition-colors hover:border-signal-deep hover:text-bright disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status.kind === 'connecting' ? 'Connecting...' : 'Connect wallet'}
      </button>

      {status.kind === 'error' && (
        <div className="max-w-xs text-right" role="alert">
          <p className="text-xs text-alert">{status.message}</p>
          {status.hint && <p className="mt-0.5 text-xs text-muted">{status.hint}</p>}
        </div>
      )}

      {status.kind === 'idle' && wallets.length === 0 && (
        <p className="text-xs text-muted">No wallet detected</p>
      )}
    </div>
  );
}
