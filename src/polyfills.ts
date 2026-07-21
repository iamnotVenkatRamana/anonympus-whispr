/**
 * Browser shims for Node globals the Midnight SDK reaches for at runtime.
 *
 * The submit path fails with "ReferenceError: Buffer is not defined" without
 * this: something in the transaction-serialization path uses Node's Buffer
 * global, which browsers don't provide. The `buffer` npm package (already a
 * transitive dependency) is the standard drop-in.
 *
 * This lives in its own module — imported first from src/main.tsx — because
 * ES import hoisting evaluates a module's entire import graph before its own
 * statements run. An inline assignment in main.tsx would execute after every
 * SDK module had already initialized.
 */
import { Buffer } from 'buffer';

if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
}
