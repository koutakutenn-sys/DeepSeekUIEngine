import { describe, expect, it } from 'vitest';
import { parsePayload } from '../src/protocol';
import { chart, metrics, payload, table, timeline } from './fixtures';

describe('DSUI protocol', () => {
  it.each([chart, metrics, table, timeline])('accepts $type', (block) => {
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
