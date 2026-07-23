/**
 * Level 3 test suite: two-way encrypted whistleblowing.
 *
 * Two layers, deliberately separated:
 *
 *   1. Crypto tests: always run. Pure tweetnacl, no compiled contract needed.
 *      They prove the envelope scheme round-trips, rejects wrong keys, and
 *      keeps the fixed 512-byte layout the contract expects.
 *
 *   2. Circuit tests: exercise register_recipient and submit_encrypted_report
 *      against the compiled Compact contract, exactly like the Level 1/2
 *      suite in anonymous-whispers.test.ts. They are skipped automatically
 *      when contracts/managed still holds a pre-Level-3 build (the Compact
 *      toolchain ships no Windows binary; CI compiles on Ubuntu and runs
 *      them there).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Contract, Ledger } from '@midnight-ntwrk/compact-runtime';
import {
  createCircuitContext,
  createConstructorContext,
  dummyContractAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';

import {
  ENVELOPE_BYTES,
  PLAINTEXT_BYTES,
  decodePaddedReport,
  decryptWithRecipientKey,
  encryptToRecipient,
  exportRecipientKeys,
  generateRecipientKeypair,
  importRecipientKeys,
  publicKeyFromSecret,
} from '../src/lib/crypto';

// ─── Crypto layer ────────────────────────────────────────────────────────────

describe('crypto: nacl.box envelope scheme', () => {
  const encode = (text: string) => new TextEncoder().encode(text);

  it('round-trips: encrypt to recipient, decrypt with matching secret key', () => {
    const recipient = generateRecipientKeypair();
    const report = 'The night shift has been dumping solvent into the storm drain.';

    const envelope = encryptToRecipient(encode(report), recipient.publicKey);
    const padded = decryptWithRecipientKey(envelope, recipient.secretKey);

    expect(padded).not.toBeNull();
    expect(padded!.length).toBe(PLAINTEXT_BYTES);
    expect(decodePaddedReport(padded!)).toBe(report);
  });

  it('returns null (not an exception) for a mismatched secret key', () => {
    const recipient = generateRecipientKeypair();
    const intruder = generateRecipientKeypair();

    const envelope = encryptToRecipient(encode('sensitive'), recipient.publicKey);

    expect(decryptWithRecipientKey(envelope, intruder.secretKey)).toBeNull();
  });

  it('returns null for corrupt ciphertext', () => {
    const recipient = generateRecipientKeypair();
    const envelope = encryptToRecipient(encode('sensitive'), recipient.publicKey);
    envelope[100] ^= 0xff; // flip a byte inside the box

    expect(decryptWithRecipientKey(envelope, recipient.secretKey)).toBeNull();
  });

  it('produces fixed 512-byte envelopes that never contain the plaintext', () => {
    const recipient = generateRecipientKeypair();
    const report = 'AAAA-recognizable-plaintext-AAAA';

    const envelope = encryptToRecipient(encode(report), recipient.publicKey);

    expect(envelope.length).toBe(ENVELOPE_BYTES);
    const envelopeHex = Buffer.from(envelope).toString('hex');
    const plaintextHex = Buffer.from(encode(report)).toString('hex');
    expect(envelopeHex).not.toContain(plaintextHex);
  });

  it('uses a fresh ephemeral sender key per call, so envelopes never correlate', () => {
    const recipient = generateRecipientKeypair();
    const a = encryptToRecipient(encode('same text'), recipient.publicKey);
    const b = encryptToRecipient(encode('same text'), recipient.publicKey);

    // Bytes [0..32) are the ephemeral public key; identical keys would let the
    // recipient (or anyone) link two submissions to one sender session.
    expect(Buffer.from(a.subarray(0, 32))).not.toEqual(Buffer.from(b.subarray(0, 32)));
  });

  it('export/import round-trips recipient keys through hex', () => {
    const keypair = generateRecipientKeypair();
    const exported = exportRecipientKeys(keypair);
    const imported = importRecipientKeys(exported.publicKeyHex, exported.secretKeyHex);

    expect(imported.publicKey).toEqual(keypair.publicKey);
    expect(imported.secretKey).toEqual(keypair.secretKey);
    expect(publicKeyFromSecret(imported.secretKey)).toEqual(keypair.publicKey);
  });
});

// ─── Circuit layer ───────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'anonymous-whispers');
const contractUrl = pathToFileURL(path.join(zkConfigPath, 'contract', 'index.js')).href;

const compiledModule = (await import(contractUrl)) as {
  Contract: new (witnesses: Record<string, never>) => Contract<Record<string, never>>;
  ledger: (state: unknown) => Ledger;
};

const contract = new compiledModule.Contract({});
const ledgerProjector = compiledModule.ledger;

/** Level 3 additions to the generated ledger projection, read structurally. */
type Level3Ledger = Ledger & {
  recipient_public_key: Uint8Array;
  recipient_key_version: bigint;
  ciphertexts: Iterable<Uint8Array> & { length(): bigint };
};

/** Level 3 circuits, read structurally for the same recompile reason. */
type Level3Circuits = {
  register_recipient: (
    ctx: CircuitContext,
    key: Uint8Array,
  ) => { context: CircuitContext; result: unknown[] };
  submit_encrypted_report: (
    ctx: CircuitContext,
    ciphertext: Uint8Array,
    hash: Uint8Array,
  ) => { context: CircuitContext; result: unknown[] };
};

const circuits = contract.circuits as typeof contract.circuits & Partial<Level3Circuits>;
const hasLevel3Circuits =
  typeof circuits.register_recipient === 'function' &&
  typeof circuits.submit_encrypted_report === 'function';

function ledgerFrom(context: CircuitContext): Level3Ledger {
  return ledgerProjector(context.currentQueryContext.state) as Level3Ledger;
}

let initialContext: CircuitContext<Record<string, never>>;

beforeAll(() => {
  const constructorContext = createConstructorContext({}, new Uint8Array(32));
  const initial = contract.initialState(constructorContext);
  initialContext = createCircuitContext(
    dummyContractAddress(),
    initial.currentZswapLocalState,
    initial.currentContractState,
    initial.currentPrivateState,
  );
});

describe.skipIf(!hasLevel3Circuits)('circuit: register_recipient', () => {
  it('replaces the zero key with the registered public key', () => {
    const recipient = generateRecipientKeypair();

    const before = ledgerFrom(initialContext);
    expect(before.recipient_public_key.every((b) => b === 0)).toBe(true);
    expect(before.recipient_key_version).toBe(0n);

    const results = circuits.register_recipient!(initialContext, recipient.publicKey);
    const after = ledgerFrom(results.context);

    expect(after.recipient_public_key).toEqual(recipient.publicKey);
    expect(after.recipient_key_version).toBe(1n);
  });

  it('bumps the version on every overwrite so reporters can detect rotation', () => {
    const first = generateRecipientKeypair();
    const second = generateRecipientKeypair();

    let ctx: CircuitContext = initialContext;
    ctx = circuits.register_recipient!(ctx, first.publicKey).context;
    ctx = circuits.register_recipient!(ctx, second.publicKey).context;

    const after = ledgerFrom(ctx);
    expect(after.recipient_public_key).toEqual(second.publicKey);
    expect(after.recipient_key_version).toBe(2n);
  });
});

describe.skipIf(!hasLevel3Circuits)('circuit: submit_encrypted_report', () => {
  const REPORT = 'Falsified inspection records in warehouse 4, March through May.';

  const submitOne = (ctx: CircuitContext, envelope: Uint8Array) => {
    const hash = new Uint8Array(32).fill(0x5c); // stand-in commitment
    return circuits.submit_encrypted_report!(ctx, envelope, hash);
  };

  it('appends the ciphertext to the list and increments the counter', () => {
    const recipient = generateRecipientKeypair();
    const envelope = encryptToRecipient(new TextEncoder().encode(REPORT), recipient.publicKey);

    const results = submitOne(initialContext, envelope);
    const after = ledgerFrom(results.context);

    expect(after.counter).toBe(1n);
    expect(after.ciphertexts.length()).toBe(1n);
    const [stored] = [...after.ciphertexts];
    expect(stored).toEqual(envelope);
  });

  it('stores the ciphertext hash as the public commitment', () => {
    const recipient = generateRecipientKeypair();
    const envelope = encryptToRecipient(new TextEncoder().encode(REPORT), recipient.publicKey);
    const hash = new Uint8Array(32).fill(0x5c);

    const results = circuits.submit_encrypted_report!(initialContext, envelope, hash);
    expect(ledgerFrom(results.context).latest_report_hash).toEqual(hash);
  });

  it('keeps counting across multiple submissions, newest first', () => {
    const recipient = generateRecipientKeypair();
    let ctx: CircuitContext = initialContext;
    const envelopes: Uint8Array[] = [];
    for (let i = 0; i < 3; i++) {
      const envelope = encryptToRecipient(
        new TextEncoder().encode(`${REPORT} #${i}`),
        recipient.publicKey,
      );
      envelopes.push(envelope);
      ctx = submitOne(ctx, envelope).context;
    }

    const after = ledgerFrom(ctx);
    expect(after.counter).toBe(3n);
    expect(after.ciphertexts.length()).toBe(3n);
    // pushFront means iteration order is newest first.
    expect([...after.ciphertexts][0]).toEqual(envelopes[2]);
  });

  it('never exposes the plaintext or the recipient secret key on the ledger, and the stored ciphertext decrypts only for the recipient', () => {
    const recipient = generateRecipientKeypair();
    const stranger = generateRecipientKeypair();
    const plaintext = new TextEncoder().encode(REPORT);
    const envelope = encryptToRecipient(plaintext, recipient.publicKey);

    let ctx: CircuitContext = initialContext;
    ctx = circuits.register_recipient!(ctx, recipient.publicKey).context;
    ctx = submitOne(ctx, envelope).context;
    const after = ledgerFrom(ctx);

    // Serialize everything public and assert the sensitive bytes are absent.
    const serialised = Buffer.from(
      JSON.stringify(
        {
          ...after,
          ciphertexts: [...after.ciphertexts].map((c) => Buffer.from(c).toString('hex')),
        },
        (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
      ),
    ).toString('hex');

    const plaintextHex = Buffer.from(plaintext).toString('hex');
    const secretKeyHex = Buffer.from(recipient.secretKey).toString('hex');
    expect(serialised).not.toContain(plaintextHex);
    expect(serialised).not.toContain(secretKeyHex);

    // The public ciphertext is useless without the secret key...
    const [stored] = [...after.ciphertexts];
    expect(decryptWithRecipientKey(stored, stranger.secretKey)).toBeNull();

    // ...and yields the exact report for its holder.
    const opened = decryptWithRecipientKey(stored, recipient.secretKey);
    expect(opened).not.toBeNull();
    expect(decodePaddedReport(opened!)).toBe(REPORT);
  });
});
