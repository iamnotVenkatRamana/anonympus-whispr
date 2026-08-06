/**
 * Level 3 report form: encrypts to the recipient's key and calls the
 * `submit_encrypted_report` circuit.
 *
 * Modeled on CircuitCall.tsx (the Level 2 hash-only flow, which stays in the
 * tree untouched for backward compatibility). The privacy mechanics here are
 * stronger and worth stating: the plaintext is encrypted with nacl.box under a
 * fresh ephemeral sender key, the plaintext string is dropped from component
 * state before the circuit call begins, and the only things that leave the
 * browser are the sealed 512-byte envelope and its SHA-256 hash.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

import {
  REPORT_CONTENT_BYTES,
  connectToContract,
  level3CallTx,
  type DeployedWhispersContract,
} from '../lib/contract';
import { encryptToRecipient } from '../lib/crypto';

type Props = {
  api: ConnectedAPI;
  address: string;
  recipientPublicKey: Uint8Array;
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
 * Encrypts the report and hashes the resulting envelope. The hash covers the
 * ENVELOPE (what the chain stores), not the plaintext: anyone can re-hash the
 * public ciphertext to verify the commitment, and the plaintext hash would
 * leak an oracle for guessing short reports.
 */
const prepareEncryptedReport = async (text: string, recipientPublicKey: Uint8Array) => {
  const encoded = new TextEncoder().encode(text).subarray(0, REPORT_CONTENT_BYTES);
  const envelope = encryptToRecipient(encoded, recipientPublicKey);
  const digest = await crypto.subtle.digest('SHA-256', envelope);
  return { envelope, envelopeHash: new Uint8Array(digest) };
};

/** Same resolve-out-of-noise animation as the Level 2 form. */
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
      locked = Math.min(locked + 1, target.length - 8);
      setDisplay(target.slice(0, locked) + randomHex(target.length - locked));
    }, 90);
    return () => window.clearInterval(timer);
  }, [target, active]);

  return display;
};

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

export function EncryptedReportForm({ api, address, recipientPublicKey, onSubmitted }: Props) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

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
      const { envelope, envelopeHash } = await prepareEncryptedReport(
        report,
        recipientPublicKey,
      );
      const hash = toHexString(envelopeHash);

      // Drop the plaintext before any await that could render, exactly as the
      // Level 2 form does. From here on the report exists only inside the
      // sealed envelope.
      setText('');
      setPhase({ kind: 'proving', hash });

      const contract = contractRef.current ?? (await connectToContract(api, address));
      contractRef.current = contract;

      const tx = await level3CallTx(contract).submit_encrypted_report(envelope, envelopeHash);

      setPhase({ kind: 'done', hash, txId: tx.public.txId });
      onSubmitted();
    } catch (error) {
      console.error('submit_encrypted_report failed:', error);
      setPhase({ kind: 'error', message: fullErrorText(error) });
    }
  }, [text, api, address, recipientPublicKey, onSubmitted]);

  const remaining = REPORT_CONTENT_BYTES - new TextEncoder().encode(text).length;

  if (proving) {
    return (
      <section className="flex min-h-64 flex-col justify-center gap-7 rounded-2xl border border-edge bg-surface/70 p-10">
        <div className="mx-auto flex flex-col items-center gap-2">
          <p className="text-sm tracking-[0.25em] text-signal uppercase">
            Encrypting and proving
          </p>
          <span className="gold-shimmer h-px w-48" aria-hidden="true" />
        </div>
        <p className="font-mono text-base break-all text-signal/90 selection:bg-signal-deep">
          {scrambled}
        </p>
        <p className="text-center text-base text-dim">
          Your report was sealed to the recipient's key in this browser. Only the
          envelope is being published.
        </p>
      </section>
    );
  }

  if (phase.kind === 'done') {
    return (
      <section className="flex flex-col gap-7 rounded-b-lg border-t border-signal/40 bg-surface/50 p-10">
        <div>
          <p className="text-sm tracking-[0.25em] text-signal uppercase">Report submitted</p>
          <p className="mt-6 text-sm text-muted">Ciphertext hash (auditable commitment)</p>
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
          <svg viewBox="0 0 20 20" fill="none" className="size-6 shrink-0" aria-hidden="true">
            <circle cx="10" cy="10" r="9" className="stroke-signal" strokeWidth="1.5" />
            <path
              d="M6 10.5l2.5 2.5L14 7.5"
              className="stroke-signal"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Sealed to the recipient. Unreadable to everyone else, including us.
        </p>

        <button
          type="button"
          onClick={() => setPhase({ kind: 'idle' })}
          className="self-start rounded-lg border border-signal/15 px-4 py-2 text-sm text-signal/60 transition-colors hover:border-signal/40 hover:text-signal"
        >
          Write another
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 py-6">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={REPORT_CONTENT_BYTES}
        rows={7}
        placeholder="Your report stays yours."
        className="focus-glow w-full resize-none rounded-2xl border border-edge bg-transparent p-7 text-lg leading-relaxed text-bright transition-[border-color,box-shadow] outline-none placeholder:font-serif placeholder:italic placeholder:text-muted"
      />

      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-muted">{remaining} bytes left</span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={text.trim().length === 0}
          className="rounded-lg bg-signal px-6 py-3 text-sm font-semibold tracking-wide text-void transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
        >
          Encrypt and submit
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
