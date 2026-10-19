import { describe, expect, it } from 'vitest';
import { curveDescription, evaluateQuadratic, formula, panViewport, sliderValue, sliderKeyValue, zoomViewport } from '../src/components/function-plot';
import { quadratic } from './fixtures';

describe('bounded plot mathematics', () => {
  it.each([
    [{ a: 1, b: 0, c: 0 }, -2, 4], [{ a: -1, b: 0, c: 0 }, 2, -4],
    [{ a: 1, b: 2, c: 3 }, -2, 3], [{ a: 1, b: 2, c: 3 }, 2, 11],
    [{ a: 0, b: 2, c: 3 }, 2, 7], [{ a: 0, b: 0, c: -3 }, 100, -3],
  ] as const)('evaluates %o at %s to %s', (p, x, expected) => {
    expect(evaluateQuadratic(p, x)).toBe(expected);
  });
  it('keeps zero, signs, tiny coefficients and degenerate descriptions truthful', () => {
    expect(formula({ a: 0, b: 0, c: 0 })).toBe('y = 0');
    expect(formula({ a: -1, b: -2, c: -3 })).toBe('y = −x² − 2x − 3');
    expect(formula({ a: 1e-20, b: 0, c: 0 })).toBe('y = 1e-20x²');
    expect(curveDescription({ a: 1e-320, b: 1, c: 0 })).not.toMatch(/NaN|Infinity/);
  });
  it('anchors zoom, pans in data units and bounds repeated extreme gestures', () => {
    expect(zoomViewport(quadratic.viewport, 0.5, 0, 0)).toEqual({ xMin: -8, xMax: 0, yMin: -8, yMax: 0 });
    expect(panViewport(quadratic.viewport, 2, -1)).toEqual({ xMin: -6, xMax: 10, yMin: -9, yMax: 7 });
    let v = quadratic.viewport;
    for (let i = 0; i < 100; i++) v = panViewport(zoomViewport(v, 0.25), 1e20, -1e20);
    expect(Object.values(v).every(Number.isFinite)).toBe(true);
    expect(v.xMin).toBeLessThan(v.xMax); expect(v.yMin).toBeLessThan(v.yMax);
    expect(v.xMax).toBeLessThanOrEqual(1e6); expect(v.yMin).toBeGreaterThanOrEqual(-1e6);
    expect(zoomViewport(v, Infinity)).toBe(v);
    expect(panViewport(v, NaN, 0)).toBe(v);
  });
  it('snaps using the lower bound without discarding range endpoints', () => {
    const p = { ...quadratic.parameters[0], key: 'a' as const, min: -0.3, max: 0.35, step: 0.1 };
    expect(sliderValue(0.16, p)).toBe(0.2);
    expect(sliderValue(0.35, p)).toBe(0.35);
    expect(sliderKeyValue(0.1, 'ArrowRight', p)).toBe(0.2);
    expect(sliderKeyValue(0.2, 'ArrowRight', p)).toBe(0.3);
    // Negative control: this is the reported floating-point failure.
    expect(0.1 + 0.2).not.toBe(0.3);
  });
});
