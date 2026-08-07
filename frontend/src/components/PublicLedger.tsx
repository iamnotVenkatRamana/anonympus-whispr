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

import { readPublicState, type PublicState } from '@anonymous-whispers/sdk';

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
    <section className="surface-dark p-8">
      <h2 className="eyebrow eyebrow-dark">on-chain record</h2>

      {loading && <p className="mt-5 text-base text-white/55">Reading public state...</p>}

      {error && (
        /*
          The live failure state. Message text and the surrounding condition are
          unchanged; only the box around them is new. The indexer's own string
          is machine output, so it is set in mono under the prose line.
        */
        <div className="notice-quiet mt-5 px-5 py-4" role="alert">
          <p className="text-base font-medium text-white">Could not reach the indexer.</p>
          <p className="mono mt-2 text-[12px] leading-relaxed break-words text-white/60">
            {error}
          </p>
        </div>
      )}

      {!loading && !error && state === null && (
        <p className="mt-5 text-base leading-relaxed text-white/55">
          Contract not found on this network yet. It appears here once the Level 3
          deployment lands.
        </p>
      )}

      {state && (
        <div className="mt-7 flex flex-col gap-7">
          <div>
            <p className="eyebrow eyebrow-dark">reports submitted</p>
            <p className="display mt-3 text-7xl font-semibold text-white tabular-nums">
              {state.counter.toString()}
            </p>
          </div>

          <div>
            <p className="eyebrow eyebrow-dark">latest report hash</p>
            <p className="mono mt-3 text-sm leading-relaxed break-all text-white/70">
              {hasReport ? latestHash : 'None yet'}
            </p>
          </div>

          <p
            className="border-t border-white/10 pt-6 text-base leading-relaxed"
            style={{ color: 'var(--muted-dark)' }}
          >
            This is the entire public record. Report contents are never written to the
            chain, so they cannot be read back, not by us, not by anyone.
          </p>
        </div>
      )}
    </section>
  );
}
