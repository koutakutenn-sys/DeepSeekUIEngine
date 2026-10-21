import { describe, expect, it } from 'vitest';
import { createSafeSvg } from '../src/svg/sanitize-svg';

const wrap = (body: string, attributes = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" ${attributes}>${body}<rect x="1" y="1" width="20" height="20" fill="#fff"/></svg>`;
const gradient = '<defs><linearGradient id="paint" x1="0%" x2="100%"><stop offset="0%" stop-color="#123"/><stop offset="100%" stop-color="#456"/></linearGradient><marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z"/></marker><clipPath id="clip"><rect width="200" height="100"/></clipPath></defs><path d="M10 10 L200 100" stroke="url(#paint)" marker-end="url(#arrow)" clip-path="url(#clip)"/>';

describe('static SVG sanitization boundary', () => {
  it('preserves native gradients, clipping and arrow markers with diagram-local IDs', () => {
    const one = createSafeSvg(wrap(gradient), 'one'), two = createSafeSvg(wrap(gradient), 'two');
    expect(one.querySelector('linearGradient')?.id).toBe('dsui-svg-one-paint');
    expect(two.querySelector('linearGradient')?.id).toBe('dsui-svg-two-paint');
    expect(one.querySelector('[marker-end]')?.getAttribute('marker-end')).toBe('url(#dsui-svg-one-arrow)');
    expect(one.querySelector('[clip-path]')?.getAttribute('clip-path')).toBe('url(#dsui-svg-one-clip)');
    expect(one.querySelector('[stroke]')?.getAttribute('stroke')).toBe('url(#dsui-svg-one-paint)');
  });
  it('owns layout instead of trusting model root dimensions', () => {
    const root = createSafeSvg(wrap('<text>图</text>', 'width="100%" height="auto"'), 'layout');
    expect(root.getAttribute('width')).toBe('100%');
    expect(root.hasAttribute('height')).toBe(false);
  });
  it.each([
    '<script>alert(1)</script>', '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="https://example.invalid"/></div></foreignObject>',
    '<image href="https://example.invalid/image.png"/>', '<use href="#other"/>', '<a href="javascript:alert(1)"><text>link</text></a>',
    '<style>@import "https://example.invalid";</style>', '<animate attributeName="x" values="0;100" dur="1ms" repeatCount="indefinite"/>',
    '<filter id="filter"><feTurbulence baseFrequency="10"/></filter>',
  ])('removes unsupported active/resource-bearing element %s', (body) => {
    const root = createSafeSvg(wrap(body), 'clean');
    expect(root.querySelector('script, foreignObject, image, use, a, style, animate, filter')).toBeNull();
    expect(root.querySelector('rect')).not.toBeNull();
  });
  it('removes event, CSS and link attributes rather than delegating them to the page', () => {
    const root = createSafeSvg(wrap('<rect onload="alert(1)" style="fill:url(https://example.invalid)" href="javascript:alert(1)" width="10" height="10"/>'), 'attrs');
    expect(root.querySelector('[onload], [style], [href]')).toBeNull();
  });
  it.each([
    '<html xmlns="http://www.w3.org/1999/xhtml"/>', '<svg xmlns="http://www.w3.org/2000/svg"><path></svg>',
    '<!DOCTYPE svg [<!ENTITY x "value">]>' + wrap('<text>&x;</text>'),
    wrap('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'),
    wrap('<g id="same"/><g id="same"/>'), wrap('<rect fill="url(#missing)"/>'),
    wrap('<defs><marker id="cycle"><path d="M0 0L1 1" marker-end="url(#cycle)"/></marker></defs>'),
    wrap('<path d="M0 0L1e999 1"/>'), wrap('<text font-size="10000">巨大</text>'),
    wrap('<rect width="NaN"/>'), wrap('<rect transform="translate(Infinity,0)"/>'),
    wrap('<text>误导&#x202e;文字</text>'),
  ])('rejects malformed, unbounded or ambiguous diagram %s', (source) => {
    expect(() => createSafeSvg(source, 'reject')).toThrow();
  });
  it('rejects external paint references', () => {
    for (const url of ['https://example.invalid/a.svg#p', 'data:image/svg+xml;base64,PHN2Zz4=', '//example.invalid/#p']) {
      expect(() => createSafeSvg(wrap(`<rect fill="url(${url})"/>`), 'remote')).toThrow();
    }
  });
  it('enforces raw size, node count and depth budgets before mounting', () => {
    expect(() => createSafeSvg(wrap('<rect/>'.repeat(500)), 'nodes')).toThrow();
    expect(() => createSafeSvg(wrap('<g>'.repeat(16) + '<rect/>' + '</g>'.repeat(16)), 'depth')).toThrow();
    expect(() => createSafeSvg(wrap('<text>' + 'x'.repeat(20000) + '</text>'), 'size')).toThrow();
  });
  it('retains ordinary multilingual SVG text including valid emoji flags', () => {
    const text = '👩‍💻 العربية 🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
    expect(createSafeSvg(wrap(`<text>${text}</text>`), 'text').querySelector('text')?.textContent).toBe(text);
  });
});
