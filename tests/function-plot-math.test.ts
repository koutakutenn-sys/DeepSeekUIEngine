import { describe, expect, it } from 'vitest';
import { curveDescription, curvePath, evaluateQuadratic, formula, gridTicks, panViewport, sliderValue, zoomViewport } from '../src/components/function-plot';
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
  it('clips a horizontal line and omits a curve wholly outside the viewport', () => {
    const v = { xMin: -4, xMax: 4, yMin: -4, yMax: 4 };
    const path = curvePath({ a: 0, b: 0, c: 0 }, v, 400, 200);
    expect(path.startsWith('M0.00,100.00L')).toBe(true);
    expect(path.endsWith('400.00,100.00')).toBe(true);
    expect(curvePath({ a: 0, b: 0, c: 5 }, v, 400, 200)).toBe('');
    expect(curvePath({ a: 1, b: 0, c: 0 }, v, 400, 200)).toContain('200.00,100.00');
  });
  it('keeps extreme curves finite, clipped and bounded in work', () => {
    for (const a of [-10000, 0, 10000]) {
      const path = curvePath({ a, b: 10000, c: -10000 }, { xMin: -1e6, xMax: 0, yMin: -1e6, yMax: 0 }, 1000000, 260);
      expect(path).not.toMatch(/NaN|Infinity/);
      expect((path.match(/M/g) ?? []).length).toBeLessThanOrEqual(1024);
      for (const pair of path.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)) {
        expect(Number(pair[1])).toBeGreaterThanOrEqual(0); expect(Number(pair[1])).toBeLessThanOrEqual(1000000);
        expect(Number(pair[2])).toBeGreaterThanOrEqual(0); expect(Number(pair[2])).toBeLessThanOrEqual(260);
      }
    }
  });
  it('anchors zoom, pans in data units and bounds repeated extreme gestures', () => {
    expect(zoomViewport(quadratic.viewport, 0.5, 0, 0)).toEqual({ xMin: -8, xMax: 0, yMin: -8, yMax: 0 });
    expect(panViewport(quadratic.viewport, 2, -1)).toEqual({ xMin: -6, xMax: 10, yMin: -9, yMax: 7 });
    let v = quadratic.viewport;
    for (let i = 0; i < 100; i++) v = panViewport(zoomViewport(v, 0.25), 1e20, -1e20);
    expect(Object.values(v).every(Number.isFinite)).toBe(true);
    expect(v.xMin).toBeLessThan(v.xMax); expect(v.yMin).toBeLessThan(v.yMax);
    expect(v.xMax).toBeLessThanOrEqual(1e6); expect(v.yMin).toBeGreaterThanOrEqual(-1e6);
    expect(gridTicks(v.xMin, v.xMax).length).toBeLessThanOrEqual(20);
    expect(zoomViewport(v, Infinity)).toBe(v);
    expect(panViewport(v, NaN, 0)).toBe(v);
  });
  it('snaps using the lower bound without discarding range endpoints', () => {
    const p = { ...quadratic.parameters[0], key: 'a' as const, min: -0.3, max: 0.35, step: 0.1 };
    expect(sliderValue(0.16, p)).toBe(0.2);
    expect(sliderValue(0.35, p)).toBe(0.35);
  });
});
