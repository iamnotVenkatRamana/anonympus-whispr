/**
 * The contract's public state: everything the chain actually knows.
 *
 * Shown deliberately: the counter and the latest hash are the *complete* public
 * record of a report. Putting them next to the form makes the boundary concrete,
 * since what is visible here is all that any observer gets.
 *
 * Read straight from the indexer, so it needs no wallet and renders before the
 * user connects.
 */
import { useCallback, useEffect, useState } from 'react';

import { readPublicState, type PublicState } from '../lib/contract';

const toHexString = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const EMPTY_HASH = /^0*$/;

type Props = {
  /** Bumped by the parent after a submission so the counter refetches. */
  refreshToken: number;
};

export function PublicLedger({ refreshToken }: Props) {
  const [state, setState] = useState<PublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setState(await readPublicState());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const latestHash = state ? toHexString(state.latestReportHash) : '';
  const hasReport = state !== null && !EMPTY_HASH.test(latestHash);

  return (
    <section className="rounded-b-2xl border-t-2 border-edge-lit bg-surface/70 p-8">
      <h2 className="text-sm tracking-[0.25em] text-signal uppercase">On-chain record</h2>

      {loading && <p className="mt-5 text-base text-muted">Reading public state...</p>}

      {error && (
        <p className="mt-5 text-base text-warn">
          Could not reach the Preview indexer. {error}
        </p>
      )}

      {state && (
        <div className="mt-7 flex flex-col gap-7">
          <div>
            <p className="text-sm text-muted">Reports submitted</p>
            <p className="mt-2 font-serif text-7xl font-medium text-signal tabular-nums">
              {state.counter.toString()}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted">Latest report hash</p>
            <p className="mt-2 font-mono text-sm leading-relaxed break-all text-dim">
              {hasReport ? latestHash : 'None yet'}
            </p>
          </div>

          <p className="border-t border-edge pt-6 text-base leading-relaxed text-muted">
            This is the entire public record. Report contents are never written to the
            chain, so they cannot be read back, not by us, not by anyone.
          </p>
        </div>
      )}
    </section>
  );
}
