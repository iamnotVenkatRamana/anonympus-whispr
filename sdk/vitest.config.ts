import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors frontend/vite.config.ts: resolves the compiled Compact
      // artifacts from the sibling contract/ package's committed managed/ dir.
      '@contract': fileURLToPath(new URL('../contract/managed', import.meta.url)),
    },
  },
});
