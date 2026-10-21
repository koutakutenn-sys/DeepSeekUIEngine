import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockView } from '../src/components/BlockView';
import { parsePayload } from '../src/protocol';
import { payload, quadratic } from './fixtures';
import type { Bounds } from '../src/math/plot-expression';

const expressionPlot = { ...quadratic, preset: 'expression', expression: 'a*sin(x)', parameters: [quadratic.parameters[0]] };
function renderFormula(latex: string, overrides = {}) {
  const parsed = parsePayload(payload([{ ...expressionPlot, latex, ...overrides }]));
  expect(parsed).not.toBeNull();
  return render(<BlockView block={parsed!.blocks[0]} />);
}

describe('function definition LaTeX display', () => {
  it.each(['quadratic', 'expression'])('accepts optional display LaTeX in %s while retaining the original payload', (preset) => {
    const block = preset === 'quadratic' ? quadratic : expressionPlot;
    const latex = String.raw`y=\frac{x^2}{\sqrt{x+1}}`;
    expect(parsePayload(payload([{ ...block, latex }]))?.blocks[0]).toMatchObject({ preset, latex });
  });
  it.each(['', '   ', 'a'.repeat(1025), 'y=x\n+1', 'y=\u202ex', 12, { html: '<img>' }])('rejects malformed or oversized display field %j', (latex) => {
    expect(parsePayload(payload([{ ...expressionPlot, latex }]))).toBeNull();
  });
  it('typesets fractions, roots and powers using real MathML', () => {
    const { container } = renderFormula(String.raw`y=\frac{x^2}{\sqrt{x+1}}`);
    const math = container.querySelector('.plot-formula math')!;
    expect(math).not.toBeNull();
    expect(math.namespaceURI).toBe('http://www.w3.org/1998/Math/MathML');
    expect(math.querySelector('mfrac')).not.toBeNull();
    expect(math.querySelector('msqrt')).not.toBeNull();
    expect(math.querySelector('msup')).not.toBeNull();
  });
  it('keeps LaTeX symbolic while sliders redraw only the declared numerical expression', () => {
    const latex = String.raw`y=a\sin x`;
    const { container } = renderFormula(latex);
    const curve = () => container.querySelector('[data-plot-curve]')!.getAttribute('d');
    const before = curve();
    fireEvent.change(screen.getByRole('slider', { name: 'a' }), { target: { value: '2' } });
    expect(curve()).not.toBe(before);
    expect(container.querySelector('math annotation')?.textContent).toBe(latex);
    fireEvent.click(screen.getByRole('button', { name: '复位参数' }));
    expect(curve()).toBe(before);
  });
  it('never uses display LaTeX as the numerical function', () => {
    const { container } = renderFormula('y=x^2', { expression: 'x', parameters: [] });
    const path = container.querySelector('[data-plot-curve]') as SVGPathElement & { __data__: ([Bounds, Bounds] | null)[] };
    const point = path.__data__.find((entry) => entry && entry[0].lo <= 2 && entry[0].hi >= 2)!;
    expect(point[1].lo).toBeLessThanOrEqual(2);
    expect(point[1].hi).toBeGreaterThanOrEqual(2);
    expect(point[1].hi).toBeLessThan(3);
  });
  it.each([
    String.raw`\frac{1`, String.raw`\unknown{x}`, String.raw`\def\loop{\loop}\loop`,
    String.raw`\href{javascript:alert(1)}{x}`, String.raw`\includegraphics{https://example.invalid/image.png}`,
    String.raw`\htmlStyle{position:fixed}{x}`, String.raw`\textcolor{red}{x}`,
    String.raw`\def1{x}1`, String.raw`\let1=x 1`, String.raw`\href1x`, String.raw`\red{x}`, String.raw`\grayA{x}`,
  ])('falls back to the working plain definition for unsupported or unsafe TeX %s', (latex) => {
    const { container } = renderFormula(latex);
    expect(container.querySelector('.plot-formula')?.textContent).toBe('y = a*sin(x)');
    expect(container.querySelector('math, a, img, script, iframe')).toBeNull();
    expect(container.querySelector('[data-plot-curve]')?.getAttribute('d')?.trim()).toMatch(/^M /);
  });
  it('keeps HTML-shaped TeX text inert', () => {
    const { container } = renderFormula(String.raw`\text{<img src=x onerror=alert(1)>}`);
    expect(container.querySelector('img, script, a, iframe')).toBeNull();
    expect(container.querySelector('[data-plot-curve]')).not.toBeNull();
  });
});
