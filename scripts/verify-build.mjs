import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { verifyScript } from './verify-artifact.mjs';
import { collectLicenseAudit, verifyLicenseNotices } from './license-audit.mjs';

const output = resolve('dist');
const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.deepEqual(manifest.content_scripts[0].matches, ['https://chat.deepseek.com/*']);
assert.equal(manifest.content_scripts[0].world, 'ISOLATED');
assert.equal(manifest.background, undefined);
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.web_accessible_resources, undefined);
const csp = manifest.content_security_policy.extension_pages;
assert(/(?:^|;)\s*connect-src\s+'none'\s*(?:;|$)/.test(csp), 'Extension pages must block network connections');
for (const file of [...manifest.content_scripts[0].js, manifest.action.default_popup]) await access(join(output, file));
const notices = await readFile(join(output, 'THIRD_PARTY_NOTICES.txt'), 'utf8');
const licenseAudit = await collectLicenseAudit(output);
verifyLicenseNotices(notices, licenseAudit);
assert.deepEqual(JSON.parse(await readFile(join(output, 'THIRD_PARTY_COVERAGE.json'), 'utf8')), { packages: licenseAudit.coverage, unresolved: licenseAudit.unresolved });
assert(notices.includes('function-plot@1.26.0') && notices.includes('Copyright (c) 2015 Mauricio Poppe'), 'Preserve upstream plotting notices');
const markdownNotices = await readFile(join(output, 'THIRD_PARTY_NOTICES.md'), 'utf8');
assert.equal(markdownNotices, await readFile('THIRD_PARTY_NOTICES.md', 'utf8'), 'Distribute the complete third-party notice unchanged');
assert(markdownNotices.includes((await readFile('node_modules/function-plot/LICENSE', 'utf8')).trim()), 'Preserve the full upstream function-plot license');
const schema = JSON.parse(await readFile(join(output, 'dsui.schema.json'), 'utf8'));
assert.equal(schema.properties.blocks.maxItems, 3);
const content = await readFile(join(output, 'content.js'), 'utf8');
assert(content.length > 1000, 'Content bundle must contain the actual engine');
async function checkScripts(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await checkScripts(path);
    else if (entry.isFile() && entry.name.endsWith('.js')) verifyScript(await readFile(path, 'utf8'), { name: path, standalone: path === join(output, 'content.js') });
  }
}
await checkScripts(output);
const popup = await readFile(join(output, 'popup.html'), 'utf8');
assert(!/<script[^>]+src=["']https?:/.test(popup), 'Popup scripts must be bundled locally');
for (const match of popup.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)) await access(join(output, match[1]));
const assets = await readdir(join(output, 'assets'));
assert(assets.some((asset) => asset.endsWith('.css')));
console.log('MV3 build verified: local scripts, storage-only permissions, official site match.');
