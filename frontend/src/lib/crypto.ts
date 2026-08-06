/**
 * Client-side asymmetric encryption for the two-way whistleblowing flow.
 *
 * Scheme: nacl.box (curve25519-xsalsa20-poly1305) with a FRESH ephemeral
 * sender keypair per submission. tweetnacl has no libsodium-style sealed box,
 * so this is the standard emulation: generate an ephemeral keypair, box with
 * it, prepend its public key to the envelope, and drop its secret key on the
 * floor. Consequences, both deliberate:
 *
 *   - The recipient cannot correlate two submissions by sender key, because
 *     every submission comes from a key that has never existed before.
 *   - Nobody, including the submitter, can decrypt an envelope after the
 *     ephemeral secret key goes out of scope. Only the recipient's secret
 *     key opens it.
 *
 * Envelope layout (fixed 512 bytes, matching the contract's Bytes<512>):
 *
 *   [ 0..32)    ephemeral sender public key
 *   [32..56)    24-byte nonce
 *   [56..328)   nacl.box output for the 256-byte padded report (256 + 16 MAC)
 *   [328..512)  zero padding
 *
 * The recipient's SECRET key never appears in this module's outputs except
 * from the generate/export functions the recipient invokes locally. It must
 * never be transmitted, logged, or placed in a transaction.
 */
import nacl from 'tweetnacl';

/** Matches `Bytes<512>` in submit_encrypted_report. */
export const ENVELOPE_BYTES = 512;
/** The report is padded to this size before encryption (Level 2 convention). */
export const PLAINTEXT_BYTES = 256;

const EPHEMERAL_KEY_BYTES = nacl.box.publicKeyLength; // 32
const NONCE_BYTES = nacl.box.nonceLength; // 24
const BOX_BYTES = PLAINTEXT_BYTES + nacl.box.overheadLength; // 256 + 16 = 272
const PAYLOAD_BYTES = EPHEMERAL_KEY_BYTES + NONCE_BYTES + BOX_BYTES; // 328

export type RecipientKeypair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

/** New inbox identity for an organization. Generated locally, never sent. */
export const generateRecipientKeypair = (): RecipientKeypair => nacl.box.keyPair();

/**
 * Encrypts a report to the recipient's public key and returns the fixed
 * 512-byte envelope described in the module header.
 *
 * @param plaintext Exactly 256 bytes (the padded report). Shorter input is
 *                  zero-padded here as a convenience; longer input throws,
 *                  because silently truncating a whistleblower's report would
 *                  be worse than failing.
 */
export const encryptToRecipient = (
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array,
  // ArrayBuffer-backed (never SharedArrayBuffer), so callers can hand the
  // envelope straight to crypto.subtle.digest under TS 6's stricter typings.
): Uint8Array<ArrayBuffer> => {
  if (plaintext.length > PLAINTEXT_BYTES) {
    throw new Error(`Report exceeds ${PLAINTEXT_BYTES} bytes; refusing to truncate.`);
  }
  if (recipientPublicKey.length !== EPHEMERAL_KEY_BYTES) {
    throw new Error('Recipient public key must be 32 bytes.');
  }

  const padded = new Uint8Array(PLAINTEXT_BYTES);
  padded.set(plaintext);

  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(NONCE_BYTES);
  const box = nacl.box(padded, nonce, recipientPublicKey, ephemeral.secretKey);

  const envelope = new Uint8Array(ENVELOPE_BYTES);
  envelope.set(ephemeral.publicKey, 0);
  envelope.set(nonce, EPHEMERAL_KEY_BYTES);
  envelope.set(box, EPHEMERAL_KEY_BYTES + NONCE_BYTES);
  // Bytes [PAYLOAD_BYTES..512) stay zero: padding to the contract's Bytes<512>.
  return envelope;
};

/**
 * Opens a 512-byte envelope with the recipient's secret key.
 *
 * @returns The 256-byte padded report, or null when the envelope is corrupt
 *          or was encrypted to a different key. Never throws on bad input:
 *          the inbox decrypts a whole list and one bad entry must not take
 *          down the rest.
 */
export const decryptWithRecipientKey = (
  ciphertext: Uint8Array,
  recipientSecretKey: Uint8Array,
): Uint8Array | null => {
  if (ciphertext.length < PAYLOAD_BYTES || recipientSecretKey.length !== nacl.box.secretKeyLength) {
    return null;
  }
  const ephemeralPublicKey = ciphertext.subarray(0, EPHEMERAL_KEY_BYTES);
  const nonce = ciphertext.subarray(EPHEMERAL_KEY_BYTES, EPHEMERAL_KEY_BYTES + NONCE_BYTES);
  const box = ciphertext.subarray(
    EPHEMERAL_KEY_BYTES + NONCE_BYTES,
    EPHEMERAL_KEY_BYTES + NONCE_BYTES + BOX_BYTES,
  );
  try {
    return nacl.box.open(box, nonce, ephemeralPublicKey, recipientSecretKey);
  } catch {
    return null;
  }
};

/** Strips the zero padding applied before encryption and decodes UTF-8. */
export const decodePaddedReport = (padded: Uint8Array): string => {
  let end = padded.length;
  while (end > 0 && padded[end - 1] === 0) end -= 1;
  return new TextDecoder().decode(padded.subarray(0, end));
};

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

export type ExportedRecipientKeys = {
  publicKeyHex: string;
  secretKeyHex: string;
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
