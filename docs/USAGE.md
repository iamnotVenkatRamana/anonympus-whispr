# How to Use Anonymous Whispers

Anonymous Whispers lets someone report wrongdoing to an organization without
ever revealing who they are. The report is encrypted in the reporter's
browser, sent through the Midnight network, and can only be opened by the
organization's own device.

## What You Need

- A modern web browser
- The [Lace wallet](https://www.lace.io/) browser extension, set to the
  Preprod network
- A little bit of tNIGHT from the
  [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev) to
  submit a report (organizations also need this to register)

---

## For Reporters: how to send a report

1. Open the app at `<placeholder: TBD, live demo URL>`.
2. Click "Make a report," or navigate to `/report`.
3. Connect your Lace wallet when prompted.
4. Write your report in the box. Take your time; nothing leaves your browser
   until you press Send.
5. Press Send. Your report is:
   - encrypted to the organization's public key in your browser,
   - sealed into a 512-byte envelope so its size gives nothing away,
   - and submitted to Midnight with a zero-knowledge proof that it was
     correctly formed.
6. Once submitted, no one, not us, not Midnight, not a court, can trace the
   report back to you or read its contents. Only the organization's own
   device can open it.

## For Organizations: how to receive reports

1. Open the app at `<placeholder: TBD, live demo URL>`.
2. Navigate to `/inbox`.
3. Connect your Lace wallet when prompted.
4. Click "Generate recipient keys." The app creates a keypair for you in
   your browser.
5. **Save your secret key immediately.** It's shown once, and you can also
   download it as a text file. Anyone with this key can read all reports.
   If you lose it, every report becomes permanently unreadable. There is no
   recovery.
6. Click "Register public key on-chain" (a small tNIGHT fee applies).
7. Once registered, reporters can send you encrypted reports. You'll see
   them in the inbox, newest first; they decrypt in your browser using your
   secret key.

If you already have a recipient key from a previous session, use "I already
have a key" (before generating) or "Import different key" (once you're in
the inbox) to paste your saved secret key instead of generating a new one.

## What Gets Proved, and What Stays Private

The Midnight chain records:

- Your organization's registered public key and its version number
- That a report was submitted (a sealed 512-byte envelope)
- A commitment hash of the envelope, for auditability
- Roughly when it was submitted (block inclusion time)

The Midnight chain does not record and cannot recover:

- The contents of the report
- The reporter's identity
- Any link between two reports from the same reporter

## Troubleshooting

**"Could not reach the indexer" or "expected instance of ChargedState"**

Almost always a duplicate-dependency issue in the `@midnight-ntwrk/*`
packages. If you're building from source, confirm the root `package.json`
has an `overrides` block pinning `@midnight-ntwrk/onchain-runtime-v3` (and
`ledger-v8`, `wallet-sdk`) to a single version, then delete `node_modules`
and reinstall.

**Wallet won't connect**

Confirm Lace is installed, unlocked, and set to the Preprod network. Refresh
the page.

**Deploy or setup script hangs on "Still syncing..."**

Preprod wallet sync can take a few hours the first time. If it appears
frozen for over an hour with no counter progress, restart the proof server
(`cd contract && docker compose stop proof-server && docker compose up -d
proof-server`) and re-run. Wallet state is persisted, so sync resumes from
where it left off.

**"This organization hasn't set up a recipient yet" on `/report`**

No one has registered a recipient key on-chain yet. Ask the organization to
open `/inbox` and complete the setup steps above before submitting.

**The key I loaded doesn't match the key registered on-chain**

The inbox will warn you if this happens. It means the key you loaded can
only open reports sent while it was the registered key; anything sent after
a later registration needs the newer key. This is expected after a key
rotation, and a signal to check whether the rotation was one you made.

**I lost my organization secret key**

There is no recovery. Register a new keypair. Any reports sent to the old
key are permanently unreadable.
