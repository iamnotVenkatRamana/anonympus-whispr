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
  PLAINTEXT_BYTES,
  connectToContract,
  encryptToRecipient,
  level3CallTx,
  type DeployedWhispersContract,
} from '@anonymous-whispers/sdk';

import { fullErrorText } from '../lib/errorText';

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
 * Encrypts the report and returns both the sealed envelope AND the padded
 * plaintext used to build it. The plaintext is fed into the circuit as a
 * PRIVATE witness: the circuit's persistentHash commitment (disclosed as
 * latest_report_hash) is derived from these exact 256 bytes, so the two must
 * be byte-for-byte the same input that went into nacl.box. The plaintext
 * never leaves the browser as data — it is consumed by the local prover to
 * generate a ZK proof and discarded.
 *
 * `envelopeDigest` is also computed here purely so the UI can display a
 * stable browser-visible hash while proving; it is not sent to the chain.
 */
const prepareEncryptedReport = async (text: string, recipientPublicKey: Uint8Array) => {
  const padded = new Uint8Array(PLAINTEXT_BYTES);
  padded.set(new TextEncoder().encode(text).subarray(0, PLAINTEXT_BYTES));
  const envelope = encryptToRecipient(padded, recipientPublicKey);
  const digest = await crypto.subtle.digest('SHA-256', envelope);
  return { envelope, plaintext: padded, envelopeDigest: new Uint8Array(digest) };
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
      const { envelope, plaintext, envelopeDigest } = await prepareEncryptedReport(
        report,
        recipientPublicKey,
      );
      const hash = toHexString(envelopeDigest);

      // Drop the plaintext string from React state before any await that could
      // render. The padded `plaintext` binding below is a local Uint8Array
      // that never enters state; it is handed straight to the ZK prover as a
      // private witness and goes out of scope with this call.
      setText('');
      setPhase({ kind: 'proving', hash });

      const contract = contractRef.current ?? (await connectToContract(api, address));
      contractRef.current = contract;

      // Second argument is the PRIVATE witness the circuit uses to derive its
      // in-circuit persistentHash commitment. It is a proof input, not a
      // ledger input — the chain never sees these bytes.
      const tx = await level3CallTx(contract).submit_encrypted_report(envelope, plaintext);

      setPhase({ kind: 'done', hash, txId: tx.public.txId });
      onSubmitted();
    } catch (error) {
      console.error('submit_encrypted_report failed:', error);
      setPhase({ kind: 'error', message: fullErrorText(error) });
    }
  }, [text, api, address, recipientPublicKey, onSubmitted]);

  const remaining = PLAINTEXT_BYTES - new TextEncoder().encode(text).length;

  if (proving) {
    return (
      <section className="surface-dark flex min-h-64 flex-col justify-center gap-7 p-10">
        <div className="mx-auto flex flex-col items-center gap-3">
          <p className="eyebrow eyebrow-dark">encrypting and proving</p>
          <span className="shimmer-light h-px w-48" aria-hidden="true" />
        </div>
        <p className="mono text-base break-all text-white/90">{scrambled}</p>
        <p
          className="text-center text-base leading-relaxed"
          style={{ color: 'var(--muted-dark)' }}
        >
          Your report was sealed to the recipient's key in this browser. Only the
          envelope is being published.
        </p>
      </section>
    );
  }

  if (phase.kind === 'done') {
    return (
      <section className="surface-dark flex flex-col gap-7 p-10">
        <div>
          <p className="eyebrow eyebrow-dark">report submitted</p>
          <p className="mt-6 text-sm text-white/50">Ciphertext hash (auditable commitment)</p>
          <p className="mono mt-2 text-base leading-relaxed break-all text-white">
            {phase.hash}
          </p>
        </div>

        <div>
          <p className="text-sm text-white/50">Transaction</p>
          <p className="mono mt-2 text-sm leading-relaxed break-all text-white/70">
            {phase.txId}
          </p>
        </div>

        <p className="flex items-center gap-3 border-t border-white/10 pt-6 text-base font-medium text-white">
          <svg viewBox="0 0 20 20" fill="none" className="size-6 shrink-0" aria-hidden="true">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M6 10.5l2.5 2.5L14 7.5"
              stroke="currentColor"
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
          className="btn-quiet focus-ring self-start px-5 py-2 text-sm"
        >
          Write another
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={PLAINTEXT_BYTES}
        rows={7}
        placeholder="Your report stays yours."
        className="field w-full resize-none p-7 text-lg leading-relaxed"
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="mono text-sm text-white/50">{remaining} bytes left</span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={text.trim().length === 0}
          className="btn-solid focus-ring px-6 py-3 text-sm"
        >
          Encrypt and submit
        </button>
      </div>

      {phase.kind === 'error' && (
        /*
          The message is fullErrorText output, i.e. a chain of wallet and SDK
          error strings. Mono, because that is what it is, and break-all so a
          long cause chain cannot widen the page.
        */
        <p
          className="notice-quiet mono px-5 py-4 text-[12px] leading-relaxed break-all text-white/80"
          role="alert"
        >
          {phase.message}
        </p>
      )}
    </section>
  );
}
