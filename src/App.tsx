import { useCallback, useState } from 'react';

import { CircuitCall } from './components/CircuitCall';
import { PublicLedger } from './components/PublicLedger';
import { WalletConnect, type WalletConnection } from './components/WalletConnect';
import { CONTRACT_ADDRESS, NETWORK_ID } from './lib/contract';

export default function App() {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const handleDisconnect = useCallback(() => setConnection(null), []);
  const handleSubmitted = useCallback(() => setRefreshToken((token) => token + 1), []);

  return (
    <div className="min-h-full bg-void">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-10">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-lg tracking-tight text-bright">Anonymous Whispers</h1>
            <p className="mt-1 text-xs text-muted">
              Report something. Prove you did. Reveal nothing.
            </p>
          </div>
          <WalletConnect
            connection={connection}
            onConnect={setConnection}
            onDisconnect={handleDisconnect}
          />
        </header>

        <main className="mt-14 flex flex-col gap-10">
          {connection ? (
            <CircuitCall
              api={connection.api}
              address={connection.address}
              onSubmitted={handleSubmitted}
            />
          ) : (
            <section className="rounded-lg border border-dashed border-edge p-10 text-center">
              <p className="text-sm text-dim">Connect a wallet to submit a report.</p>
              <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-muted">
                Your report is hashed and proven locally. The proof is generated inside
                your wallet — the text itself is never transmitted, stored, or logged.
              </p>
            </section>
          )}

          <PublicLedger refreshToken={refreshToken} />
        </main>

        <footer className="mt-auto pt-14">
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
            <div className="flex gap-2">
              <dt className="text-muted">Network</dt>
              <dd className="text-dim capitalize">{NETWORK_ID}</dd>
            </div>
            <div className="flex min-w-0 gap-2">
              <dt className="text-muted">Contract</dt>
              <dd className="truncate font-mono text-dim" title={CONTRACT_ADDRESS}>
                {CONTRACT_ADDRESS}
              </dd>
            </div>
          </dl>
        </footer>
      </div>
    </div>
  );
}
