import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

const output = resolve('dist');
const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.deepEqual(manifest.content_scripts[0].matches, ['https://chat.deepseek.com/*']);
assert.equal(manifest.content_scripts[0].world, 'ISOLATED');
assert.equal(manifest.background, undefined);
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.web_accessible_resources, undefined);
for (const file of [...manifest.content_scripts[0].js, manifest.action.default_popup]) await access(join(output, file));
const schema = JSON.parse(await readFile(join(output, 'dsui.schema.json'), 'utf8'));
assert.equal(schema.properties.blocks.maxItems, 3);
const content = await readFile(join(output, 'content.js'), 'utf8');
assert(content.length > 1000, 'Content bundle must contain the actual engine');
const syntax = ts.createSourceFile('content.js', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function checkSyntax(node) {
  assert(!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node), 'Content script must be a standalone bundle');
  if (ts.isPropertyAccessExpression(node)) assert(node.getText(syntax) !== 'process.env.NODE_ENV', 'Browser bundle must resolve NODE_ENV during build');
  if (ts.isCallExpression(node)) {
    assert(node.expression.kind !== ts.SyntaxKind.ImportKeyword, 'No dynamic imports in the content script');
    assert(!(ts.isIdentifier(node.expression) && node.expression.text === 'eval'), 'No eval in the bundle');
  }
  if (ts.isNewExpression(node)) assert(!(ts.isIdentifier(node.expression) && node.expression.text === 'Function'), 'No Function constructor in the bundle');
  ts.forEachChild(node, checkSyntax);
}
checkSyntax(syntax);
const popup = await readFile(join(output, 'popup.html'), 'utf8');
assert(!/<script[^>]+src=["']https?:/.test(popup), 'Popup scripts must be bundled locally');
for (const match of popup.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)) await access(join(output, match[1]));
const assets = await readdir(join(output, 'assets'));
assert(assets.some((asset) => asset.endsWith('.css')));
console.log('MV3 build verified: local scripts, storage-only permissions, official site match.');
