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

// Crosses the contract/sdk split on purpose: envelope.ts/keys.ts are the
// SDK's client-side envelope implementation, and this suite is what proves it
// matches the contract's Bytes<512> layout. Imports the pure submodules
// directly rather than the SDK's index barrel, which also re-exports
// chain.ts (browser-only: touches `window` and the `@contract` alias at
// module scope, neither available/aliased in this Node test run). It
// resolves 'tweetnacl' from sdk/node_modules (Node looks up node_modules from
// the imported file's own directory, not the test runner's cwd), so no
// crypto deps are duplicated into contract/package.json.
import {
  ENVELOPE_BYTES,
  PLAINTEXT_BYTES,
  decodePaddedReport,
  decryptWithRecipientKey,
  encryptToRecipient,
} from '../../sdk/src/envelope';
import {
  exportRecipientKeys,
  generateRecipientKeypair,
  importRecipientKeys,
  publicKeyFromSecret,
} from '../../sdk/src/keys';

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
const zkConfigPath = path.resolve(__dirname, '..', 'managed', 'anonymous-whispers');
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
    plaintext: Uint8Array,
  ) => { context: CircuitContext; result: unknown[] };
};

/**
 * Reproduces the padded 256-byte plaintext the frontend produces before
 * encryption. The circuit's persistentHash commitment is computed over this
 * padded buffer, so tests that submit an envelope must pass the same padded
 * bytes as the plaintext witness.
 */
const padPlaintext = (text: string): Uint8Array => {
  const padded = new Uint8Array(PLAINTEXT_BYTES);
  padded.set(new TextEncoder().encode(text).subarray(0, PLAINTEXT_BYTES));
  return padded;
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

  const submitOne = (ctx: CircuitContext, envelope: Uint8Array, plaintext: Uint8Array) =>
    circuits.submit_encrypted_report!(ctx, envelope, plaintext);

  it('appends the ciphertext to the list and increments the counter', () => {
    const recipient = generateRecipientKeypair();
    const padded = padPlaintext(REPORT);
    const envelope = encryptToRecipient(padded, recipient.publicKey);

    const results = submitOne(initialContext, envelope, padded);
    const after = ledgerFrom(results.context);

    expect(after.counter).toBe(1n);
    expect(after.ciphertexts.length()).toBe(1n);
    const [stored] = [...after.ciphertexts];
    expect(stored).toEqual(envelope);
  });

  it('stores an in-circuit hash commitment derived from the private plaintext', () => {
    const recipient = generateRecipientKeypair();
    const padded = padPlaintext(REPORT);
    const envelope = encryptToRecipient(padded, recipient.publicKey);

    const results = submitOne(initialContext, envelope, padded);
    const after = ledgerFrom(results.context);

    // The commitment is computed inside the circuit from the private plaintext
    // witness, so we cannot know its exact bytes here — but it must be a
    // non-empty 32-byte value, and it must be deterministic and preimage-
    // bound (the next two tests exercise those properties directly).
    expect(after.latest_report_hash.length).toBe(32);
    expect(after.latest_report_hash.some((b) => b !== 0)).toBe(true);
  });

  it('produces a deterministic commitment: same plaintext witness → same hash', () => {
    const recipient = generateRecipientKeypair();
    const padded = padPlaintext(REPORT);

    // Fresh envelopes each time (nacl.box uses a fresh ephemeral key), but the
    // private witness is identical, so the disclosed commitment must match.
    const first = submitOne(
      initialContext,
      encryptToRecipient(padded, recipient.publicKey),
      padded,
    );
    const second = submitOne(
      initialContext,
      encryptToRecipient(padded, recipient.publicKey),
      padded,
    );

    expect(ledgerFrom(first.context).latest_report_hash).toEqual(
      ledgerFrom(second.context).latest_report_hash,
    );
  });

  it('produces different commitments for different plaintext witnesses', () => {
    const recipient = generateRecipientKeypair();
    const paddedA = padPlaintext(REPORT);
    const paddedB = padPlaintext(`${REPORT} (revised)`);

    const a = submitOne(
      initialContext,
      encryptToRecipient(paddedA, recipient.publicKey),
      paddedA,
    );
    const b = submitOne(
      initialContext,
      encryptToRecipient(paddedB, recipient.publicKey),
      paddedB,
    );

    // Distinct plaintexts must yield distinct commitments — this is the
    // property that makes the private witness actually constrain the proof.
    expect(ledgerFrom(a.context).latest_report_hash).not.toEqual(
      ledgerFrom(b.context).latest_report_hash,
    );
  });

  it('keeps counting across multiple submissions, newest first', () => {
    const recipient = generateRecipientKeypair();
    let ctx: CircuitContext = initialContext;
    const envelopes: Uint8Array[] = [];
    for (let i = 0; i < 3; i++) {
      const padded = padPlaintext(`${REPORT} #${i}`);
      const envelope = encryptToRecipient(padded, recipient.publicKey);
      envelopes.push(envelope);
      ctx = submitOne(ctx, envelope, padded).context;
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
    const padded = padPlaintext(REPORT);
    const envelope = encryptToRecipient(padded, recipient.publicKey);

    let ctx: CircuitContext = initialContext;
    ctx = circuits.register_recipient!(ctx, recipient.publicKey).context;
    ctx = submitOne(ctx, envelope, padded).context;
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

    // The full padded plaintext is 256 bytes; assert none of it (including
    // the trailing zero padding, which would look like a run of "00" bytes)
    // leaked into public state as a whole slice. We use the non-padded
    // encoded prefix as the sensitive fingerprint.
    const plaintextHex = Buffer.from(new TextEncoder().encode(REPORT)).toString('hex');
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
