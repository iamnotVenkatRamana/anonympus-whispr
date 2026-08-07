import { useCallback, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';

import { Logo } from './components/landing/Logo';
import { WalletConnect, type WalletConnection } from './components/WalletConnect';
import { CONTRACT_ADDRESS, NETWORK_ID } from '@anonymous-whispers/sdk';
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
    <div className="min-h-full bg-black">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <Link
              to="/"
              className="focus-ring inline-flex items-center gap-3 rounded-full"
            >
              <Logo className="size-9 shrink-0 text-white" />
              <h1 className="display text-4xl font-semibold text-white lowercase sm:text-5xl">
                anonymous whispers
              </h1>
            </Link>
            <p
              className="mt-4 text-base leading-relaxed lowercase"
              style={{ color: 'var(--muted-dark)' }}
            >
              report something. prove you did. reveal nothing.
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

        <main className="mt-14 flex flex-col gap-8">
          <Routes>
            <Route path="/report" element={<Report connection={connection} />} />
            <Route path="/inbox" element={<Inbox connection={connection} />} />
          </Routes>
        </main>

        <footer className="mt-auto pt-16">
          <dl className="flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-white/10 pt-8">
            <div className="flex items-center gap-3">
              <dt className="eyebrow eyebrow-dark">network</dt>
              <dd className="mono text-sm text-white">{NETWORK_ID}</dd>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <dt className="eyebrow eyebrow-dark">contract</dt>
              <dd className="min-w-0">
                <a
                  href={EXPLORER_CONTRACT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring mono block max-w-72 truncate text-sm text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white sm:max-w-96"
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
      {/*
        The landing page is full-bleed and renders outside the Shell: its hero
        is a 100vh section and its scroll scenes need the whole viewport, which
        the Shell's centred max-w-3xl column and wallet header cannot give it.
        Every other route still goes through the Shell exactly as before, so
        /report and /inbox keep their persistent wallet connection.
      */}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Shell />} />
      </Routes>
    </BrowserRouter>
  );
}
