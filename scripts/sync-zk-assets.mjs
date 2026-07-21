/**
 * Copies the compiled ZK artifacts into public/ so the browser can fetch them
 * over HTTP.
 *
 * The Node deploy/cli path reads these straight off disk via
 * NodeZkConfigProvider. The browser can't, so FetchZkConfigProvider pulls them
 * from the dev/preview server instead. It expects this exact layout, relative
 * to its baseURL:
 *
 *   {base}/keys/{circuitId}.prover
 *   {base}/keys/{circuitId}.verifier
 *   {base}/zkir/{circuitId}.bzkir
 *
 * which is the same shape compact emits under contracts/managed, so this is a
 * straight directory copy. Run automatically via the predev/prebuild:web hooks.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = 'anonymous-whispers';

const src = path.join(root, 'contracts', 'managed', CONTRACT);
const dest = path.join(root, 'public', 'zk', CONTRACT);

if (!fs.existsSync(src)) {
  console.error(`\n❌ ${path.relative(root, src)} not found. Run: npm run compile\n`);
  process.exit(1);
}

let copied = 0;
for (const dir of ['keys', 'zkir']) {
  const from = path.join(src, dir);
  if (!fs.existsSync(from)) {
    console.error(`\n❌ Missing ${path.relative(root, from)}. Run: npm run compile\n`);
    process.exit(1);
  }
  const to = path.join(dest, dir);
  // Remove first so stale artifacts from an older compile can't linger and get
  // served to the browser alongside fresh ones.
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  for (const file of fs.readdirSync(from)) {
    fs.copyFileSync(path.join(from, file), path.join(to, file));
    copied += 1;
  }
}

console.log(`✓ Synced ${copied} ZK artifact(s) to ${path.relative(root, dest)}`);
