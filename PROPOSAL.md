# Product Proposal: Anonymous Whispers

## What is the product, and who uses it?

[Draft: Anonymous Whispers is cryptographic whistleblowing infrastructure for organizations. An organization's ethics officer, compliance team, or board registers on-chain as the recipient by publishing a curve25519 public key. Employees, contractors, or customers submit reports through a public URL; the report is encrypted in the reporter's browser to that key before anything leaves the machine. Only the registered recipient can decrypt. The submitter's identity is cryptographically unrecoverable: not by the organization, not by us, not by Midnight, not under subpoena. There is no operator in the loop who could be compelled to reveal what was never collected.]

[I WILL FILL THIS IN]

## Why Midnight specifically?

[Draft: On a transparent chain, both the transaction graph and the payload are public forever; posting even an encrypted report leaks who posted it and when. A hosted service (a tip-line SaaS, ProtonMail, a Google Form) moves the problem instead of solving it: the operator holds logs, metadata, and often the keys, and can be subpoenaed, breached, or pressured. Midnight is different in kind. Zero-knowledge proofs let a reporter prove "a valid submission happened" without the network learning the content, and the shielded transaction model means the submission is not linkable to a wallet identity on the public ledger. The anonymity guarantee is enforced at the protocol level rather than by trust in an operator's promise. Level 3 layers client-side nacl.box encryption on top, so the content is sealed to the recipient before the protocol even sees it: two independent layers, either of which alone would already be stronger than a trusted intermediary.]

[I WILL FILL THIS IN]

## Data Model

| Data Point                | Type             | Disclosed To                                   |
|---------------------------|------------------|------------------------------------------------|
| Submission counter        | Public ledger    | Everyone                                       |
| Recipient public key      | Public ledger    | Everyone                                       |
| Recipient key version     | Public ledger    | Everyone                                       |
| Encrypted ciphertext list | Public ledger    | Everyone (content unreadable without the key)  |
| Ciphertext hash           | Public ledger    | Everyone (auditable commitment)                |
| Report plaintext          | Never stored     | Only the recipient, after local decryption     |
| Submitter identity/wallet | Off-chain proof  | Never revealed on-chain                        |
| Recipient private key     | Client-side only | Only the recipient                             |

## Mainnet Feasibility

[Draft: The Level 3 contract is intentionally minimal, and the gaps are known and scoped rather than discovered. To be Mainnet-credible the following change: (1) Access control on register_recipient, since today any caller can overwrite the recipient key; the key version counter makes this detectable but not preventable. (2) Key rotation with retained history, so submissions encrypted to key v1 remain attributable to the v1 window after a rotation to v2. (3) Spam and denial-of-service economics: fixed 512-byte envelopes bound storage per submission, but rate limiting or a small stake requirement is needed against flooding. (4) Inbox pagination once the ciphertext list grows beyond what one read returns comfortably. (5) Operational guidance for regulated industries: KYC applies to the organization operating the inbox, never to reporters, and a documented subpoena-response posture whose honest answer is "we hold nothing." Level 4 targets key rotation and inbox pagination. Levels 5-6 target multi-recipient threshold decryption, rate limiting, and a hosted onboarding experience for organizations.]

[I WILL FILL THIS IN]

## Primary Niche and Adjacent Markets

Primary: internal organizational whistleblowing (compliance-driven, legally sensitive, high stakes per submission).

Adjacent applications served by the same contract without modification:

- Consumer complaint channels (products, services)
- Government tip lines
- Grantee and nonprofit reporting to funders
- Investigative journalism source protection
- Academic research misconduct reporting

[I WILL EDIT THIS OR LEAVE AS IS]
