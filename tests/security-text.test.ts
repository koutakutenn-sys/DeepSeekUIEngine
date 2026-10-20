import { describe, expect, it } from 'vitest';
import { parsePayload } from '../src/protocol';
import { metrics, payload, table, timeline } from './fixtures';
import { comparison, infoCard, lineChart, progress, scatterChart, tabs } from './p1-fixtures';

describe('model text integrity', () => {
  it.each(['\u202e', '\u202d', '\u2066', '\u2067', '\u2068', '\u2069', '\u200b', '\u2060', '\ufeff', '\u0000', '\u001b', '\u0085'])('rejects misleading direction, format or control character %j', (control) => {
    expect(parsePayload(payload([{ ...infoCard, description: `正常${control}伪装` }]))).toBeNull();
  });
  it('applies the policy to titles, labels, cell values, metric values, units and nested text', () => {
    const bad = 'a\u202eb';
    for (const block of [
      { ...infoCard, title: bad }, { ...metrics, items: [{ label: bad, value: 1 }] },
      { ...metrics, items: [{ label: '值', value: bad }] },
      { ...metrics, items: [{ label: '值', value: 1, unit: bad, change: bad }] },
      { ...table, rows: [{ name: bad }] },
      { ...timeline, items: [{ date: bad, title: '事项' }] },
      { ...lineChart, series: [{ key: 'a', label: bad }], items: [] },
      { ...lineChart, unit: bad }, { ...scatterChart, xLabel: bad }, { ...scatterChart, yUnit: bad },
      { ...progress, label: bad }, { ...comparison, items: [{ label: '一', description: '说明', features: [bad] }, comparison.items[1]] },
      { ...tabs, items: [{ id: 'one', label: bad, blocks: [infoCard] }] },
    ]) expect(parsePayload(payload([block]))).toBeNull();
  });
  it.each(['\n', '\r', '\t', '\u2028', '\u2029'])('keeps short labels on one line (%j)', (lineBreak) => {
    expect(parsePayload(payload([{ ...infoCard, title: `标题${lineBreak}伪装` }]))).toBeNull();
  });
  it('preserves emoji joins, Persian joins, ordinary RTL text and multiline descriptions without normalization', () => {
    const title = '👩‍💻 می‌روم עברית العربية';
    const description = '第一行\n第二行\r\n第三行\t说明';
    const parsed = parsePayload(payload([{ ...infoCard, title, description }]));
    expect(parsed?.blocks[0]).toMatchObject({ title, description });
  });
  it.each(['\u{E0065}\u{E006E}\u{E0067}', '\u{E0073}\u{E0063}\u{E0074}', '\u{E0077}\u{E006C}\u{E0073}'])('preserves a complete RGI subdivision flag %j without changing the payload', (suffix) => {
    const title = `旗帜\u{1F3F4}\u{E0067}\u{E0062}${suffix}\u{E007F}`;
    expect(parsePayload(payload([{ ...infoCard, title }]))?.blocks[0].title).toBe(title);
  });
  it.each(['\u{E0067}', '\u{E007F}', '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}', '\u{1F3F4}\u{E0067}\u{E0062}\u{E0078}\u{E007F}'])('rejects stray or incomplete hidden emoji tags %j', (tags) => {
    expect(parsePayload(payload([{ ...infoCard, title: `正常${tags}文字` }]))).toBeNull();
  });
});
