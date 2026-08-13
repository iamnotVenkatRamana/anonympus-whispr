/**
 * Admin-only route: deploys a fresh anonymous-whispers contract instance to
 * Preprod straight from the browser via a connected Lace wallet, instead of
 * the multi-hour wallet sync required by contract/scripts/deploy.ts.
 *
 * Network is not configurable here: WalletConnect.tsx already refuses to
 * complete a connection unless the wallet reports NETWORK_ID (Preprod, see
 * sdk/src/chain.ts), so `connection` on this page is only ever non-null when
 * the wallet is already on the right network. There is nothing left to check
 * here (a second banner would be dead code for a state that cannot occur
 * through this component).
 */
import { useCallback, useEffect, useState } from 'react';

import { deployWhispersContract } from '@anonymous-whispers/sdk';

import type { WalletConnection } from '../components/WalletConnect';
import { fullErrorText } from '../lib/errorText';

type Props = {
  connection: WalletConnection | null;
};

type Balances = {
  tNight: bigint;
  dustBalance: bigint;
  dustCap: bigint;
};

type DeployPhase =
  | { kind: 'idle' }
  | { kind: 'deploying' }
  | { kind: 'done'; contractAddress: string }
  | { kind: 'error'; message: string };

const truncateAddress = (address: string): string =>
  address.length <= 22 ? address : `${address.slice(0, 12)}...${address.slice(-4)}`;

export function DeployContract({ connection }: Props) {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [phase, setPhase] = useState<DeployPhase>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    setBalances(null);
    setBalancesError(null);

    // getUnshieldedBalances / getDustBalance are not in WalletConnect's
    // hintUsage() call, so a first-time read here may prompt Lace directly;
    // handled the same way any other rejected/failed connector call is.
    Promise.all([
      import('@midnight-ntwrk/midnight-js-protocol/ledger').then(({ unshieldedToken }) =>
        connection.api.getUnshieldedBalances().then((balances) => balances[unshieldedToken().raw] ?? 0n),
      ),
      connection.api.getDustBalance(),
    ])
      .then(([tNight, dust]) => {
        if (cancelled) return;
        setBalances({ tNight, dustBalance: dust.balance, dustCap: dust.cap });
      })
      .catch((error) => {
        if (cancelled) return;
        setBalancesError(fullErrorText(error));
      });

    return () => {
      cancelled = true;
    };
  }, [connection]);

  const handleDeploy = useCallback(async () => {
    if (!connection) return;

    setStatusLog([]);
    setPhase({ kind: 'deploying' });
    const log = (line: string) => setStatusLog((prev) => [...prev, line]);

    try {
      log('Connecting to Lace...');
      log('Verifying network... OK (Preprod)');
      log('Loading compiled contract...');
      log('Building providers...');
      log('Deploying contract (this can take up to 60s)...');

      const deployed = await deployWhispersContract(connection.api, connection.address);
      const contractAddress = deployed.deployTxData.public.contractAddress;

      log(`Contract deployed at: ${contractAddress}`);
      setPhase({ kind: 'done', contractAddress });
    } catch (error) {
      console.error('deployWhispersContract failed:', error);
      setPhase({ kind: 'error', message: fullErrorText(error) });
    }
  }, [connection]);

  const handleCopyAddress = useCallback(async () => {
    if (phase.kind !== 'done') return;
    await navigator.clipboard.writeText(phase.contractAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [phase]);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h2 className="eyebrow eyebrow-dark">admin</h2>
        <p className="display mt-3 text-2xl font-semibold text-white">
          Deploy anonymous whispers contract
        </p>
      </div>

      <div className="surface-dark flex flex-col gap-3 p-7">
        <p className="eyebrow eyebrow-dark">prerequisites</p>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed" style={{ color: 'var(--muted-dark)' }}>
          <li>Lace wallet installed and set to Preprod</li>
          <li>Wallet funded with tNIGHT and DUST</li>
        </ul>
      </div>

      {!connection && (
        <div className="surface-dark-empty p-12 text-center">
          <p className="display text-2xl font-semibold text-white">Connect a wallet to deploy.</p>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed" style={{ color: 'var(--muted-dark)' }}>
            This deploys a brand new instance of the contract on Preprod. Existing
            reports and inbox data are untouched until the app is pointed at the new
            address.
          </p>
        </div>
      )}

      {connection && (
        <div className="surface-dark flex flex-col gap-5 p-7">
          <div>
            <p className="eyebrow eyebrow-dark">connected wallet</p>
            <p className="mono mt-2.5 text-sm text-white" title={connection.address}>
              {truncateAddress(connection.address)}
            </p>
          </div>

          <div className="flex flex-wrap gap-8 border-t border-white/10 pt-5">
            <div>
              <p className="eyebrow eyebrow-dark">tNIGHT balance</p>
              <p className="mono mt-2 text-sm text-white">
                {balances ? balances.tNight.toLocaleString() : balancesError ? '—' : 'Loading...'}
              </p>
            </div>
            <div>
              <p className="eyebrow eyebrow-dark">DUST balance</p>
              <p className="mono mt-2 text-sm text-white">
                {balances ? `${balances.dustBalance.toLocaleString()} / ${balances.dustCap.toLocaleString()} cap` : balancesError ? '—' : 'Loading...'}
              </p>
            </div>
          </div>

          {balancesError && (
            <p className="notice-quiet mono px-5 py-4 text-[12px] leading-relaxed break-all text-white/80" role="alert">
              Could not read wallet balances: {balancesError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={handleDeploy}
              disabled={phase.kind === 'deploying'}
              className="btn-solid focus-ring px-6 py-3 text-sm"
            >
              {phase.kind === 'deploying' ? 'Deploying...' : 'Deploy Contract'}
            </button>
          </div>
        </div>
      )}

      {statusLog.length > 0 && (
        <div className="surface-dark flex flex-col gap-2 p-7">
          <p className="eyebrow eyebrow-dark">status</p>
          <div className="mono flex flex-col gap-1.5 text-sm text-white/80">
            {statusLog.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {phase.kind === 'error' && (
        <p className="notice-quiet mono px-5 py-4 text-[12px] leading-relaxed break-all text-white/80" role="alert">
          {phase.message}
        </p>
      )}

      {phase.kind === 'done' && (
        <div className="surface-dark flex flex-col gap-4 p-7">
          <p className="eyebrow eyebrow-dark">contract deployed</p>
          <p className="mono text-lg leading-relaxed break-all text-white">
            {phase.contractAddress}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleCopyAddress}
              className="btn-quiet focus-ring px-5 py-2.5 text-sm"
            >
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-dark)' }}>
            Save this address — it is not stored automatically. Paste it into
            CONTRACT_ADDRESS in sdk/src/chain.ts so Report and Inbox point at this
            deployment.
          </p>
        </div>
      )}
    </section>
  );
}
