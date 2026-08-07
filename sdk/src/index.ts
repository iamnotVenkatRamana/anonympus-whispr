// Public API surface. Chain layer (register/submit/fetch) added in Phase 4.
export type { RecipientKeypair, ExportedRecipientKeys } from './types';
export {
  generateRecipientKeypair,
  exportRecipientKeys,
  importRecipientKeys,
  publicKeyFromSecret,
  bytesToHex,
  hexToBytes,
} from './keys';
export {
  ENVELOPE_BYTES,
  PLAINTEXT_BYTES,
  encryptToRecipient,
  decryptWithRecipientKey,
  decodePaddedReport,
} from './envelope';
