import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rewriteZod } from './zod-no-codegen.ts';
import { verifyScript } from './verify-artifact.mjs';

test('the pinned Zod probe and Doc compiler cannot retain dynamic code generation', async () => {
  for (const file of ['util.js', 'doc.js']) {
    const path = `node_modules/zod/v4/core/${file}`;
    const source = await readFile(path, 'utf8');
    assert.throws(() => verifyScript(source, { name: path, standalone: false })); // Negative control: real unmodified upstream source.
    const rewritten = rewriteZod(source, `/project/${path}`);
    assert.equal(typeof rewritten, 'string');
    verifyScript(rewritten, { name: path, standalone: false });
    if (file === 'doc.js') {
      const { Doc } = await import(`data:text/javascript;base64,${Buffer.from(rewritten).toString('base64')}`);
      const doc = new Doc(); doc.write('return 1');
      assert.throws(() => doc.compile(), /disabled/);
    }
  }
});
test('changed Zod source fails closed instead of applying a stale patch', async () => {
  const path = '/project/node_modules/zod/v4/core/util.js';
  const source = await readFile('node_modules/zod/v4/core/util.js', 'utf8');
  assert.throws(() => rewriteZod(`${source}\n// modified`, path), /source changed/);
});
test('unrelated modules are not rewritten', () => {
  assert.equal(rewriteZod('const F = Function;', '/project/src/protocol.ts'), null);
});
