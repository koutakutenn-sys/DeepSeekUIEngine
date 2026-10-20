import assert from 'node:assert/strict';
import ts from 'typescript';

const network = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'cookie']);
const globals = new Set(['window', 'globalThis', 'self', 'global']);
const timers = new Set(['setTimeout', 'setInterval']);
// Built-ins whose members are functions, so `.constructor` leads back to Function.
const intrinsics = new Set([
  'Function', 'Object', 'Array', 'String', 'Number', 'Boolean', 'RegExp', 'Date', 'Promise', 'Symbol', 'BigInt',
  'Math', 'JSON', 'Reflect', 'Proxy', 'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'FinalizationRegistry',
  'Error', 'TypeError', 'RangeError', 'EvalError', 'ReferenceError', 'SyntaxError', 'URIError', 'AggregateError',
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array',
  'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array',
]);
const unwrap = (node) => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
function staticText(node) {
  node = unwrap(node);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticText(node.left), right = staticText(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
}
// Member name from dot access or from a constant computed key (string literal / concatenation).
function memberKey(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node)) return staticText(node.argumentExpression);
}
// Timer calls execute code passed as a string, including template literals.
function isStringCode(node) {
  node = unwrap(node);
  return staticText(node) !== undefined || ts.isTemplateExpression(node);
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
  const symbolOf = (node) => checker.getSymbolAtLocation(node);
  // Follow simple `const alias = <initializer>` chains. There is no evaluation, only declaration lookup.
  function followsAlias(node, visit, seen) {
    const symbol = symbolOf(node), declaration = symbol?.valueDeclaration;
    if (!declaration || seen.has(symbol) || !ts.isVariableDeclaration(declaration) || !declaration.initializer) return false;
    seen.add(symbol);
    return visit(declaration.initializer);
  }
  function globalRoot(node, seen = new Set()) {
    node = unwrap(node);
    if (documentRoot(node)) return true;
    if (ts.isIdentifier(node)) {
      const declaration = symbolOf(node)?.valueDeclaration;
      if (globals.has(node.text) && !declaration) return true;
      return followsAlias(node, (initializer) => globalRoot(initializer, seen), seen);
    }
    return (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && globalRoot(node.expression, seen);
  }
  // `document` or a simple alias of it.
  function documentReference(node, seen = new Set()) {
    node = unwrap(node);
    if (!ts.isIdentifier(node)) return false;
    if (!symbolOf(node)?.valueDeclaration) return node.text === 'document';
    return followsAlias(node, (initializer) => documentReference(initializer, seen), seen);
  }
  // `document.defaultView` (including `const doc = document; doc.defaultView`) is a global root.
  function documentRoot(node, seen = new Set()) {
    node = unwrap(node);
    if (ts.isIdentifier(node)) return followsAlias(node, (initializer) => documentRoot(initializer, seen), seen);
    return (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      && memberKey(node) === 'defaultView' && documentReference(node.expression);
  }
  // Receiver that is (or aliases) a built-in namespace/function or a function/array/string literal.
  function builtinRoot(node, seen = new Set()) {
    node = unwrap(node);
    if (ts.isIdentifier(node)) {
      if (!symbolOf(node)?.valueDeclaration) return intrinsics.has(node.text);
      return followsAlias(node, (initializer) => builtinRoot(initializer, seen), seen);
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return builtinRoot(node.expression, seen);
    return ts.isArrayLiteralExpression(node) || ts.isStringLiteralLike(node) || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node) || ts.isClassExpression(node);
  }
  // Global timer, a static/computed member of a global root, or an alias of either.
  function globalTimer(node, seen = new Set()) {
    node = unwrap(node);
    if (ts.isIdentifier(node)) {
      if (!symbolOf(node)?.valueDeclaration) return timers.has(node.text);
      return followsAlias(node, (initializer) => globalTimer(initializer, seen), seen);
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const key = memberKey(node);
      return key !== undefined && timers.has(key) && globalRoot(node.expression);
    }
    return false;
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
      const key = memberKey(node);
      const global = globalRoot(node.expression);
      assert(!(key === 'Function' || network.has(key) || (global && (key === 'eval' || key === undefined))), `${name}: forbidden member capability ${key ?? 'computed global property'}`);
      assert(!(key === 'constructor' && builtinRoot(node.expression)), `${name}: no constructor through a built-in or literal receiver`);
    }
    if (ts.isCallExpression(node)) {
      assert(node.expression.kind !== ts.SyntaxKind.ImportKeyword, 'No dynamic imports');
      const first = node.arguments[0];
      assert(!(first && isStringCode(first) && globalTimer(node.expression)), `${name}: no string-code timers`);
    }
    ts.forEachChild(node, check);
  }
  check(syntax);
}
