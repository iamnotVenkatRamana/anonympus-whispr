export type RecipientKeypair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

export type ExportedRecipientKeys = {
  publicKeyHex: string;
  secretKeyHex: string;
};
