import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Keep tool temporary files inside the project on restricted Windows accounts.
const temporaryDirectory = resolve('.cache/tmp');
mkdirSync(temporaryDirectory, { recursive: true });
const environment = { ...process.env, TMP: temporaryDirectory, TEMP: temporaryDirectory, TMPDIR: temporaryDirectory };
for (const args of [
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.content.config.ts'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.popup.config.ts'],
  ['scripts/export-schema.mjs'],
  ['scripts/export-licenses.mjs'],
  ['scripts/verify-build.mjs'],
  ['--test', 'scripts/license-audit.test.mjs'],
]) {
  // Vite recreates dist, so preserve the notice after bundling and before verification.
  if (args[0] === 'scripts/verify-build.mjs') {
    copyFileSync('THIRD_PARTY_NOTICES.md', 'dist/THIRD_PARTY_NOTICES.md');
  }
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: environment });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
