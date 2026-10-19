import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { attributionComments, collectLicenseAudit, verifyLicenseNotices, verifyDocumentBaselines } from './license-audit.mjs';

// Run after building: tests use real installed licenses and real Rollup inventories.
const audit = await collectLicenseAudit();
const notices = await readFile('dist/THIRD_PARTY_NOTICES.txt', 'utf8');

test('distribution contains every original production root license and notice in full', async () => {
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  for (const [directory, entry] of Object.entries(lock.packages)) {
    if (!directory.startsWith('node_modules/') || entry.dev) continue;
    for (const name of await readdir(directory)) {
      if (/^(licen[cs]e|notice)(\.[\w-]+)?$/i.test(name)) assert(notices.includes(await readFile(join(directory, name), 'utf8')), `${directory}/${name}`);
    }
  }
});

test('seedrandom and Alea preserve the published MIT grant and disclaimer, not just names', async () => {
  const source = await readFile('node_modules/seedrandom/seedrandom.js', 'utf8');
  assert(notices.includes(source.slice(0, source.indexOf('*/') + 2)));
  const sourceAlea = await readFile('node_modules/seedrandom/lib/alea.js', 'utf8');
  const alea = sourceAlea.slice(0, sourceAlea.indexOf('(function')).trimEnd();
  assert(notices.includes(alea));
});

test('ISC and natural-sort include unchanged upstream full texts plus published credits', async () => {
  for (const file of ['quickselect-1.1.1-LICENSE.txt', 'javascript-natural-sort-upstream-LICENSE.txt']) {
    assert(notices.includes(await readFile(`third-party/upstream/${file}`, 'utf8')));
  }
  assert(notices.includes('based on chunking idea from Dave Koelle'));
  assert(notices.includes('ISC license, Copyright 2018 Vladimir Agafonkin.'));
});

test('attributions after imports are retained without copying executable statements', () => {
  const groups = attributionComments('import x from "x";\n// Based on upstream\n// ISC license, Copyright 2018 Example.\nexport default x;');
  assert.deepEqual(groups, ['// Based on upstream\n// ISC license, Copyright 2018 Example.']);
});

test('negative control: regexp and template contents cannot hide or invent copyright comments', () => {
  assert.deepEqual(attributionComments('const r = /`/;\n// Copyright 2026 Example. MIT license.\nexport const x=1;'), ['// Copyright 2026 Example. MIT license.']);
  assert.deepEqual(attributionComments('const s = `// Copyright fake`;\n/* Copyright real MIT license */\nconst x=1;'), ['/* Copyright real MIT license */']);
});

test('distribution verification accepts intact files and retains the unresolved interval scope', () => {
  verifyLicenseNotices(notices, audit);
  assert(audit.unresolved.some((item) => item.includes('interval-arithmetic@1.1.3')));
});

test('negative control: missing or changed full LICENSE cannot be replaced by short source credits', async () => {
  const policy = JSON.parse(await readFile('third-party/policy.json', 'utf8'));
  assert(policy.requiredDocuments.some((entry) => entry.path === 'node_modules/react/LICENSE'));
  await verifyDocumentBaselines(policy.requiredDocuments);
  await assert.rejects(verifyDocumentBaselines([{ path: 'node_modules/__missing_audit_fixture__/LICENSE', sha256: '0'.repeat(64) }]), /ENOENT/);
  await assert.rejects(verifyDocumentBaselines([{ path: 'node_modules/react/LICENSE', sha256: '0'.repeat(64) }]), /Audited license changed or missing/);
  await assert.rejects(verifyDocumentBaselines([]), /Missing audited license baseline/);
});

for (const marker of ['Copyright 2019 David Bau.', 'Copyright (C) 2010 by Johannes Baagøe',
  'Copyright (c) 2018, Vladimir Agafonkin', 'Jim Palmer', 'Dave Koelle', 'Copyright (c) 2015-2020 Mauricio Poppe']) {
  test(`negative control: a matching but incomplete generated notice still rejects missing ${marker}`, () => {
    const damaged = notices.replaceAll(marker, '[removed]');
    assert.throws(() => verifyLicenseNotices(damaged, { notices: damaged }), /Missing audited notice/);
  });
}

test('negative control: changed CSparse distribution cannot inherit the current exclusion', async () => {
  const directory = await mkdtemp('.cache/license-negative-');
  const modules = ['node_modules/mathjs/lib/esm/function/algebra/sparse/csAmd.js'];
  for (const target of ['content', 'popup']) await writeFile(join(directory, `THIRD_PARTY_MODULES.${target}.json`), JSON.stringify({ target, modules, generated: [] }));
  await assert.rejects(collectLicenseAudit(directory), /new LGPL audit is required/);
});
