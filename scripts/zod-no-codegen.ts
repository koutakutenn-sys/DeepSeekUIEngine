import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import type { Plugin } from 'vite';

// Pinned build-time replacements: use Zod's interpreter, never its runtime code generator.
const sources = {
  'util.js': 'bb08133b11b478c8e715038fff26ebea204d7fd5443fba31fe138b142d202efb',
  'doc.js': 'be4c1b1a1ad247cc70f360a572060edd7e0cea24252c3a319f33d247899c5643',
};

export function rewriteZod(source: string, id: string): string | null {
  const path = id.split('?')[0].replaceAll('\\', '/');
  const file = (Object.keys(sources) as (keyof typeof sources)[]).find((name) => path.endsWith(`/node_modules/zod/v4/core/${name}`));
  if (!file) return null;
  assert.equal(createHash('sha256').update(source).digest('hex'), sources[file], `Zod ${file} source changed; review the no-codegen patch`);
  const syntax = ts.createSourceFile(id, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (file === 'util.js') {
    const statement = syntax.statements.find((node) => ts.isVariableStatement(node)
      && node.declarationList.declarations.some((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === 'allowsEval'));
    assert(statement, 'Missing Zod allowsEval probe');
    return source.slice(0, statement.getStart(syntax)) + 'export const allowsEval = { value: false };' + source.slice(statement.end);
  }
  const doc = syntax.statements.find((node) => ts.isClassDeclaration(node) && node.name?.text === 'Doc');
  assert(doc && ts.isClassDeclaration(doc), 'Missing Zod Doc');
  const compile = doc.members.find((node) => ts.isMethodDeclaration(node) && node.name.getText(syntax) === 'compile');
  assert(compile && ts.isMethodDeclaration(compile) && compile.body, 'Missing Zod Doc compiler');
  return source.slice(0, compile.body.getStart(syntax)) + '{ throw new Error("Dynamic schema compilation is disabled"); }' + source.slice(compile.body.end);
}

export function zodNoCodegen(): Plugin {
  return { name: 'zod-no-codegen', enforce: 'pre', transform(source, id) {
    const code = rewriteZod(source, id);
    return code === null ? null : { code, map: null };
  } };
}
