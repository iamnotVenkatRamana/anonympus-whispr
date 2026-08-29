/**
 * The handful of deployment facts the landing page states out loud.
 *
 * Deliberately literal rather than imported from @anonymous-whispers/sdk.
 * That module calls setNetworkId and constructs the indexer provider at
 * module scope, so importing it here would pull the whole Midnight SDK (and
 * its WASM) into the landing bundle for the sake of two strings. A marketing
 * page would then start failing for reasons that belong to the wallet path.
 *
 * KEEP IN SYNC with NETWORK_ID and CONTRACT_ADDRESS in sdk/src/chain.ts.
 */
export const NETWORK_LABEL = 'preprod';

export const CONTRACT_ADDRESS =
  '0b24b5da3eaf66860c1b69a6d31f3e86089b5c4af48c2dc4be6f6c5b7f4b34f5';

export const EXPLORER_URL = `https://${NETWORK_LABEL}.midnightexplorer.com/contracts/${CONTRACT_ADDRESS}`;

export const GITHUB_URL = 'https://github.com/Emmanuellsensai/anonymous-whispers';
export const X_URL = 'https://x.com/AnonymousWhispr';
export const LIVE_DEMO_URL = 'https://anonymous-whispers.vercel.app/report';
