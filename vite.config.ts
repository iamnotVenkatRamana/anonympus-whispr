import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Note on WASM: @midnight-ntwrk/ledger-v8 ships wasm-bindgen output built for
  // the "bundler" target (`import * as wasm from './..._bg.wasm'`). Vite 8
  // handles that natively and emits the .wasm as an asset. Do NOT add
  // vite-plugin-wasm: layering it on top of the native handling crashes the
  // build with a SIGBUS (verified against vite 8.1.5).
  optimizeDeps: {
    // Pre-bundling ledger-v8 breaks it. The wasm-bindgen glue does
    // `import * as wasm from './..._bg.wasm'` and then calls
    // `wasm.__wbindgen_start()` at module top level; running that through the
    // dev dep optimizer produces
    //   "Cannot access '__wbindgen_start' before initialization"
    // and the app renders a blank page. Serving it unbundled keeps the wasm
    // module's init order intact. Production is unaffected, which is exactly
    // why this only ever shows up in `npm run dev`.
    // These are every package under @midnight-ntwrk that ships a .wasm file.
    exclude: [
      '@midnight-ntwrk/ledger-v8',
      '@midnight-ntwrk/onchain-runtime-v3',
      '@midnight-ntwrk/zkir-v2',
    ],
  },
  server: {
    port: 5173,
  },
});
