import { useCallback, useState } from 'react';

import { CircuitCall } from './components/CircuitCall';
import { PublicLedger } from './components/PublicLedger';
import { WalletConnect, type WalletConnection } from './components/WalletConnect';
import { CONTRACT_ADDRESS, NETWORK_ID } from './lib/contract';

const EXPLORER_CONTRACT_URL = `https://preview.midnightexplorer.com/contracts/${CONTRACT_ADDRESS}`;

export default function App() {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const handleDisconnect = useCallback(() => setConnection(null), []);
  const handleSubmitted = useCallback(() => setRefreshToken((token) => token + 1), []);

  return (
    <div className="min-h-full bg-void">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-5xl font-semibold tracking-tight text-bright">
              Anonymous Whispers
            </h1>
            <p className="mt-3 text-lg text-dim">
              Report something. Prove you did. Reveal nothing.
            </p>
          </div>
          <WalletConnect
            connection={connection}
            onConnect={setConnection}
            onDisconnect={handleDisconnect}
          />
        </header>

        <main className="mt-16 flex flex-col gap-10">
          {connection ? (
            <CircuitCall
              api={connection.api}
              address={connection.address}
              onSubmitted={handleSubmitted}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-edge-lit bg-surface/30 p-12 text-center">
              <p className="text-lg text-bright">Connect a wallet to submit a report.</p>
              <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-dim">
                Your report is hashed and proven locally. The proof is generated inside
                your wallet; the text itself is never transmitted, stored, or logged.
              </p>
            </section>
          )}

          <PublicLedger refreshToken={refreshToken} />
        </main>

        <footer className="mt-auto pt-16">
          <dl className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <dt className="text-muted">Network</dt>
              <dd>
                <span className="rounded-full border border-signal-deep/50 bg-signal-deep/15 px-3 py-1 text-xs font-medium text-signal capitalize">
                  {NETWORK_ID}
                </span>
              </dd>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <dt className="text-muted">Contract</dt>
              <dd className="min-w-0">
                <a
                  href={EXPLORER_CONTRACT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block max-w-72 truncate font-mono text-dim underline decoration-edge-lit underline-offset-4 transition-colors hover:text-signal hover:decoration-signal sm:max-w-96"
                  title={`${CONTRACT_ADDRESS} (view on Midnight Explorer)`}
                >
                  {CONTRACT_ADDRESS}
                </a>
              </dd>
            </div>
          </dl>
        </footer>
      </div>
    </div>
  );
}
