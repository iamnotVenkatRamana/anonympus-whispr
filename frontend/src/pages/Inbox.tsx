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
    <div className="flex flex-col gap-3 rounded-2xl border border-edge bg-surface/30 p-7">
      <p className="text-sm text-muted">
        Paste your secret key (64 hex characters) to load an existing inbox identity.
      </p>
      <input
        type="password"
        value={pastedSecret}
        onChange={(event) => setPastedSecret(event.target.value)}
        placeholder="Secret key hex"
        className="focus-glow rounded-lg border border-edge bg-transparent px-4 py-2.5 font-mono text-sm text-bright outline-none placeholder:text-muted"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleImport}
          disabled={pastedSecret.trim().length === 0}
          className="self-start rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-void transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
        >
          Import key
        </button>
        {importError && (
          <p className="text-sm text-alert" role="alert">
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
          <h2 className="text-sm tracking-[0.25em] text-signal uppercase">
            Set up as recipient
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-dim">
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
              className="rounded-lg bg-signal px-6 py-3 text-sm font-semibold tracking-wide text-void transition-colors hover:bg-signal-deep"
            >
              Generate recipient keys
            </button>
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="rounded-lg border border-signal/15 px-4 py-2.5 text-sm text-signal/60 transition-colors hover:border-signal/40 hover:text-signal"
            >
              I already have a key
            </button>
          </div>
        )}

        {showImport && !generated && importPanel}

        {generated && (
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-warn/40 bg-surface/50 p-7">
              <p className="text-base font-semibold text-warn">
                Save your secret key NOW.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-dim">
                Anyone with this key can read all submissions. Losing it means all
                reports become permanently unreadable. There is no recovery: not by
                this app, not by Midnight, not by anyone.
              </p>
            </div>

            <div>
              <p className="text-sm text-muted">Public key (published on-chain)</p>
              <p className="mt-1.5 font-mono text-sm leading-relaxed break-all text-bright">
                {generated.publicKeyHex}
              </p>
              <p className="mt-4 text-sm text-muted">Secret key (keep private)</p>
              <p className="mt-1.5 font-mono text-sm leading-relaxed break-all text-warn">
                {generated.secretKeyHex}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => downloadKeys(generated)}
                className="rounded-lg border border-signal/40 px-5 py-2.5 text-sm font-semibold text-signal transition-colors hover:border-signal"
              >
                Download secret key
              </button>
              <button
                type="button"
                onClick={handleRegister}
                disabled={!connection || registerPhase.kind === 'submitting'}
                className="rounded-lg bg-signal px-6 py-3 text-sm font-semibold tracking-wide text-void transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
              >
                {registerPhase.kind === 'submitting'
                  ? 'Registering...'
                  : 'Register public key on-chain'}
              </button>
              {!connection && (
                <p className="text-sm text-muted">Connect a wallet to register.</p>
              )}
            </div>

            {registerPhase.kind === 'error' && (
              <p className="text-sm leading-relaxed break-all text-alert" role="alert">
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
          <h2 className="text-sm tracking-[0.25em] text-signal uppercase">Inbox</h2>
          <p className="mt-3 font-mono text-sm text-dim" title={storedKeys.publicKeyHex}>
            Recipient key {storedKeys.publicKeyHex.slice(0, 6)}...
            {storedKeys.publicKeyHex.slice(-4)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="rounded-lg border border-signal/15 px-3 py-1.5 text-sm text-signal/60 transition-colors hover:border-signal/40 hover:text-signal"
          >
            Import different key
          </button>
          <button
            type="button"
            onClick={handleForgetKey}
            className="rounded-lg border border-signal/15 px-3 py-1.5 text-sm text-signal/60 transition-colors hover:border-signal/40 hover:text-signal"
          >
            Forget key
          </button>
        </div>
      </div>

      {showImport && importPanel}

      {registerPhase.kind === 'done' && (
        <p className="rounded-2xl border border-signal/40 bg-surface/50 px-7 py-5 text-sm text-signal">
          Recipient key registered on-chain. Transaction: <span className="font-mono break-all">{registerPhase.txId}</span>
        </p>
      )}

      {keyMatchesChain === false && (
        <p className="rounded-2xl border border-warn/40 bg-surface/50 px-7 py-5 text-sm leading-relaxed text-warn">
          The key loaded here does not match the recipient key currently registered
          on-chain. New submissions are encrypted to the on-chain key; this key will
          only open submissions made while it was registered.
        </p>
      )}

      <p className="text-sm leading-relaxed text-muted">
        Your secret key is cached in this browser's localStorage only. Clearing site
        data removes it; keep the downloaded copy safe.
      </p>

      {stateLoading && <p className="text-base text-muted">Reading the inbox...</p>}

      {!stateLoading && decrypted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-edge-lit bg-surface/30 p-12 text-center">
          <p className="text-lg text-bright">No encrypted submissions yet.</p>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-dim">
            Share the report link with your organization. Submissions appear here and
            decrypt locally with your key.
          </p>
        </div>
      )}

      {decrypted.map((entry) => (
        <article
          key={entry.index}
          className="rounded-2xl border border-edge bg-surface/50 p-7"
        >
          <p className="text-sm text-muted">
            Submission #{decrypted.length - entry.index}
            <span className="ml-2 text-muted/70">(newest first)</span>
          </p>
          {entry.text !== null ? (
            <p className="mt-3 text-base leading-relaxed whitespace-pre-wrap text-bright">
              {entry.text}
            </p>
          ) : (
            <p className="mt-3 text-sm text-alert">
              Corrupt or wrong-key ciphertext: this entry could not be decrypted with
              the loaded key.
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
