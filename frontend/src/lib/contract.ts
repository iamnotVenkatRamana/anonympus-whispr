/**
 * Legacy Level 1/2 wiring kept for CircuitCall.tsx (the hash-only
 * `submit_report` flow), which is not part of the SDK's surface — see
 * sdk/src/chain.ts's module header.
 *
 * `connectToContract` and `DeployedWhispersContract` are not duplicated here:
 * they are generic contract-connection wiring (not encrypted-flow-specific —
 * any circuit on the deployed contract, including the legacy `submit_report`,
 * is reachable through the same `DeployedWhispersContract.callTx`), so
 * CircuitCall.tsx uses the SDK's copy directly, re-exported below for import
 * path stability.
 */
export { connectToContract, type DeployedWhispersContract } from '@anonymous-whispers/sdk';

/**
 * `submit_report`'s `report_content` parameter is a fixed-width `Bytes<256>`.
 * Legacy-flow only; the encrypted flow's equivalent is `PLAINTEXT_BYTES` in
 * `@anonymous-whispers/sdk`. Same value, kept separate because they describe
 * two different circuits' parameters.
 */
export const REPORT_CONTENT_BYTES = 256;
