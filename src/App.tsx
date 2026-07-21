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
            <div className="flex items-center gap-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-11 shrink-0 text-signal"
                aria-hidden="true"
              >
                <path d="M3 9c0-2 4-3.5 9-3.5S21 7 21 9v2c0 4-3 7.5-5.5 7.5-1.4 0-2.7-1-3.5-2.3-.8 1.3-2.1 2.3-3.5 2.3C6 18.5 3 15 3 11z" />
                <circle cx="8.5" cy="11.5" r="1.3" />
                <circle cx="15.5" cy="11.5" r="1.3" />
              </svg>
              <h1 className="font-serif text-6xl font-medium tracking-tight text-bright">
                Anonymous Whispers
              </h1>
            </div>
            <p className="mt-4 font-serif text-xl italic text-dim">
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
              <dd className="font-medium text-signal capitalize">{NETWORK_ID}</dd>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <dt className="text-muted">Contract</dt>
              <dd className="min-w-0">
                <a
                  href={EXPLORER_CONTRACT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block max-w-72 truncate font-mono text-signal/80 underline decoration-signal/30 underline-offset-4 transition-colors hover:text-signal hover:decoration-signal sm:max-w-96"
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
