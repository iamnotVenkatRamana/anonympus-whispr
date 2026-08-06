/**
 * The handful of deployment facts the landing page states out loud.
 *
 * Deliberately literal rather than imported from src/lib/contract.ts. That
 * module calls setNetworkId and constructs the indexer provider at module
 * scope, so importing it here would pull the whole Midnight SDK (and its WASM)
 * into the landing bundle for the sake of two strings. A marketing page would
 * then start failing for reasons that belong to the wallet path.
 *
 * KEEP IN SYNC with NETWORK_ID and CONTRACT_ADDRESS in src/lib/contract.ts.
 *
 * Note on the network name: the Level 4 spec says "Preprod", but the contract
 * that is actually deployed and verified lives on Preview (the Preprod indexer
 * was lagging; see the comment in src/lib/contract.ts). The page says Preview
 * because the page must be true. If a Preprod deploy happens, change these two
 * constants and the copy follows.
 */
export const NETWORK_LABEL = 'preview';

export const CONTRACT_ADDRESS =
  'ab72e8ada93002dec30224611e2af77d7f00142beb2975d7cd254ddd68205c5e';

export const EXPLORER_URL = `https://${NETWORK_LABEL}.midnightexplorer.com/contracts/${CONTRACT_ADDRESS}`;

/** Placeholders the user fills in once the accounts and deploy exist. */
export const GITHUB_URL = 'https://github.com/Emmanuellsensai/anonymous-whispers';
/** PLACEHOLDER. X profile not created yet. */
export const X_URL = '#';
/** PLACEHOLDER. Vercel URL pasted after the frontend deploy. */
export const LIVE_DEMO_URL = '#';
