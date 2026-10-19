import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockView } from '../src/components/BlockView';
import { parsePayload } from '../src/protocol';
import { payload, quadratic } from './fixtures';

describe('function plot interactions', () => {
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
