import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

const hash = (text) => createHash('sha256').update(text).digest('hex');
const licenseName = /(?:^|[._-])(?:licen[cs]e|notice|copyright(?:notice)?|copying)(?:[._-]|$)/i;
const attribution = /copyright|licen[cs]e|SPDX|attribution|based on|derived from|ported from/i;

/** Preserve complete comment groups, including consecutive // license paragraphs. */
export function attributionComments(source, includeCredits = false) {
  // A bare scanner misreads /`/ and templates; let the parser locate token bounds.
  const file = ts.createSourceFile('license-source.js', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  const ranges = new Map(); const stack = [file];
  while (stack.length) {
    const node = stack.pop();
    for (const range of [...ts.getLeadingCommentRanges(source, node.pos) ?? [], ...ts.getTrailingCommentRanges(source, node.end) ?? []]) ranges.set(`${range.pos}:${range.end}`, range);
    stack.push(...node.getChildren(file));
  }
  const groups = []; let group = [];
  const flush = () => {
    const text = group.length ? source.slice(group[0].pos, group.at(-1).end) : '';
    if (text && (attribution.test(text) || (includeCredits && /algorithm|\bby\b|implementation|implementaion/i.test(text)))) groups.push(text);
    group = [];
  };
  for (const range of [...ranges.values()].sort((a, b) => a.pos - b.pos)) {
    if (group.length && source.slice(group.at(-1).end, range.pos).trim()) flush();
    group.push(range);
  }
  flush(); return groups;
}

async function licenseFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) result.push(...await licenseFiles(directory, path));
    else if (entry.isFile() && licenseName.test(entry.name) && !/\.(?:[cm]?js|ts|map|json)$/i.test(entry.name)) result.push(path);
  }
  return result.sort();
}

function packageDirectory(path) {
  assert(/^node_modules\/(?:@[\w.-]+\/)?[\w.-]+\//.test(path) && !path.split('/').some((part) => part === '..'), 'Invalid inventory path');
  const marker = path.lastIndexOf('node_modules/');
  const tail = path.slice(marker + 'node_modules/'.length).split('/');
  return path.slice(0, marker) + 'node_modules/' + tail.slice(0, tail[0].startsWith('@') ? 2 : 1).join('/');
}

export async function verifyDocumentBaselines(documents) {
  assert(Array.isArray(documents) && documents.length, 'Missing audited license baseline');
  for (const document of documents) {
    packageDirectory(document.path);
    assert.equal(hash(await readFile(document.path)), document.sha256, `Audited license changed or missing: ${document.path}`);
  }
}

export async function collectLicenseAudit(output = 'dist') {
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  const policy = JSON.parse(await readFile('third-party/policy.json', 'utf8'));
  const inventories = await Promise.all(['content', 'popup'].map(async (target) => JSON.parse(await readFile(join(output, `THIRD_PARTY_MODULES.${target}.json`), 'utf8'))));
  const bundled = new Map();
  for (const inventory of inventories) {
    assert(Array.isArray(inventory.modules) && inventory.modules.length > 0, 'Empty retained-module inventory');
    for (const path of inventory.modules) {
      const directory = packageDirectory(path);
      if (!bundled.has(directory)) bundled.set(directory, new Set());
      bundled.get(directory).add(path.slice(directory.length + 1));
      assert(!/node_modules\/mathjs\/.*(?:\/sparse\/|\/cs[A-Z][^/]*\.js$)/.test(path), 'CSparse inclusion changed: a new LGPL audit is required');
      assert(!path.includes('node_modules/victory-vendor/lib-vendor/'), 'Vendored D3 inclusion changed: audit the exact vendored version before distribution');
    }
    for (const helper of inventory.generated) assert(['rollup-commonjs-helpers', 'vite-modulepreload-polyfill'].includes(helper), 'Unreviewed build helper');
  }
  const directories = new Set(Object.entries(lock.packages).filter(([path, pkg]) => path.startsWith('node_modules/') && !pkg.dev).map(([path]) => path));
  for (const directory of bundled.keys()) directories.add(directory);
  // Vite distributes the generated preload/commonjs helper code and its notices.
  directories.add('node_modules/vite');
  directories.add('node_modules/tailwindcss');
  const sections = ['DeepSeek UI Engine — production dependency notices\nSome listed packages may not be included in the final bundle.',
    'Package license labels below are metadata, not conclusions about every file. Retained source attributions and nested license texts are preserved separately.'];
  const coverage = [];
  for (const directory of directories) {
    const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    const modules = [...(bundled.get(directory) ?? [])].sort();
    const buildInput = ['vite', 'tailwindcss'].includes(pkg.name);
    if (modules.length || buildInput) assert.equal(policy.auditedVersions[pkg.name], pkg.version, `Unaudited bundled version: ${pkg.name}@${pkg.version}`);
    const documents = await licenseFiles(directory);
    const contents = await Promise.all(documents.map(async (path) => `${path}\n${await readFile(join(directory, path), 'utf8')}`));
    // Keep the legacy package header and all existing root declarations.
    sections.push(`${pkg.name}@${pkg.version}\nLicense: ${pkg.license ?? 'See package source'}\n${contents.join('\n\n')}`);
    const comments = [];
    for (const path of modules) {
      if (!/\.[cm]?js$/.test(path)) continue;
      for (const text of attributionComments(await readFile(join(directory, path), 'utf8'), pkg.name === 'seedrandom')) {
        sections.push(`${pkg.name}@${pkg.version} — source attribution: ${path}\n${text}`);
        comments.push({ path, sha256: hash(text) });
      }
    }
    if (modules.length) assert(documents.length || comments.length, `No license evidence for bundled package ${pkg.name}`);
    coverage.push({ name: pkg.name, version: pkg.version, bundled: modules.length > 0, buildInput, modules,
      documents: await Promise.all(documents.map(async (path) => ({ path, sha256: hash(await readFile(join(directory, path))) }))), attributions: comments });
  }
  // A missing file must not disappear silently from dynamic directory enumeration.
  await verifyDocumentBaselines(policy.requiredDocuments);
  assert(Array.isArray(policy.requiredAttributions) && policy.requiredAttributions.length, 'Missing audited source attribution baseline');
  const presentAttributions = new Set(coverage.flatMap((pkg) => pkg.attributions.map((item) => `${item.sha256}:${pkg.name}:${item.path}`)));
  for (const item of policy.requiredAttributions) assert(presentAttributions.has(`${item.sha256}:${item.name}:${item.path}`), `Audited attribution changed or missing: ${item.name}/${item.path}`);
  for (const evidence of policy.upstreamTexts) {
    const text = await readFile(evidence.path, 'utf8');
    assert.equal(hash(text), evidence.sha256, `Upstream license changed: ${evidence.path}`);
    sections.push(`Additional upstream license text — ${evidence.path}\n${text}`);
  }
  return { notices: sections.join('\n\n' + '='.repeat(72) + '\n\n') + '\n', coverage, inventories, unresolved: policy.unresolved };
}

export function verifyLicenseNotices(actual, expected) {
  assert.equal(actual, expected.notices, 'Third-party notices are missing, truncated, or out of date');
  for (const text of ['Copyright 2019 David Bau.', 'Copyright (C) 2010 by Johannes Baagøe',
    'Copyright 2018 Vladimir Agafonkin', 'Copyright (c) 2018, Vladimir Agafonkin',
    'Jim Palmer', 'Dave Koelle', 'Copyright (c) 2008-2016 Jim Palmer',
    'Copyright (c) 2015-2020 Mauricio Poppe', 'Boost Software License - Version 1.0',
    'Permission is hereby granted', 'Permission to use, copy, modify, and/or distribute']) assert(actual.includes(text), `Missing audited notice: ${text}`);
}
