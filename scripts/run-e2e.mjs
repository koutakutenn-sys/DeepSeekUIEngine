import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Project-private browser cache; never changes the installed Edge or system PATH.
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/ms-playwright');
const temporaryDirectory = resolve('.cache/tmp');
mkdirSync(temporaryDirectory, { recursive: true });
process.env.TEMP = temporaryDirectory;
process.env.TMP = temporaryDirectory;
process.env.TMPDIR = temporaryDirectory;
const { chromium } = await import('@playwright/test');
const cli = resolve('node_modules/playwright/cli.js');
if (!existsSync(chromium.executablePath())) {
  mkdirSync(process.env.PLAYWRIGHT_BROWSERS_PATH, { recursive: true });
  console.log('Preparing project-private Chromium for extension tests…');
  const install = spawnSync(process.execPath, [cli, 'install', 'chromium', '--no-shell'], { stdio: 'inherit', env: process.env });
  if (install.status !== 0) process.exit(install.status ?? 1);
}
const fixture = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.fixture.config.ts'], { stdio: 'inherit', env: process.env });
if (fixture.status !== 0) process.exit(fixture.status ?? 1);
const result = spawnSync(process.execPath, [cli, 'test'], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
