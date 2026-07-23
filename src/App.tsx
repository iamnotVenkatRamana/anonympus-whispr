import { useCallback, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';

import { WalletConnect, type WalletConnection } from './components/WalletConnect';
import { CONTRACT_ADDRESS, NETWORK_ID } from './lib/contract';
import { Inbox } from './pages/Inbox';
import { Landing } from './pages/Landing';
import { Report } from './pages/Report';

const EXPLORER_CONTRACT_URL = `https://${NETWORK_ID}.midnightexplorer.com/contracts/${CONTRACT_ADDRESS}`;

/**
 * Shared chrome around every route. Wallet connection state lives here so
 * navigating between /report and /inbox does not drop the Lace session.
 */
function Shell() {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const handleDisconnect = useCallback(() => setConnection(null), []);
  const { pathname } = useLocation();

  return (
    <div className="min-h-full bg-void">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <Link to="/" className="flex items-center gap-4">
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
              <h1 className="font-serif text-5xl font-medium tracking-tight text-bright sm:text-6xl">
                Anonymous Whispers
              </h1>
            </Link>
            <p className="mt-4 font-serif text-xl italic text-dim">
              Report something. Prove you did. Reveal nothing.
            </p>
          </div>
          {pathname !== '/' && (
            <WalletConnect
              connection={connection}
              onConnect={setConnection}
              onDisconnect={handleDisconnect}
            />
          )}
        </header>

        <main className="mt-16 flex flex-col gap-10">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/report" element={<Report connection={connection} />} />
            <Route path="/inbox" element={<Inbox connection={connection} />} />
          </Routes>
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

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
