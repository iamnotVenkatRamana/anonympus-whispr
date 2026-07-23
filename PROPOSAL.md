# Product Proposal: Anonymous Whispers

## What is the product, and who uses it?

Anonymous Whispers is cryptographic whistleblowing infrastructure for
organizations. A compliance officer, ethics team, ombudsperson, or board
registers as the recipient by generating a curve25519 keypair in the browser
and publishing only the public key on-chain through the `register_recipient`
circuit. The secret key never leaves the recipient's machine. Employees,
contractors, or customers submit reports through a public link: the app
fetches the registered public key, encrypts the report in the reporter's
browser under a fresh ephemeral sender keypair, and publishes the sealed
ciphertext on-chain through `submit_encrypted_report`. Only the registered
recipient can decrypt, and decryption happens entirely client-side.

The submitter's identity is cryptographically unrecoverable. Not by the
organization, because every submission arrives under a single-use ephemeral
key that is discarded after encryption, so the recipient cannot even
correlate two reports from the same person. Not by the platform, because
there is no platform in the loop: no server ever sees plaintext, keys, or
submission metadata. Not by Midnight, and not under legal compulsion,
because a subpoena cannot extract data that was never collected. The honest
answer to any demand for reporter identity is that nothing exists to hand
over.

The buyers are organizations subject to whistleblower mandates such as the
EU Whistleblower Directive, SOX, and ISO 37002. These regimes require
reporting channels that protect reporter identity, and today organizations
satisfy them with hosted tip lines whose anonymity rests on an operator's
policy. Anonymous Whispers replaces that policy promise with a guarantee
enforced by mathematics: the organization gets a compliant channel, and the
reporter gets anonymity that does not depend on anyone's good behavior. The
Level 3 system is deployed on Midnight Preview at contract
`ab72e8ada93002dec30224611e2af77d7f00142beb2975d7cd254ddd68205c5e` and has
been verified working end to end against the live contract.

## Why Midnight specifically?

A transparent chain cannot host this product. All state on a public ledger
is readable forever, so report content cannot live there in the clear, and
even posting only encrypted blobs from a normal account leaks the
transaction graph: who submitted, when, and how often. That metadata is
frequently enough to identify a whistleblower on its own.

Web2 whistleblowing SaaS moves the problem rather than solving it. A hosted
tip line has a single operator who runs the servers, terminates TLS, and
holds the database. However sincere the operator's privacy policy, they
retain the technical ability to log IP addresses, timing, and content, and
they can be subpoenaed, breached, or pressured into using that ability.
Anonymity in that model is a promise about behavior, not a property of the
system, and the reporter has no way to verify it from the outside.

Midnight resolves both failures at once. Zero-knowledge proofs let the
reporter prove that a valid, well-formed submission happened without
revealing who made it, and the shielded transaction model keeps the
submission unlinkable to a wallet identity on the public ledger. The
ciphertext itself is stored openly in public contract state, which is a
feature rather than a leak: anyone can audit that reports exist and match
their published hashes, but the content opens only to the recipient's key.
Client-side nacl.box encryption and protocol-level identity protection are
independent layers, and either alone would already be stronger than trust
in an operator. Together they make the guarantee protocol-enforced: there
is no privileged party whose honesty the reporter must assume.

## Data Model

| Data Point                  | Type              | Disclosed To                                        |
|-----------------------------|-------------------|-----------------------------------------------------|
| Submission counter          | Public ledger     | Everyone                                            |
| Recipient public key        | Public ledger     | Everyone                                            |
| Recipient key version       | Public ledger     | Everyone                                            |
| Encrypted ciphertext list   | Public ledger     | Everyone (unreadable without the recipient's key)   |
| Ciphertext hash             | Public ledger     | Everyone (auditable commitment)                     |
| Report plaintext            | Never stored      | Only the recipient, after local decryption          |
| Submitter wallet            | Transaction signer| Visible as the signer, unlinked to report content   |
| Ephemeral sender keypair    | Never stored      | Nobody; generated per submission and discarded      |
| Recipient secret key        | Client-side only  | Only the recipient; never transmitted               |

## Key verification and trust anchors

The honest limitation of the Level 3 contract is that `register_recipient`
is unrestricted: any caller can overwrite the recipient key. A malicious
actor who does so would silently receive every subsequent report, and
reporters would have no on-chain signal that anything changed beyond the
key version counter incrementing.

The mitigation is out-of-band key verification. The dApp shows reporters a
truncated fingerprint of the currently registered public key, and the
organization publishes the fingerprint of its genuine key through a channel
it controls: its own HTTPS site, an employee handbook, or physical signage
in the workplace. A reporter who compares the two before submitting will
detect a substituted key. Security is therefore bounded by the strength of
that publishing channel, which is the same trust model that PGP
fingerprints and Signal safety numbers rely on: the cryptography is only as
trustworthy as the channel that anchors the key.

The choice of anchor matters for insider threats. If the concern is that
the organization's own IT or leadership might swap the key to intercept
reports about themselves, then the organization's web page is a weak anchor
because the same insiders control it. Physical signage distributed before
any dispute, or a fingerprint hosted on a third-party ombudsperson's site,
is a stronger anchor in those scenarios because the attacker would need to
compromise a channel outside their control.

Level 4 closes the on-chain half of this gap: `register_recipient` becomes
owner-gated so only the legitimate registrant can rotate the key, and
rotation detection surfaces any key change to reporters so they know to
re-verify the fingerprint before submitting.

## Mainnet Feasibility

The Level 3 contract is intentionally minimal, and the remaining gaps are
known and scoped rather than waiting to be discovered. The path to a
Mainnet-credible product runs through three further levels.

Level 4 hardens key management: owner-gated key registration so the
recipient key cannot be overwritten by an arbitrary caller, key rotation
with reporter-visible version detection so a legitimate rotation is
distinguishable from an attack and reporters know to re-verify, and inbox
pagination so the recipient view stays usable as submission volume grows
beyond what a single read returns comfortably.

Level 5 addresses the two structural risks of a single-recipient design.
Threshold decryption splits the recipient key across a board so that no
single individual can read reports alone or lose the key alone, which also
weakens the "recipient is the wrongdoer" failure mode. Rate limiting and
spam prevention, likely a small stake per submission, protect the inbox
from flooding, which fixed 512-byte envelopes bound in storage cost but not
in volume.

Level 6 is about operating the product rather than building it: hosted
onboarding so an organization can register and publish its fingerprint
without touching a command line, documented escalation paths for the case
where the registered recipient is complicit in the reported conduct, and
readiness for a first pilot with a compliance-driven organization.

What is candidly not solved yet: network-layer anonymity is outside the
contract's power, so a reporter who needs to hide their IP address must
still use Tor or an equivalent; wallet funding leaves its own trail, and a
reporter using an employer-provisioned or KYC-linked wallet weakens their
own anonymity; and the legal standing of a mathematically anonymous channel
under specific national implementations of the EU Directive needs counsel
review before a regulated pilot, not after.

## Primary Niche and Adjacent Markets

The primary niche is internal organizational whistleblowing. It is
compliance-driven, so budget exists and adoption is mandated rather than
optional; it is legally sensitive, so the difference between policy-based
and cryptographic anonymity is material; and the stakes per submission are
high, so a small number of protected reports justifies the system.

The same contract serves adjacent markets without modification, because
each is the same shape: many untrusted submitters, one accountable
recipient, content that must stay sealed. Consumer complaint channels for
products and services, government tip lines, grantee and nonprofit
reporting to funders, investigative journalism source protection, and
academic research misconduct reporting all fit that shape. Each differs
only in who registers the recipient key and where its fingerprint is
published.
