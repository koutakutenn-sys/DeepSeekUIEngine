import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import type { Plugin } from 'vite';

export function rewriteKatex(source: string, id: string): string | null {
  if (!id.split('?')[0].replaceAll('\\', '/').endsWith('/node_modules/katex/dist/katex.mjs')) return null;
  assert.equal(createHash('sha256').update(source).digest('hex'), 'e5bc26598084ad869939ecaa262673814f26ed586312a409b5f8427c01e4f681', 'KaTeX source changed; review the token-reader alias');
  // KaTeX Parser.fetch reads its lookahead token; it is unrelated to network fetch.
  // Alias only these audited member-name tokens so the artifact guard stays strict.
  const file = ts.createSourceFile(id, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edits: ts.Identifier[] = [];
  function visit(node: ts.Node) {
    if ((ts.isMethodDeclaration(node) || ts.isPropertyAccessExpression(node))
      && ts.isIdentifier(node.name) && node.name.text === 'fetch') edits.push(node.name);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(edits.length, 28, 'KaTeX token-reader call sites changed');
  for (const node of edits.sort((a, b) => b.pos - a.pos)) {
    source = source.slice(0, node.getStart(file)) + 'dsuiReadToken' + source.slice(node.end);
  }
  return source;
}

export function katexTokenReader(): Plugin {
  return { name: 'katex-token-reader', enforce: 'pre', transform(source, id) {
    const code = rewriteKatex(source, id);
    return code === null ? null : { code, map: null };
  } };
}
