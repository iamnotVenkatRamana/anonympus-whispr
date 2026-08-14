/**
 * Recipient keypair generation and hex import/export.
 *
 * Moved verbatim from frontend/src/lib/crypto.ts (Level 4 SDK extraction).
 * See envelope.ts for the sealed-envelope scheme this keypair is used with.
 */
import nacl from 'tweetnacl';

import type { ExportedRecipientKeys, RecipientKeypair } from './types';

/** New inbox identity for an organization. Generated locally, never sent. */
export const generateRecipientKeypair = (): RecipientKeypair => nacl.box.keyPair();

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): Uint8Array => {
  const clean = hex.trim().toLowerCase().replace(/^0x/, '');
  if (clean.length % 2 !== 0 || /[^0-9a-f]/.test(clean)) {
    throw new Error('Not a valid hex string.');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/** Hex form for display, download, and localStorage. */
export const exportRecipientKeys = (keypair: RecipientKeypair): ExportedRecipientKeys => ({
  publicKeyHex: toHex(keypair.publicKey),
  secretKeyHex: toHex(keypair.secretKey),
});

/** Reverse of exportRecipientKeys. Throws on malformed or wrong-length hex. */
export const importRecipientKeys = (
  publicKeyHex: string,
  secretKeyHex: string,
): RecipientKeypair => {
  const publicKey = fromHex(publicKeyHex);
  const secretKey = fromHex(secretKeyHex);
  if (publicKey.length !== nacl.box.publicKeyLength) {
    throw new Error('Public key must be 32 bytes (64 hex characters).');
  }
  if (secretKey.length !== nacl.box.secretKeyLength) {
    throw new Error('Secret key must be 32 bytes (64 hex characters).');
  }
  return { publicKey, secretKey };
};

/**
 * Derives the public key from a secret key, so the inbox can accept a pasted
 * secret key alone and still verify it against the on-chain public key.
 */
export const publicKeyFromSecret = (secretKey: Uint8Array): Uint8Array =>
  nacl.box.keyPair.fromSecretKey(secretKey).publicKey;

export const bytesToHex = toHex;
export const hexToBytes = fromHex;
