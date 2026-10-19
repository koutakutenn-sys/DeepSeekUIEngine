import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockView } from '../src/components/BlockView';
import { parsePayload } from '../src/protocol';
import { payload, quadratic } from './fixtures';
import { Chart } from 'function-plot';
import { elementaryFunctions } from './elementary-functions';
import type { Bounds } from '../src/math/plot-expression';

describe('function plot interactions', () => {
  it('redraws expression parameters and keeps decimal keyboard values exact', () => {
    const block = parsePayload(payload([{ ...quadratic, preset: 'expression', expression: 'a*sin(x)',
      parameters: [{ ...quadratic.parameters[0], value: 0.1 }] }]))!.blocks[0];
    const { container } = render(<BlockView block={block} />);
    const curve = () => container.querySelector('[data-plot-curve]')!.getAttribute('d');
    const before = curve();
    const slider = screen.getByRole('slider', { name: 'a' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' }); fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect((slider as HTMLInputElement).value).toBe('0.3');
    expect(curve()).not.toBe(before);
    fireEvent.click(screen.getByRole('button', { name: '复位参数' }));
    expect((slider as HTMLInputElement).value).toBe('0.1'); expect(curve()).toBe(before);
  });
  it('explains an empty real domain or a curve outside the viewport', () => {
    const block = parsePayload(payload([{ ...quadratic, preset: 'expression', expression: 'sqrt(-1)', parameters: [] }]))!.blocks[0];
    render(<BlockView block={block} />);
    expect(screen.getByText(/当前视口内没有可见曲线/)).toBeTruthy();
  });
  it.each(['exp(1000)', '-exp(1000)', 'sinh(1000)', '1e308*1e308', 'exp(x)'])('omits overflowed %s without full-height SVG strokes', (expression) => {
    const block = parsePayload(payload([{ ...quadratic, preset: 'expression', expression, parameters: [],
      viewport: { xMin: 999, xMax: 1000, yMin: -4, yMax: 4 } }]))!.blocks[0];
    const { container } = render(<BlockView block={block} />);
    expect(container.querySelector('[data-plot-curve]')!.getAttribute('d')).toBe('');
    expect(screen.getByText(/当前视口内没有可见曲线/)).toBeTruthy();
  });
  it.each(elementaryFunctions)('renders %s with the upstream interval sampler at %s', (expression, x, expected) => {
    const before = Object.keys(Chart.cache).length;
    const block = parsePayload(payload([{ ...quadratic, preset: 'expression', expression, parameters: [],
      viewport: { xMin: Math.min(-4, x - 2), xMax: Math.max(4, x + 2), yMin: Math.min(-4, expected - 2), yMax: Math.max(4, expected + 2) } }]))!.blocks[0];
    const { container, unmount } = render(<BlockView block={block} />);
    const curve = container.querySelector('[data-plot-curve]') as SVGPathElement & { __data__: ([Bounds, Bounds] | null)[] };
    expect(curve.getAttribute('d')).toMatch(/M .+ v /);
    expect(curve.getAttribute('d')).not.toMatch(/NaN|Infinity/);
    const sample = curve.__data__.find((sample) => sample && sample[0].lo <= x && sample[0].hi >= x)!;
    expect(sample[1].lo).toBeLessThanOrEqual(expected + 1e-10);
    expect(sample[1].hi).toBeGreaterThanOrEqual(expected - 1e-10);
    expect(Object.keys(Chart.cache).length).toBe(before + 1);
    unmount();
    expect(Object.keys(Chart.cache).length).toBe(before);
  });
  it('shows y=x², redraws downward/linear/constant curves and resets defaults', () => {
    const { container } = render(<BlockView block={parsePayload(payload([quadratic]))!.blocks[0]} />);
    const curve = () => container.querySelector('[data-plot-curve]')!.getAttribute('d');
    const original = curve();
    expect(screen.getByText('y = x²')).toBeTruthy();
    expect(screen.getByText(/开口向上/)).toBeTruthy();
    fireEvent.change(screen.getByRole('slider', { name: 'a' }), { target: { value: '-1' } });
    expect(screen.getByText('y = −x²')).toBeTruthy();
    expect(screen.getByText(/开口向下/)).toBeTruthy();
    expect(curve()).not.toBe(original);
    fireEvent.change(screen.getByRole('slider', { name: 'a' }), { target: { value: '0' } });
    fireEvent.change(screen.getByRole('slider', { name: 'b' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('slider', { name: 'c' }), { target: { value: '3' } });
    expect(screen.getByText('y = 2x + 3')).toBeTruthy();
    expect(screen.getByText(/递增直线/)).toBeTruthy();
    fireEvent.change(screen.getByRole('slider', { name: 'b' }), { target: { value: '0' } });
    expect(screen.getByText('y = 3')).toBeTruthy();
    expect(screen.getByText(/水平直线/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '复位参数' }));
    expect(screen.getByText('y = x²')).toBeTruthy();
    expect(curve()).toBe(original);
  });
  it('retains exact off-grid defaults and uses the declared keyboard step', () => {
    const block = { ...quadratic, parameters: quadratic.parameters.map((p) => p.key === 'a' ? { ...p, value: 0.15 } : p) };
    render(<BlockView block={parsePayload(payload([block]))!.blocks[0]} />);
    const a = screen.getByRole('slider', { name: 'a' });
    expect((a as HTMLInputElement).value).toBe('0.15');
    expect(screen.getByText('y = 0.15x²')).toBeTruthy();
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect((a as HTMLInputElement).value).toBe('0.25');
    fireEvent.keyDown(a, { key: 'End' });
    expect((a as HTMLInputElement).value).toBe('5');
    fireEvent.keyDown(a, { key: 'Home' });
    expect((a as HTMLInputElement).value).toBe('-5');
  });
  it('supports viewport buttons and keyboard pan with independent viewport reset', () => {
    const { container } = render(<BlockView block={parsePayload(payload([quadratic]))!.blocks[0]} />);
    const plot = screen.getByRole('application', { name: /函数坐标系/ });
    const original = container.querySelector('[data-plot-curve]')!.getAttribute('d');
    fireEvent.click(screen.getByRole('button', { name: '放大' }));
    expect(container.querySelector('[data-plot-curve]')!.getAttribute('d')).not.toBe(original);
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: '复位视口' }));
    expect(container.querySelector('[data-plot-curve]')!.getAttribute('d')).toBe(original);
  });
  it('keeps adjacent large-coordinate ticks distinguishable with an explicit offset', () => {
    const block = { ...quadratic, viewport: { xMin: 999999, xMax: 1000000, yMin: -1000000, yMax: -999999 } };
    const { container } = render(<BlockView block={parsePayload(payload([block]))!.blocks[0]} />);
    const texts = [...container.querySelectorAll('svg text')].map((n) => n.textContent);
    expect(texts.filter((n) => n === '1E6')).toHaveLength(0);
    expect(screen.getByText('横轴坐标 = 刻度 + 999999')).toBeTruthy();
    expect(screen.getByText('纵轴坐标 = 刻度 − 1000000')).toBeTruthy();
    expect(new Set(texts.filter((n) => n !== 'x' && n !== 'y')).size).toBeGreaterThan(4);
  });
});
