import { describe, expect, it } from 'vitest';
import { parsePayload } from '../src/protocol';
import { payload, quadratic } from './fixtures';
import { accordion, comparison, infoCard, lineChart, p1Blocks, pieChart, progress, scatterChart, tabs } from './p1-fixtures';

describe('P1 protocol', () => {
  it.each(p1Blocks)('accepts the bounded $type shape', (block) => {
    expect(parsePayload(payload([block]))?.blocks[0].type).toBe(block.type);
  });
  it.each(p1Blocks)('rejects unknown fields on $type', (block) => {
    expect(parsePayload(payload([{ ...block, onClick: 'fetch("https://example.com")' }]))).toBeNull();
  });
  it('retains explicit line gaps and rejects missing, undeclared or unsafe series keys', () => {
    const accepted = parsePayload(payload([lineChart]));
    expect(accepted).not.toBeNull();
    expect(accepted?.blocks[0]).toMatchObject({ items: [{ label: '周一' }, { values: { beta: null } }, { label: '周三' }] });
    for (const values of [{ alpha: 1 }, { alpha: 1, beta: 2, extra: 3 }, { alpha: {}, beta: 2 }]) {
      expect(parsePayload(payload([{ ...lineChart, items: [{ label: '一天', values }] }]))).toBeNull();
    }
    expect(parsePayload(payload([{ ...lineChart, series: [lineChart.series[0], lineChart.series[0]] }]))).toBeNull();
    expect(parsePayload(payload([{ ...lineChart, series: [{ key: 'constructor', label: '危险字段' }], items: [] }]))).toBeNull();
    expect(parsePayload(payload([{ ...lineChart, series: Array.from({ length: 7 }, (_, i) => ({ key: `s${i}`, label: `${i}` })), items: [] }]))).toBeNull();
    expect(parsePayload(payload([{ ...lineChart, series: [] }]))).toBeNull();
  });
  it('allows honest empty charts, but rejects negative pie values and nonfinite or excessive coordinates', () => {
    for (const chart of [lineChart, pieChart, scatterChart]) {
      expect(parsePayload(payload([{ ...chart, items: [] }]))).not.toBeNull();
      const items = Array.from({ length: 30 }, () => chart.items[0]);
      expect(parsePayload(payload([{ ...chart, items }]))).not.toBeNull();
      expect(parsePayload(payload([{ ...chart, items: [...items, chart.items[0]] }]))).toBeNull();
    }
    expect(parsePayload(payload([{ ...pieChart, items: [{ label: '零值', value: 0 }] }]))).not.toBeNull();
    expect(parsePayload(payload([{ ...pieChart, items: [{ label: '负值', value: -1 }] }]))).toBeNull();
    for (const coordinate of [null, '2', 1e12 + 1, -1e12 - 1]) {
      expect(parsePayload(payload([{ ...scatterChart, items: [{ x: coordinate, y: 2 }] }]))).toBeNull();
    }
    expect(parsePayload(payload([{ ...scatterChart, items: [{ x: -1e12, y: 1e12 }] }]))).not.toBeNull();
    expect(parsePayload(payload([scatterChart]).replace('"x":-3', '"x":1e999'))).toBeNull();
  });
  it('bounds progress and card content without accepting HTML or styles as executable options', () => {
    for (const value of [0, 100, 72.5]) expect(parsePayload(payload([{ ...progress, value }]))).not.toBeNull();
    for (const value of [-0.1, 100.1, null, '25']) expect(parsePayload(payload([{ ...progress, value }]))).toBeNull();
    expect(parsePayload(payload([{ ...infoCard, description: '' }]))).toBeNull();
    expect(parsePayload(payload([{ ...infoCard, tone: 'javascript' }]))).toBeNull();
    expect(parsePayload(payload([{ ...comparison, items: [comparison.items[0]] }]))).toBeNull();
    expect(parsePayload(payload([{ ...comparison, items: Array(5).fill(comparison.items[0]) }]))).toBeNull();
    expect(parsePayload(payload([{ ...comparison, items: [{ ...comparison.items[0], url: 'javascript:alert(1)' }, comparison.items[1]] }]))).toBeNull();
    const literal = '<img src=x onerror=alert(1)>';
    expect(parsePayload(payload([{ ...infoCard, description: literal }]))?.blocks[0]).toMatchObject({ description: literal });
  });
  it('rejects container recursion, duplicate item IDs and references to missing initial selections', () => {
    expect(parsePayload(payload([tabs, accordion]))).not.toBeNull();
    for (const container of [tabs, accordion]) {
      expect(parsePayload(payload([{ ...container, items: [] }]))).toBeNull();
      expect(parsePayload(payload([{ ...container, items: [container.items[0], container.items[0]] }]))).toBeNull();
      expect(parsePayload(payload([{ ...container, items: [{ ...container.items[0], blocks: [tabs] }] }]))).toBeNull();
      expect(parsePayload(payload([{ ...container, items: [{ ...container.items[0], blocks: [] }] }]))).toBeNull();
      expect(parsePayload(payload([{ ...container, items: [{ ...container.items[0], blocks: [infoCard, infoCard, infoCard, infoCard] }] }]))).toBeNull();
    }
    expect(parsePayload(payload([{ ...tabs, defaultTab: 'missing' }]))).toBeNull();
    expect(parsePayload(payload([{ ...accordion, defaultOpen: ['missing'] }]))).toBeNull();
    expect(parsePayload(payload([{ ...accordion, defaultOpen: ['options', 'options'] }]))).toBeNull();
    expect(parsePayload(payload([{ ...tabs, defaultTab: 'summary' }]))).not.toBeNull();
  });
  it('enforces global duplicate-ID, total-block and function-plot budgets through containers', () => {
    expect(parsePayload(payload([tabs, infoCard]))).toBeNull();
    const group = (id: string, count: number) => ({ id, title: id, type: 'tabs', items: Array.from({ length: count }, (_, i) => ({
      id: `p${i}`, label: `${i}`, blocks: [{ ...infoCard, id: `${id}-${i}` }],
    })) });
    expect(parsePayload(payload([group('first', 6), group('second', 4)]))).not.toBeNull(); // 2 containers + 10 leaves.
    expect(parsePayload(payload([group('first', 6), group('second', 5)]))).toBeNull();
    const plots = (count: number) => ({ ...tabs, defaultTab: 'plots', items: Array.from({ length: count }, (_, i) => ({
      id: i ? `plot-${i}` : 'plots', label: `${i}`, blocks: [{ ...quadratic, id: `plot-${i}` }],
    })) });
    expect(parsePayload(payload([plots(3)]))).not.toBeNull();
    expect(parsePayload(payload([plots(4)]))).toBeNull();
  });
});
