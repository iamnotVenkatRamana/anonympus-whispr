import { describe, expect, it } from 'vitest';

import { decodePaddedReport, decryptWithRecipientKey, encryptToRecipient, ENVELOPE_BYTES } from '../src/envelope';
import { generateRecipientKeypair } from '../src/keys';

const EPHEMERAL_KEY_BYTES = 32;
const NONCE_BYTES = 24;
const PAYLOAD_BYTES = EPHEMERAL_KEY_BYTES + NONCE_BYTES + 256 + 16; // 328

describe('encryptToRecipient / decryptWithRecipientKey', () => {
  it('round-trips a message through encrypt then decrypt', () => {
    const recipient = generateRecipientKeypair();
    const message = new TextEncoder().encode('the whistle has been blown');

    const sealed = encryptToRecipient(message, recipient.publicKey);
    const opened = decryptWithRecipientKey(sealed, recipient.secretKey);

    expect(opened).not.toBeNull();
    expect(decodePaddedReport(opened as Uint8Array)).toBe('the whistle has been blown');
  });

  it('produces a different envelope each time for the same message (unlinkable)', () => {
    const recipient = generateRecipientKeypair();
    const message = new TextEncoder().encode('same message, twice');

    const sealedA = encryptToRecipient(message, recipient.publicKey);
    const sealedB = encryptToRecipient(message, recipient.publicKey);

    expect(sealedA).not.toEqual(sealedB);
    // The ephemeral sender public key (first 32 bytes) must differ each call.
    expect(sealedA.subarray(0, EPHEMERAL_KEY_BYTES)).not.toEqual(
      sealedB.subarray(0, EPHEMERAL_KEY_BYTES),
    );
  });

  it('fails to decrypt with the wrong secret key', () => {
    const recipient = generateRecipientKeypair();
    const attacker = generateRecipientKeypair();
    const message = new TextEncoder().encode('for your eyes only');

    const sealed = encryptToRecipient(message, recipient.publicKey);
    const opened = decryptWithRecipientKey(sealed, attacker.secretKey);

    expect(opened).toBeNull();
  });

  it('produces an envelope that is exactly 512 bytes with the expected layout', () => {
    const recipient = generateRecipientKeypair();
    const message = new TextEncoder().encode('fixed width');

    const sealed = encryptToRecipient(message, recipient.publicKey);

    expect(sealed.length).toBe(ENVELOPE_BYTES);
    expect(sealed.length).toBe(512);
    // Bytes beyond the payload are zero padding.
    const padding = sealed.subarray(PAYLOAD_BYTES);
    expect(padding.every((byte) => byte === 0)).toBe(true);
  });
});
