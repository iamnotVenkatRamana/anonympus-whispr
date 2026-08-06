/**
 * Reporter view: fetches the organization's registered recipient key and, when
 * one exists, lets the reporter encrypt and submit a report to it.
 */
import { useCallback, useEffect, useState } from 'react';

import { EncryptedReportForm } from '../components/EncryptedReportForm';
import { PublicLedger } from '../components/PublicLedger';
import type { WalletConnection } from '../components/WalletConnect';
import { bytesToHex } from '../lib/crypto';
import { readPublicState, type PublicState } from '../lib/contract';

type Props = {
  connection: WalletConnection | null;
};

const truncateKey = (hex: string) => `${hex.slice(0, 6)}...${hex.slice(-4)}`;

export function Report({ connection }: Props) {
  const [state, setState] = useState<PublicState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    readPublicState()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const handleSubmitted = useCallback(() => setRefreshToken((token) => token + 1), []);

  const recipientKey = state?.recipientPublicKey ?? null;
  const recipientKeyHex = recipientKey ? bytesToHex(recipientKey) : null;

  const handleCopyKey = useCallback(async () => {
    if (!recipientKeyHex) return;
    await navigator.clipboard.writeText(recipientKeyHex);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [recipientKeyHex]);

  return (
    <>
      {loading && (
        <section className="rounded-2xl border border-edge bg-surface/30 p-10">
          <p className="text-base text-muted">Checking for a registered recipient...</p>
        </section>
      )}

      {!loading && !recipientKey && (
        <section className="rounded-2xl border border-dashed border-edge-lit bg-surface/30 p-12 text-center">
          <p className="text-lg text-bright">
            This organization hasn't set up a recipient yet.
          </p>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-dim">
            Reports are encrypted to the organization's public key, and none has been
            registered on-chain. Contact the organization and ask them to set up their
            inbox before submitting.
          </p>
        </section>
      )}

      {!loading && recipientKeyHex && (
        <>
          <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-edge bg-surface/50 px-7 py-5">
            <p className="text-sm text-muted">Encrypting to recipient key</p>
            <p className="font-mono text-sm text-signal/90" title={recipientKeyHex}>
              {truncateKey(recipientKeyHex)}
            </p>
            <span className="text-sm text-muted">
              v{state?.recipientKeyVersion.toString()}
            </span>
            <button
              type="button"
              onClick={handleCopyKey}
              className="rounded-lg border border-signal/15 px-3 py-1.5 text-sm text-signal/60 transition-colors hover:border-signal/40 hover:text-signal"
            >
              {copied ? 'Copied' : 'Copy full key'}
            </button>
            <p className="w-full text-sm leading-relaxed text-muted">
              Verify this key with the organization through another channel before
              submitting anything sensitive.
            </p>
          </section>

          {connection ? (
            <EncryptedReportForm
              api={connection.api}
              address={connection.address}
              recipientPublicKey={recipientKey!}
              onSubmitted={handleSubmitted}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-edge-lit bg-surface/30 p-12 text-center">
              <p className="text-lg text-bright">Connect a wallet to submit a report.</p>
              <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-dim">
                Your report is encrypted in this browser before anything is sent. The
                chain only ever carries the sealed envelope; the text itself is never
                transmitted, stored, or logged in readable form.
              </p>
            </section>
          )}
        </>
      )}

      <PublicLedger refreshToken={refreshToken} />
    </>
  );
}
