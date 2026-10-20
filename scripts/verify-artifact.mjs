import assert from 'node:assert/strict';
import ts from 'typescript';

const network = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'cookie']);
const globals = new Set(['window', 'globalThis', 'self', 'global']);
const unwrap = (node) => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
function staticText(node) {
  node = unwrap(node);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticText(node.left), right = staticText(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
}
function rootName(node) {
  node = unwrap(node);
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return rootName(node.expression);
}
function isPropertyName(node) {
  return (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
    || ((ts.isPropertyAssignment(node.parent) || ts.isMethodDeclaration(node.parent)) && node.parent.name === node);
}

export function verifyScript(source, { name, standalone }) {
  const virtualFile = '/__dsui_bundle__.js';
  const syntax = ts.createSourceFile(virtualFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(syntax.parseDiagnostics.length, 0, `${name}: invalid JavaScript`);
  // Bind lexical symbols without loading libraries, imports or any filesystem files.
  const options = { allowJs: true, noLib: true, noResolve: true, target: ts.ScriptTarget.Latest };
  const host = { ...ts.createCompilerHost(options), getSourceFile: (file) => file === virtualFile ? syntax : undefined,
    fileExists: (file) => file === virtualFile, readFile: () => undefined, getCurrentDirectory: () => '/' };
  const checker = ts.createProgram([virtualFile], options, host).getTypeChecker();
  function globalRoot(node, seen = new Set()) {
    node = unwrap(node);
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node), declaration = symbol?.valueDeclaration;
      if (globals.has(node.text) && !declaration) return true;
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer && !seen.has(symbol)) {
        seen.add(symbol); return globalRoot(declaration.initializer, seen);
      }
      return false;
    }
    return (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && globalRoot(node.expression, seen);
  }
  function check(node) {
    if (standalone) assert(!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node), 'Content script must be standalone');
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      assert(/^\.\.?\//.test(node.moduleSpecifier.text), `${name}: module must be local`);
    }
    if (ts.isPropertyAccessExpression(node)) assert(node.getText(syntax) !== 'process.env.NODE_ENV', 'Resolve NODE_ENV during build');
    if (ts.isIdentifier(node) && !isPropertyName(node)) {
      const safeIntrinsic = node.text === 'Function' && ts.isPropertyAccessExpression(node.parent)
        && node.parent.expression === node && ['prototype', 'toString'].includes(node.parent.name.text);
      assert(safeIntrinsic || (!['eval', 'Function'].includes(node.text) && !network.has(node.text)), `${name}: forbidden capability ${node.text}`);
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const key = ts.isPropertyAccessExpression(node) ? node.name.text : staticText(node.argumentExpression);
      const global = globalRoot(node.expression);
      assert(!(key === 'Function' || network.has(key) || (global && (key === 'eval' || key === undefined))), `${name}: forbidden member capability ${key ?? 'computed global property'}`);
      assert(!(key === 'constructor' && rootName(node.expression) === 'Function'), `${name}: no constructor through Function.prototype`);
      const base = unwrap(node.expression);
      assert(!(key === 'constructor' && (ts.isFunctionExpression(base) || ts.isArrowFunction(base))), `${name}: no dynamic constructor from a function literal`);
    }
    if (ts.isCallExpression(node)) {
      assert(node.expression.kind !== ts.SyntaxKind.ImportKeyword, 'No dynamic imports');
      const callee = unwrap(node.expression);
      const timer = ts.isIdentifier(callee) ? callee.text
        : ts.isPropertyAccessExpression(callee) && globalRoot(callee.expression) ? callee.name.text : undefined;
      const first = node.arguments[0];
      if (first && ['setTimeout', 'setInterval'].includes(timer)) {
        assert(staticText(first) === undefined && !ts.isTemplateExpression(unwrap(first)), `${name}: no string-code timers`);
      }
    }
    ts.forEachChild(node, check);
  }
  check(syntax);
}
