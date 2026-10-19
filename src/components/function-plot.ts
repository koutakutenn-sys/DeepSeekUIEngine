import Decimal from 'decimal.js';
import { PLOT_LIMITS, type FunctionPlotBlock } from '../protocol';

export type Viewport = FunctionPlotBlock['viewport'];
export type Coefficients = Record<'a' | 'b' | 'c', number>;
export type Parameter = FunctionPlotBlock['parameters'][number];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function evaluateQuadratic({ a, b, c }: Coefficients, x: number): number {
  return (a * x + b) * x + c;
}

export function plotNumber(n: number): string {
  return String(Number(n.toPrecision(15)));
}

export function formula({ a, b, c }: Coefficients): string {
  const terms: string[] = [];
  for (const [value, variable] of [[a, 'x²'], [b, 'x'], [c, '']] as const) {
    if (value === 0) continue;
    const magnitude = Math.abs(value);
    const term = `${variable && magnitude === 1 ? '' : plotNumber(magnitude)}${variable}`;
    terms.push(`${terms.length ? (value < 0 ? ' − ' : ' + ') : value < 0 ? '−' : ''}${term}`);
  }
  return `y = ${terms.join('') || '0'}`;
}

export function curveDescription(p: Coefficients): string {
  if (p.a === 0) return p.b === 0 ? `水平直线，所有 x 的函数值均为 ${plotNumber(p.c)}。`
    : `${p.b > 0 ? '递增' : '递减'}直线，斜率 ${plotNumber(p.b)}，纵轴截距 ${plotNumber(p.c)}。`;
  const x = -p.b / (2 * p.a);
  const y = evaluateQuadratic(p, x);
  return `抛物线开口向${p.a > 0 ? '上' : '下'}，纵轴截距 ${plotNumber(p.c)}。${Number.isFinite(x) && Number.isFinite(y)
    ? `顶点 (${plotNumber(x)}, ${plotNumber(y)})。` : '顶点超出可表示的数值范围。'}`;
}

/** Keep defaults exact; snap only a pointer gesture, without enumerating steps. */
export function sliderValue(value: number, p: Parameter): number {
  if (!Number.isFinite(value)) return p.value;
  if (value <= p.min) return p.min;
  if (value >= p.max) return p.max;
  return clamp(new Decimal(value).minus(p.min).div(p.step).toNearest(1).mul(p.step).plus(p.min).toNumber(), p.min, p.max);
}

function fitAxis(center: number, span: number): [number, number] {
  span = clamp(span, PLOT_LIMITS.minSpan, PLOT_LIMITS.maxSpan);
  center = clamp(center, -PLOT_LIMITS.coordinate + span / 2, PLOT_LIMITS.coordinate - span / 2);
  return [center - span / 2, center + span / 2];
}

export function panViewport(v: Viewport, dx: number, dy: number): Viewport {
  if (![dx, dy].every(Number.isFinite)) return v;
  const [xMin, xMax] = fitAxis((v.xMin + v.xMax) / 2 + dx, v.xMax - v.xMin);
  const [yMin, yMax] = fitAxis((v.yMin + v.yMax) / 2 + dy, v.yMax - v.yMin);
  return { xMin, xMax, yMin, yMax };
}

/** factor < 1 zooms in; anchor is a data-space fraction from the lower bounds. */
export function zoomViewport(v: Viewport, factor: number, rx = 0.5, ry = 0.5): Viewport {
  if (![factor, rx, ry].every(Number.isFinite) || factor <= 0) return v;
  factor = clamp(factor, 0.25, 4); rx = clamp(rx, 0, 1); ry = clamp(ry, 0, 1);
  const sx = v.xMax - v.xMin; const sy = v.yMax - v.yMin;
  const nx = clamp(sx * factor, PLOT_LIMITS.minSpan, PLOT_LIMITS.maxSpan);
  const ny = clamp(sy * factor, PLOT_LIMITS.minSpan, PLOT_LIMITS.maxSpan);
  const [xMin, xMax] = fitAxis(v.xMin + rx * sx + (0.5 - rx) * nx, nx);
  const [yMin, yMax] = fitAxis(v.yMin + ry * sy + (0.5 - ry) * ny, ny);
  return { xMin, xMax, yMin, yMax };
}


export function sliderKeyValue(current: number, key: string, p: Parameter): number | undefined {
  if (key === 'Home') return p.min;
  if (key === 'End') return p.max;
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
  if (!Object.hasOwn(steps, key)) return undefined;
  return clamp(new Decimal(current).plus(new Decimal(p.step).mul(steps[key])).toNumber(), p.min, p.max);
}
