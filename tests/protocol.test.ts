import { describe, expect, it } from 'vitest';
import { parsePayload } from '../src/protocol';
import { chart, metrics, payload, quadratic, table, timeline } from './fixtures';

describe('DSUI protocol', () => {
  it.each([chart, metrics, table, timeline, quadratic])('accepts $type', (block) => {
    expect(parsePayload(payload([block]))?.blocks[0].type).toBe(block.type);
  });
  it('rejects incomplete or invalid JSON and unsupported versions', () => {
    for (const text of ['{', 'null', '[]', payload().slice(0, -1), payload().replace('"version":1', '"version":2')]) {
      expect(parsePayload(text)).toBeNull();
    }
  });
  it('enforces limits, including duplicate ids and unknown fields', () => {
    expect(parsePayload(payload([chart, metrics, table]))).not.toBeNull();
    expect(parsePayload(payload([chart, metrics, table, timeline]))).toBeNull();
    expect(parsePayload(payload([chart, chart]))).toBeNull();
    expect(parsePayload(payload([{ ...chart, html: '<script>alert(1)</script>' }]))).toBeNull();
    expect(parsePayload(payload([{ ...chart, items: Array.from({ length: 30 }, (_, i) => ({ label: `${i}`, value: i })) }]))).not.toBeNull();
    expect(parsePayload(payload([{ ...chart, items: Array.from({ length: 31 }, (_, i) => ({ label: `${i}`, value: i })) }]))).toBeNull();
    expect(parsePayload(payload([{ ...table, rows: Array(50).fill({ name: 'A', score: 1 }) }]))).not.toBeNull();
    expect(parsePayload(payload([{ ...table, rows: Array(51).fill({ name: 'A', score: 1 }) }]))).toBeNull();
  });
  it('rejects inconsistent table columns, nested cells and dangerous keys', () => {
    expect(parsePayload(payload([{ ...table, rows: [{ name: { html: '<b>x</b>' } }] }]))).toBeNull();
    expect(parsePayload(payload([{ ...table, rows: [{ other: 'x' }] }]))).toBeNull();
    expect(parsePayload(payload([{ ...table, columns: [{ key: '__proto__', label: 'x' }] }]))).toBeNull();
    expect(parsePayload(payload([{ ...table, columns: [table.columns[0], table.columns[0]] }]))).toBeNull();
  });
  it('rejects nonfinite numbers, huge strings and empty blocks', () => {
    expect(parsePayload(payload().replace('77', '1e999'))).toBeNull();
    expect(parsePayload(payload([{ ...chart, title: 'x'.repeat(161) }]))).toBeNull();
    expect(parsePayload(payload([]))).toBeNull();
    expect(parsePayload(' '.repeat(100_001))).toBeNull();
  });
  it('keeps model-supplied markup as literal text', () => {
    const text = '<img src=x onerror=alert(1)>';
    const result = parsePayload(payload([{ ...metrics, items: [{ label: text, value: text }] }]));
    expect(result?.blocks[0]).toMatchObject({ items: [{ label: text, value: text }] });
  });
});

describe('quadratic plot protocol', () => {
  it('requires exactly three unique parameters and the fixed quadratic preset', () => {
    for (const parameters of [[], quadratic.parameters.slice(0, 2), [...quadratic.parameters, quadratic.parameters[0]],
      [quadratic.parameters[0], quadratic.parameters[0], quadratic.parameters[2]],
      quadratic.parameters.map((p) => ({ ...p, key: p.key === 'b' ? 'd' : p.key }))]) {
      expect(parsePayload(payload([{ ...quadratic, parameters }]))).toBeNull();
    }
    expect(parsePayload(payload([{ ...quadratic, preset: 'expression' }]))).toBeNull();
    expect(parsePayload(payload([{ ...quadratic, expression: 'alert(1)' }]))).toBeNull();
    expect(parsePayload(payload([{ ...quadratic, viewport: { ...quadratic.viewport, color: 'red' } }]))).toBeNull();
  });
  it('rejects unsafe slider ranges and finite numbers beyond the documented bounds', () => {
    for (const patch of [{ value: 6 }, { min: 1, max: 1 }, { min: 2 }, { step: 0 }, { step: -1 },
      { value: '1' }, { min: -10001 }, { max: 10001 }, { step: 1e-12 }, { onChange: 'fetch()' }]) {
      const parameters = quadratic.parameters.map((p, i) => i === 0 ? { ...p, ...patch } : p);
      expect(parsePayload(payload([{ ...quadratic, parameters }]))).toBeNull();
    }
    expect(parsePayload(payload([quadratic]).replace('"value":1,', '"value":1e309,'))).toBeNull();
    const parameters = quadratic.parameters.map((p) => ({ ...p, min: -10000, max: 10000, value: 10000 }));
    expect(parsePayload(payload([{ ...quadratic, parameters }]))).not.toBeNull();
    expect(parsePayload(payload([{ ...quadratic, parameters: quadratic.parameters.map((p) => ({ ...p, value: 0.15 })) }]))).not.toBeNull();
  });
  it('bounds viewports, preserves stream fallback and keeps the existing reply limits', () => {
    for (const patch of [{ xMin: 8 }, { yMax: -8 }, { xMax: 1e7 }, { xMin: 0, xMax: 1e-10 },
      { yMin: -1e6, yMax: 1e6 }, { yMin: null }]) {
      expect(parsePayload(payload([{ ...quadratic, viewport: { ...quadratic.viewport, ...patch } }]))).toBeNull();
    }
    expect(parsePayload(payload([quadratic, metrics, chart]))).not.toBeNull();
    expect(parsePayload(payload([quadratic, metrics, chart, table]))).toBeNull();
    expect(parsePayload(payload([quadratic]).slice(0, -2))).toBeNull();
    expect(parsePayload(payload([quadratic]) + ' '.repeat(100000))).toBeNull();
  });
});
