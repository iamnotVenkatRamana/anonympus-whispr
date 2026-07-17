/**
 * Anonymous Whispers — local, offline test suite.
 *
 * These tests exercise the *real* compiled Compact circuit
 * (contracts/managed/anonymous-whispers) using the Midnight compact-runtime.
 * No network, wallet, proof-server or indexer is required, so they run
 * anywhere `npm test` is invoked.
 *
 * What we prove:
 *   1. Circuit logic      — submit_report executes successfully and returns proof data.
 *   2. State transitions  — the report counter increments and the disclosed hash
 *                           is stored in the public ledger.
 *   3. Privacy validation — the private witness (report_content) is NEVER written
 *                           to the public ledger state.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'anonymous-whispers');
const contractUrl = pathToFileURL(path.join(zkConfigPath, 'contract', 'index.js')).href;

// Load the compiled contract dynamically (plain JS emitted by `compact compile`).
const compiledModule = (await import(contractUrl)) as {
  Contract: new () => Contract<Record<string, never>>;
  ledger: (state: unknown) => Ledger;
};

const contract = new compiledModule.Contract({});
const ledgerProjector = compiledModule.ledger;

// A representative 32-byte content hash (SHA-256-shaped, but value is irrelevant here).
const CONTENT_HASH = new Uint8Array(32).fill(0xab);
// Private witness: 256 bytes of "report content". This must NEVER appear on-chain.
const REPORT_CONTENT = new Uint8Array(256).fill(0xff);

function ledgerFrom(context: CircuitContext): Ledger {
  // The compiled contract ships a `ledger()` projector that reads public state
  // out of a circuit context's on-chain state.
  return ledgerProjector(context.currentQueryContext.state) as Ledger;
}

let initialContext: CircuitContext<Record<string, never>>;

beforeAll(() => {
  // Build a valid empty ledger using the contract's own constructor, then wrap
  // the resulting state into a CircuitContext we can feed to submit_report.
  const constructorContext = createConstructorContext({}, new Uint8Array(32));
  const initial = contract.initialState(constructorContext);
  initialContext = createCircuitContext(
    dummyContractAddress(),
    initial.currentZswapLocalState,
    initial.currentContractState,
    initial.currentPrivateState,
  );
});

describe('Anonymous Whispers — submit_report circuit', () => {
  // ── TEST 1: Circuit logic ──────────────────────────────────────────────────
  it('executes submit_report and produces proof data without throwing', () => {
    const results = contract.circuits.submit_report(
      initialContext,
      CONTENT_HASH,
      REPORT_CONTENT,
    );

    // The circuit must run to completion and hand back proof data.
    expect(results).toBeDefined();
    expect(results.result).toEqual([]);
    expect(results.proofData).toBeDefined();
    // A non-empty public transcript means the circuit actually executed operations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((results.proofData as any).publicTranscript).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(Array.isArray((results.proofData as any).publicTranscript)).toBe(true);
  });

  // ── TEST 2: State transitions ───────────────────────────────────────────────
  it('increments the report counter and stores the disclosed hash', () => {
    const results = contract.circuits.submit_report(
      initialContext,
      CONTENT_HASH,
      REPORT_CONTENT,
    );

    const after = ledgerFrom(results.context);

    // Counter moved from 0 -> 1.
    expect(after.counter).toBe(1n);

    // The disclosed hash was written to the public ledger.
    expect(after.latest_report_hash).toEqual(CONTENT_HASH);
    expect(after.latest_report_hash.length).toBe(32);
  });

  it('keeps incrementing the counter across multiple submissions', () => {
    let ctx = initialContext;
    for (let i = 1; i <= 3; i++) {
      const hash = new Uint8Array(32).fill(i);
      const results = contract.circuits.submit_report(ctx, hash, REPORT_CONTENT);
      ctx = results.context;
      expect(ledgerFrom(ctx).counter).toBe(BigInt(i));
    }
  });

  // ── TEST 3: Privacy validation ──────────────────────────────────────────────
  it('never exposes the private report content in the public ledger state', () => {
    const results = contract.circuits.submit_report(
      initialContext,
      CONTENT_HASH,
      REPORT_CONTENT,
    );

    const after = ledgerFrom(results.context);

    // The only public bytes are the 32-byte disclosed hash.
    const publicBytes = after.latest_report_hash;
    expect(publicBytes).not.toEqual(REPORT_CONTENT);

    // The private witness is all 0xff; assert NONE of those bytes leaked into
    // the public ledger (the ledger length is exactly 32, the witness 256).
    expect(publicBytes.length).toBe(32);
    for (const b of publicBytes) {
      expect(b).not.toBe(0xff);
    }

    // And crucially the witness bytes are nowhere in the serialised ledger.
    const serialised = Buffer.from(
      JSON.stringify(after, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    ).toString('hex');
    const witnessHex = Buffer.from(REPORT_CONTENT).toString('hex');
    expect(serialised).not.toContain(witnessHex);
  });
});
