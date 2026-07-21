/**
 * The report form and the `submit_report` circuit call.
 *
 * The privacy claim this app makes is easy to state and hard to *show*: the
 * report text never leaves the browser, only a proof does. So the submit
 * interaction is built to make that visible — the plaintext is dropped from
 * component state the instant the circuit call begins, and the UI animates the
 * text resolving into its hash. After that point there is no code path that
 * could render the report back, because the string no longer exists.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

import {
  REPORT_CONTENT_BYTES,
  connectToContract,
  type DeployedWhispersContract,
} from '../lib/contract';

type Props = {
  api: ConnectedAPI;
  address: string;
  onSubmitted: () => void;
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'proving'; hash: string }
  | { kind: 'done'; hash: string; txId: string }
  | { kind: 'error'; message: string };

const HEX = '0123456789abcdef';
const randomHex = (length: number) =>
  Array.from({ length }, () => HEX[Math.floor(Math.random() * HEX.length)]).join('');

const toHexString = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Pads or truncates the report to exactly `Bytes<256>` and hashes *the padded
 * buffer* — the padded bytes are what the circuit actually sees, so hashing the
 * raw text instead would produce a hash the proof doesn't attest to. This
 * mirrors the Node path in src/cli.ts byte for byte.
 */
const prepareReport = async (text: string) => {
  const reportContent = new Uint8Array(REPORT_CONTENT_BYTES);
  const encoded = new TextEncoder().encode(text);
  reportContent.set(encoded.subarray(0, REPORT_CONTENT_BYTES));
  const digest = await crypto.subtle.digest('SHA-256', reportContent);
  return { reportContent, contentHash: new Uint8Array(digest) };
};

/**
 * Resolves a scrambling string into `target` from left to right over the life
 * of the proof. Positions that have not locked yet churn through random hex, so
 * the hash appears to condense out of noise rather than simply popping in.
 */
const useScramble = (target: string, active: boolean) => {
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (!active) {
      setDisplay(target);
      return;
    }
    let locked = 0;
    setDisplay(randomHex(target.length));
    const timer = window.setInterval(() => {
      // Never fully resolves on its own: the last characters lock only when
      // proving actually finishes, so the animation can't imply completion
      // before the proof exists.
      locked = Math.min(locked + 1, target.length - 8);
      setDisplay(target.slice(0, locked) + randomHex(target.length - locked));
    }, 90);
    return () => window.clearInterval(timer);
  }, [target, active]);

  return display;
};

export function CircuitCall({ api, address, onSubmitted }: Props) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  // Resolving the deployed contract fetches the prover key and ZKIR, so it is
  // done once per connection and reused across submissions.
  const contractRef = useRef<DeployedWhispersContract | null>(null);
  useEffect(() => {
    contractRef.current = null;
  }, [api, address]);

  const proving = phase.kind === 'proving';
  const scrambled = useScramble(proving ? phase.hash : '', proving);

  const handleSubmit = useCallback(async () => {
    const report = text.trim();
    if (!report) return;

    try {
      const { reportContent, contentHash } = await prepareReport(report);
      const hash = toHexString(contentHash);

      // Drop the plaintext before any await that could render. From here on the
      // report exists only as `reportContent`, a local binding that is never
      // passed to React state and dies with this call.
      setText('');
      setPhase({ kind: 'proving', hash });

      const contract = contractRef.current ?? (await connectToContract(api, address));
      contractRef.current = contract;

      const tx = await contract.callTx.submit_report(contentHash, reportContent);

      setPhase({ kind: 'done', hash, txId: tx.public.txId });
      onSubmitted();
    } catch (error) {
      setPhase({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [text, api, address, onSubmitted]);

  const remaining = REPORT_CONTENT_BYTES - new TextEncoder().encode(text).length;

  if (proving) {
    return (
      <section className="flex min-h-56 flex-col justify-center gap-6 rounded-lg border border-edge bg-surface/40 p-8">
        <p className="animate-flicker text-center text-xs tracking-[0.2em] text-signal uppercase">
          Generating proof
        </p>
        <p className="font-mono text-sm break-all text-signal/90 selection:bg-signal-deep">
          {scrambled}
        </p>
        <p className="text-center text-xs text-muted">
          Your report is being proven inside your wallet. It is not being sent anywhere.
        </p>
      </section>
    );
  }

  if (phase.kind === 'done') {
    return (
      <section className="flex flex-col gap-6 rounded-lg border border-signal-deep/50 bg-surface/40 p-8">
        <div>
          <p className="text-xs tracking-[0.2em] text-signal uppercase">Report submitted</p>
          <p className="mt-4 text-xs text-muted">Content hash</p>
          <p className="mt-1 font-mono text-sm break-all text-bright">{phase.hash}</p>
        </div>

        <div>
          <p className="text-xs text-muted">Transaction</p>
          <p className="mt-1 font-mono text-xs break-all text-dim">{phase.txId}</p>
        </div>

        <p className="flex items-center gap-2 border-t border-edge pt-4 text-xs text-signal">
          <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
          Proved without revealing your input
        </p>

        <button
          type="button"
          onClick={() => setPhase({ kind: 'idle' })}
          className="self-start text-xs text-muted transition-colors hover:text-dim"
        >
          Write another
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={REPORT_CONTENT_BYTES}
        rows={6}
        placeholder="Your report stays yours."
        className="w-full resize-none rounded-lg border border-edge bg-surface/40 p-5 text-sm leading-relaxed text-bright transition-colors outline-none placeholder:text-muted focus:border-edge-lit"
      />

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted">{remaining} bytes left</span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={text.trim().length === 0}
          className="rounded-full border border-signal-deep bg-signal-deep/15 px-5 py-2 text-xs tracking-wide text-signal transition-colors hover:bg-signal-deep/30 disabled:cursor-not-allowed disabled:border-edge disabled:bg-transparent disabled:text-muted"
        >
          Submit anonymously
        </button>
      </div>

      {phase.kind === 'error' && (
        <p className="text-xs text-alert" role="alert">
          {phase.message}
        </p>
      )}
    </section>
  );
}
