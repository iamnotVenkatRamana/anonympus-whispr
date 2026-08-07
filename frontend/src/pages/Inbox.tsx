/**
 * Organization view: register as the recipient, then read the inbox.
 *
 * The recipient's secret key exists ONLY here, client-side:
 *   - generated with nacl.box.keyPair() in this browser,
 *   - offered as a .txt download (the recommended copy),
 *   - cached in localStorage under RECIPIENT_KEY_STORAGE for convenience,
 *   - never placed in a transaction, request, or log.
 *
 * Clearing browser storage without the downloaded copy makes every submission
 * permanently unreadable. The UI repeats this warning because it is true.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { WalletConnection } from '../components/WalletConnect';
import {
  connectToContract,
  level3CallTx,
  readPublicState,
  type PublicState,
} from '../lib/contract';
import {
  bytesToHex,
  decodePaddedReport,
  decryptWithRecipientKey,
  exportRecipientKeys,
  generateRecipientKeypair,
  importRecipientKeys,
  publicKeyFromSecret,
  type ExportedRecipientKeys,
} from '../lib/crypto';

export const RECIPIENT_KEY_STORAGE = 'anonymous-whispers-recipient-key';

type Props = {
  connection: WalletConnection | null;
};

const loadStoredKeys = (): ExportedRecipientKeys | null => {
  try {
    const raw = window.localStorage.getItem(RECIPIENT_KEY_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExportedRecipientKeys;
    if (typeof parsed.publicKeyHex !== 'string' || typeof parsed.secretKeyHex !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const storeKeys = (keys: ExportedRecipientKeys) =>
  window.localStorage.setItem(RECIPIENT_KEY_STORAGE, JSON.stringify(keys));

const downloadKeys = (keys: ExportedRecipientKeys) => {
  const body = [
    'Anonymous Whispers recipient key',
    '',
    `Public key (safe to share):  ${keys.publicKeyHex}`,
    `SECRET key (never share):    ${keys.secretKeyHex}`,
    '',
    'Anyone with the secret key can read every submission.',
    'Losing it makes all reports permanently unreadable.',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'anonymous-whispers-recipient-key.txt';
  anchor.click();
  URL.revokeObjectURL(url);
};

type RegisterPhase =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'done'; txId: string }
  | { kind: 'error'; message: string };

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function Inbox({ connection }: Props) {
  const [storedKeys, setStoredKeys] = useState<ExportedRecipientKeys | null>(loadStoredKeys);
  const [generated, setGenerated] = useState<ExportedRecipientKeys | null>(null);
  const [registerPhase, setRegisterPhase] = useState<RegisterPhase>({ kind: 'idle' });
  const [publicState, setPublicState] = useState<PublicState | null>(null);
  const [stateLoading, setStateLoading] = useState(true);
  const [pastedSecret, setPastedSecret] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const refreshState = useCallback(() => {
    setStateLoading(true);
    readPublicState()
      .then(setPublicState)
      .catch(() => setPublicState(null))
      .finally(() => setStateLoading(false));
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // ── State A: set up as recipient ─────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    const keys = exportRecipientKeys(generateRecipientKeypair());
    setGenerated(keys);
    setRegisterPhase({ kind: 'idle' });
  }, []);

  const handleRegister = useCallback(async () => {
    if (!generated || !connection) return;
    setRegisterPhase({ kind: 'submitting' });
    try {
      const { publicKey } = importRecipientKeys(generated.publicKeyHex, generated.secretKeyHex);
      const contract = await connectToContract(connection.api, connection.address);
      const tx = await level3CallTx(contract).register_recipient(publicKey);
      storeKeys(generated);
      setStoredKeys(generated);
      setRegisterPhase({ kind: 'done', txId: tx.public.txId });
      refreshState();
    } catch (error) {
      console.error('register_recipient failed:', error);
      setRegisterPhase({ kind: 'error', message: errorText(error) });
    }
  }, [generated, connection, refreshState]);

  const handleImport = useCallback(() => {
    setImportError(null);
    try {
      const secret = pastedSecret.trim();
      const publicKeyHex = bytesToHex(
        publicKeyFromSecret(importRecipientKeys(secret, secret).secretKey),
      );
      const keys = { publicKeyHex, secretKeyHex: secret };
      storeKeys(keys);
      setStoredKeys(keys);
      setPastedSecret('');
      setShowImport(false);
    } catch (error) {
      setImportError(errorText(error));
    }
  }, [pastedSecret]);

  const handleForgetKey = useCallback(() => {
    window.localStorage.removeItem(RECIPIENT_KEY_STORAGE);
    setStoredKeys(null);
    setGenerated(null);
    setShowImport(false);
  }, []);

  // ── State B: decrypt the inbox ───────────────────────────────────────────

  const decrypted = useMemo(() => {
    if (!storedKeys || !publicState) return [];
    let secretKey: Uint8Array;
    try {
      secretKey = importRecipientKeys(storedKeys.publicKeyHex, storedKeys.secretKeyHex).secretKey;
    } catch {
      return [];
    }
    return publicState.ciphertexts.map((envelope, index) => {
      const padded = decryptWithRecipientKey(envelope, secretKey);
      return {
        index,
        text: padded ? decodePaddedReport(padded) : null,
      };
    });
  }, [storedKeys, publicState]);

  const keyMatchesChain = useMemo(() => {
    if (!storedKeys || !publicState?.recipientPublicKey) return null;
    try {
      const derived = publicKeyFromSecret(
        importRecipientKeys(storedKeys.publicKeyHex, storedKeys.secretKeyHex).secretKey,
      );
      return bytesToHex(derived) === bytesToHex(publicState.recipientPublicKey);
    } catch {
      return false;
    }
  }, [storedKeys, publicState]);

  const importPanel = (
    <div className="surface-dark flex flex-col gap-4 p-7">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-dark)' }}>
        Paste your secret key (64 hex characters) to load an existing inbox identity.
      </p>
      <input
        type="password"
        value={pastedSecret}
        onChange={(event) => setPastedSecret(event.target.value)}
        placeholder="Secret key hex"
        className="field mono px-4 py-3 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleImport}
          disabled={pastedSecret.trim().length === 0}
          className="btn-solid focus-ring self-start px-5 py-2.5 text-sm"
        >
          Import key
        </button>
        {importError && (
          <p className="mono text-[12px] break-all text-white/70" role="alert">
            {importError}
          </p>
        )}
      </div>
    </div>
  );

  // ── Render: State A ──────────────────────────────────────────────────────

  if (!storedKeys) {
    return (
      <section className="flex flex-col gap-8">
        <div>
          <h2 className="eyebrow eyebrow-dark">set up as recipient</h2>
          <p
            className="mt-4 max-w-xl text-base leading-relaxed"
            style={{ color: 'var(--muted-dark)' }}
          >
            Generate a keypair in this browser, publish the public half on-chain, and
            keep the secret half. Reporters encrypt to your public key; only your
            secret key can open what they send.
          </p>
        </div>

        {!generated && (
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleGenerate}
              className="btn-solid focus-ring px-6 py-3 text-sm"
            >
              Generate recipient keys
            </button>
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="btn-quiet focus-ring px-5 py-2.5 text-sm"
            >
              I already have a key
            </button>
          </div>
        )}

        {showImport && !generated && importPanel}

        {generated && (
          <div className="flex flex-col gap-6">
            {/*
              The loudest thing the app ever says, so it is the one inverted
              block: paper on black. Monochrome leaves contrast as the only
              severity signal available, and this warrants all of it.
            */}
            <div className="notice-loud p-7">
              <p className="display text-xl font-semibold">Save your secret key NOW.</p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed opacity-75">
                Anyone with this key can read all submissions. Losing it means all
                reports become permanently unreadable. There is no recovery: not by
                this app, not by Midnight, not by anyone.
              </p>
            </div>

            <div className="surface-dark flex flex-col gap-5 p-7">
              <div>
                <p className="eyebrow eyebrow-dark">public key (published on-chain)</p>
                <p className="mono mt-2.5 text-sm leading-relaxed break-all text-white">
                  {generated.publicKeyHex}
                </p>
              </div>
              <div className="border-t border-white/10 pt-5">
                <p className="eyebrow eyebrow-dark">secret key (keep private)</p>
                <p className="mono mt-2.5 text-sm leading-relaxed break-all text-white">
                  {generated.secretKeyHex}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => downloadKeys(generated)}
                className="btn-quiet focus-ring px-5 py-2.5 text-sm"
              >
                Download secret key
              </button>
              <button
                type="button"
                onClick={handleRegister}
                disabled={!connection || registerPhase.kind === 'submitting'}
                className="btn-solid focus-ring px-6 py-3 text-sm"
              >
                {registerPhase.kind === 'submitting'
                  ? 'Registering...'
                  : 'Register public key on-chain'}
              </button>
              {!connection && (
                <p className="text-sm text-white/50">Connect a wallet to register.</p>
              )}
            </div>

            {registerPhase.kind === 'error' && (
              <p
                className="notice-quiet mono px-5 py-4 text-[12px] leading-relaxed break-all text-white/80"
                role="alert"
              >
                {registerPhase.message}
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  // ── Render: State B ──────────────────────────────────────────────────────

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="eyebrow eyebrow-dark">inbox</h2>
          <p className="mono mt-3 text-sm text-white/70" title={storedKeys.publicKeyHex}>
            Recipient key {storedKeys.publicKeyHex.slice(0, 6)}...
            {storedKeys.publicKeyHex.slice(-4)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="btn-quiet focus-ring px-4 py-1.5 text-sm"
          >
            Import different key
          </button>
          <button
            type="button"
            onClick={handleForgetKey}
            className="btn-quiet focus-ring px-4 py-1.5 text-sm"
          >
            Forget key
          </button>
        </div>
      </div>

      {showImport && importPanel}

      {registerPhase.kind === 'done' && (
        <div className="surface-dark px-7 py-5">
          <p className="eyebrow eyebrow-dark">recipient key registered on-chain</p>
          <p className="mono mt-2.5 text-sm break-all text-white/80">
            {registerPhase.txId}
          </p>
        </div>
      )}

      {keyMatchesChain === false && (
        /* Not an error, but the one mismatch that silently loses reports. */
        <p className="notice-quiet px-7 py-5 text-sm leading-relaxed text-white">
          The key loaded here does not match the recipient key currently registered
          on-chain. New submissions are encrypted to the on-chain key; this key will
          only open submissions made while it was registered.
        </p>
      )}

      <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-dark)' }}>
        Your secret key is cached in this browser's localStorage only. Clearing site
        data removes it; keep the downloaded copy safe.
      </p>

      {stateLoading && <p className="text-base text-white/55">Reading the inbox...</p>}

      {!stateLoading && decrypted.length === 0 && (
        <div className="surface-dark-empty p-12 text-center">
          <p className="display text-2xl font-semibold text-white">
            No encrypted submissions yet.
          </p>
          <p
            className="mx-auto mt-4 max-w-md text-base leading-relaxed"
            style={{ color: 'var(--muted-dark)' }}
          >
            Share the report link with your organization. Submissions appear here and
            decrypt locally with your key.
          </p>
        </div>
      )}

      {decrypted.map((entry) => (
        <article key={entry.index} className="surface-dark p-7">
          <p className="eyebrow eyebrow-dark">
            submission #{decrypted.length - entry.index}
            <span className="ml-2 text-white/35">(newest first)</span>
          </p>
          {entry.text !== null ? (
            <p className="mt-4 text-base leading-relaxed whitespace-pre-wrap text-white">
              {entry.text}
            </p>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Corrupt or wrong-key ciphertext: this entry could not be decrypted with
              the loaded key.
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
