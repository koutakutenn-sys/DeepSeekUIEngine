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
  return clamp(Number((p.min + Math.round((value - p.min) / p.step) * p.step).toPrecision(15)), p.min, p.max);
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

export function gridTicks(min: number, max: number): number[] {
  const raw = (max - min) / 6;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((n) => n * power >= raw) ?? 10) * power;
  const first = Math.ceil(min / step);
  const ticks: number[] = [];
  // Integer-index iteration cannot stall at large coordinates or tiny scales.
  for (let i = 0; i < 20; i++) {
    const n = Number(((first + i) * step).toPrecision(15));
    if (n > max) break;
    if (n >= min) ticks.push(n);
  }
  return ticks;
}

/** Fixed bounded work; clip in data space before generating finite SVG coordinates. */
export function curvePath(p: Coefficients, v: Viewport, width: number, height: number): string {
  const count = clamp(Math.ceil(width), 256, 1023);
  const xs = Array.from({ length: count + 1 }, (_, i) => v.xMin + (v.xMax - v.xMin) * i / count);
  const vertex = -p.b / (2 * p.a);
  if (p.a !== 0 && Number.isFinite(vertex) && vertex > v.xMin && vertex < v.xMax) xs.push(vertex);
  xs.sort((a, b) => a - b);
  const pixel = (x: number, y: number) => `${((x - v.xMin) / (v.xMax - v.xMin) * width).toFixed(2)},${((v.yMax - y) / (v.yMax - v.yMin) * height).toFixed(2)}`;
  const segments: string[] = [];
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1]; const x1 = xs[i];
    const y0 = evaluateQuadratic(p, x0); const y1 = evaluateQuadratic(p, x1);
    if (![y0, y1].every(Number.isFinite) || Math.max(y0, y1) < v.yMin || Math.min(y0, y1) > v.yMax) continue;
    const dy = y1 - y0;
    const t0 = dy === 0 ? 0 : Math.max(0, Math.min((v.yMin - y0) / dy, (v.yMax - y0) / dy));
    const t1 = dy === 0 ? 1 : Math.min(1, Math.max((v.yMin - y0) / dy, (v.yMax - y0) / dy));
    if (t0 > t1) continue;
    segments.push(`M${pixel(x0 + (x1 - x0) * t0, clamp(y0 + dy * t0, v.yMin, v.yMax))}L${pixel(x0 + (x1 - x0) * t1, clamp(y0 + dy * t1, v.yMin, v.yMax))}`);
  }
  return segments.join('');
}
