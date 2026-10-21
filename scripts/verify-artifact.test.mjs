import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyScript } from './verify-artifact.mjs';

for (const code of [0xfdd0, 0xfffe, 0xffff, 0x1ffff, 0x10ffff]) test(`rejects literal noncharacter U+${code.toString(16)} that Chrome refuses in extension scripts`, () => {
  assert.throws(() => verifyScript(`const token = "${String.fromCodePoint(code)}"`, { name: 'content.js', standalone: true }), /noncharacter/);
});
test('allows JavaScript escapes for noncharacter sentinel values', () => {
  verifyScript(String.raw`const token = "\uFFFF"; const label = "中文";`, { name: 'content.js', standalone: true });
});
test('allows read-only instanceof Function checks without allowing dynamic constructors', () => {
  for (const standalone of [true, false]) {
    assert.doesNotThrow(() => verifyScript('function inspect(value) { return value instanceof Function; }', { name: 'type-check.js', standalone }));
    assert.throws(() => verifyScript('value instanceof Function("return 1")', { name: 'constructor.js', standalone }), /capability Function/);
  }
});

for (const source of [
  'eval("x")', 'new Function("return 1")', 'const F = Function; new F("return 1")', 'window.eval("x")', 'globalThis["eval"]("x")',
  '(0, eval)("x")', 'eval.call(null,"x")', 'const execute = globalThis.Function; execute("return 1")()',
  'const execute = window["ev"+"al"]; execute("x")',
  'const root = globalThis; root.eval("x")', 'const root = window; const next = root; next["ev"+"al"]("x")',
  '(function () {}).constructor("return 1")', 'setTimeout("alert(1)", 0)',
  'window["setTimeout"]("alert(1)", 0)', 'self["set"+"Interval"](`alert(1)`, 0)',
  'const timer = globalThis.setTimeout; timer("alert(1)", 0)',
  'Math.sin.constructor("return 1")()', 'const run = [].filter.constructor; run("return 1")()',
  'const fn = Math.sin; fn["constructor"]("return 1")()',
  'Function.prototype.call.constructor("return 1")()',
  'const root = document.defaultView; root.eval("1")',
  'const doc = document; const root = doc.defaultView; root["ev"+"al"]("1")',
  'fetch("https://example.invalid")', 'globalThis["fetch"]("https://example.invalid")',
  'new XMLHttpRequest()', 'new WebSocket("wss://example.invalid")', 'new EventSource("https://example.invalid")',
  'navigator.sendBeacon("https://example.invalid", "data")', 'document.cookie', 'Function.prototype.constructor("return 1")',
]) {
  for (const standalone of [true, false]) test(`rejects unsafe ${standalone ? 'content' : 'popup'} code: ${source}`, () => {
    assert.throws(() => verifyScript(source, { name: standalone ? 'content.js' : 'assets/popup.js', standalone }));
  });
}
test('allows inert strings, local UI code and local popup module imports', () => {
  verifyScript('const label = "eval fetch Function cookie"; document.body.textContent = label; Math.sin(1);', { name: 'content.js', standalone: true });
  verifyScript('import { value } from "./local.js"; console.log(value);', { name: 'popup.js', standalone: false });
  verifyScript('const callback = {eval: (x) => x}; callback.eval(1); Function.prototype.call.call(Math.sin, null, 1);', { name: 'content.js', standalone: true });
  verifyScript('function run(root) { return root.eval(1); } run({eval: (value) => value}); setTimeout(() => run({eval: (value) => value}), 0);', { name: 'content.js', standalone: true });
  verifyScript('window["setTimeout"](() => Math.sin(1), 0); const Math = {sin: {constructor: () => 1}}; Math.sin.constructor();', { name: 'content.js', standalone: true });
});
test('rejects external popup modules and dynamic imports', () => {
  assert.throws(() => verifyScript('import "https://example.invalid/script.js";', { name: 'popup.js', standalone: false }));
  assert.throws(() => verifyScript('import("./local.js")', { name: 'popup.js', standalone: false }));
});
test('retains the content-script standalone restriction', () => {
  assert.throws(() => verifyScript('import "./local.js";', { name: 'content.js', standalone: true }));
});
