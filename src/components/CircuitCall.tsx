/**
 * The report form and the `submit_report` circuit call.
 *
 * The privacy claim this app makes is easy to state and hard to *show*: the
 * report text never leaves the browser, only a proof does. So the submit
 * interaction is built to make that visible: the plaintext is dropped from
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
 * buffer*: the padded bytes are what the circuit actually sees, so hashing the
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

/**
 * Walks an error's `cause` chain and renders every link, so nested SDK
 * failures aren't hidden behind a bare top-level message. Non-Error links
 * (the SDK sometimes chains plain objects) are JSON-serialized with the
 * getOwnPropertyNames trick, since String() on those yields "[object Object]".
 */
const fullErrorText = (error: unknown): string => {
  const describe = (value: unknown): string => {
    if (value instanceof Error) return `${value.name || 'Error'}: ${value.message}`;
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value, Object.getOwnPropertyNames(value));
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const parts: string[] = [];
  const seen = new Set<unknown>();
  for (
    let current: unknown = error;
    current !== undefined && current !== null && !seen.has(current);
    current = current instanceof Error ? current.cause : (current as { cause?: unknown }).cause
  ) {
    seen.add(current);
    parts.push(describe(current));
    if (typeof current !== 'object') break;
  }
  return parts.join(' | caused by | ') || 'Unknown error';
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
      // The raw object, not a string: DevTools renders it as an expandable
      // tree, which is the only reliable view of SDK errors.
      console.error('submit_report failed:', error);
      setPhase({ kind: 'error', message: fullErrorText(error) });
    }
  }, [text, api, address, onSubmitted]);

  const remaining = REPORT_CONTENT_BYTES - new TextEncoder().encode(text).length;

  if (proving) {
    return (
      <section className="relative flex min-h-64 flex-col justify-center gap-7 overflow-hidden rounded-2xl border border-signal-deep/40 bg-surface/50 p-10">
        <div
          className="animate-glow-breathe pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-40 w-3/4 -translate-y-1/2 rounded-full bg-signal/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-center gap-3">
          <span className="animate-pulse-ring size-2.5 rounded-full bg-signal" aria-hidden="true" />
          <p className="animate-flicker text-sm tracking-[0.25em] text-signal uppercase">
            Generating proof
          </p>
        </div>
        <p className="relative font-mono text-base break-all text-signal/90 selection:bg-signal-deep">
          {scrambled}
        </p>
        <p className="relative text-center text-base text-dim">
          Your report is being proven inside your wallet. It is not being sent anywhere.
        </p>
      </section>
    );
  }

  if (phase.kind === 'done') {
    return (
      <section className="card-glow flex flex-col gap-7 rounded-2xl border border-signal-deep/50 bg-surface/50 p-10">
        <div>
          <p className="text-sm tracking-[0.25em] text-signal uppercase">Report submitted</p>
          <p className="mt-6 text-sm text-muted">Content hash</p>
          <p className="mt-1.5 font-mono text-base leading-relaxed break-all text-bright">
            {phase.hash}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted">Transaction</p>
          <p className="mt-1.5 font-mono text-sm leading-relaxed break-all text-dim">
            {phase.txId}
          </p>
        </div>

        <p className="flex items-center gap-3 border-t border-edge pt-6 text-base font-medium text-signal">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="size-6 shrink-0"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="9" className="stroke-signal" strokeWidth="1.5" />
            <path
              d="M6 10.5l2.5 2.5L14 7.5"
              className="stroke-signal"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Proved without revealing your input
        </p>

        <button
          type="button"
          onClick={() => setPhase({ kind: 'idle' })}
          className="self-start rounded-full border border-signal-deep/50 px-5 py-2.5 text-sm text-signal/80 transition-colors hover:bg-signal-deep/20 hover:text-signal"
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
        rows={7}
        placeholder="Your report stays yours."
        className="focus-glow w-full resize-none rounded-2xl border border-edge bg-surface/50 p-7 text-lg leading-relaxed text-bright transition-[border-color,box-shadow] outline-none placeholder:text-muted"
      />

      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-muted">{remaining} bytes left</span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={text.trim().length === 0}
          className="rounded-full bg-signal px-6 py-3 text-sm font-semibold tracking-wide text-void transition-colors hover:bg-signal/85 disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
        >
          Submit anonymously
        </button>
      </div>

      {phase.kind === 'error' && (
        <p className="text-sm leading-relaxed break-all text-alert" role="alert">
          {phase.message}
        </p>
      )}
    </section>
  );
}
