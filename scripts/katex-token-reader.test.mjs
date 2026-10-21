import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import katex from 'katex';
import { rewriteKatex } from './katex-token-reader.ts';
import { verifyScript } from './verify-artifact.mjs';

const path = new URL('../node_modules/katex/dist/katex.mjs', import.meta.url).pathname;
const source = await readFile(path, 'utf8');

test('KaTeX token-reader alias passes the unchanged artifact guard while real fetch remains blocked', () => {
  assert.throws(() => verifyScript(source, { name: 'upstream-katex.js', standalone: false }), /capability fetch/);
  const patched = rewriteKatex(source, path);
  assert.doesNotThrow(() => verifyScript(patched, { name: 'katex.js', standalone: false }));
  assert.throws(() => verifyScript(patched + '\nglobalThis.fetch("https://example.invalid")', { name: 'katex.js', standalone: false }), /capability fetch/);
});
test('aliased parser preserves real MathML output for fractions, roots, cases and trigonometry', async () => {
  const patched = await import('data:text/javascript;base64,' + Buffer.from(rewriteKatex(source, path)).toString('base64'));
  for (const formula of [String.raw`y=\frac{x^2}{\sqrt{x+1}}`, String.raw`y=a\sin x`, String.raw`f(x)=\begin{cases}x&x>0\\-x&x\le0\end{cases}`]) {
    const options = { output: 'mathml', trust: false, strict: 'error' };
    assert.equal(patched.default.renderToString(formula, options), katex.renderToString(formula, options));
  }
});
test('unreviewed source mutations reject rather than silently aliasing a new library version', () => {
  assert.throws(() => rewriteKatex(source + '\nfetch("https://example.invalid")', path), /KaTeX source changed/);
  assert.equal(rewriteKatex('const x = 1', '/unrelated.js'), null);
});
