import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { FunctionPlotBlock } from '../protocol';
import { curveDescription, curvePath, formula, gridTicks, panViewport, plotNumber, sliderValue, zoomViewport, type Coefficients, type Viewport } from './function-plot';

const HEIGHT = 290;
const LEFT = 48; const TOP = 12; const RIGHT = 16; const BOTTOM = 30;
type Point = { x: number; y: number };

export function FunctionPlot({ block }: { block: FunctionPlotBlock }) {
  const defaults = () => Object.fromEntries(block.parameters.map((p) => [p.key, p.value])) as Coefficients;
  const [parameters, setParameters] = useState(defaults);
  const [view, setView] = useState(block.viewport);
  const [width, setWidth] = useState(640);
  const svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const viewRef = useRef(view);
  const clip = useId(); const help = useId(); const description = useId();
  const innerWidth = Math.max(96, width - LEFT - RIGHT);
  const innerHeight = HEIGHT - TOP - BOTTOM;
  const updateView = (next: Viewport) => { viewRef.current = next; setView(next); };
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const resize = () => {
      const measured = element.getBoundingClientRect().width;
      if (Number.isFinite(measured) && measured > 0) setWidth(Math.min(2000, Math.max(180, measured)));
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const rx = (event.clientX - bounds.left) / bounds.width * width;
      const ry = (event.clientY - bounds.top) / bounds.height * HEIGHT;
      updateView(zoomViewport(viewRef.current, Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.002))),
        (rx - LEFT) / innerWidth, 1 - (ry - TOP) / innerHeight));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [width, innerWidth]);
  const x = (n: number) => LEFT + (n - view.xMin) / (view.xMax - view.xMin) * innerWidth;
  const y = (n: number) => TOP + (view.yMax - n) / (view.yMax - view.yMin) * innerHeight;
  const move = (dx: number, dy: number) => updateView(panViewport(viewRef.current,
    dx * (viewRef.current.xMax - viewRef.current.xMin), dy * (viewRef.current.yMax - viewRef.current.yMin)));
  const zoom = (factor: number) => updateView(zoomViewport(viewRef.current, factor));
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (pointers.current.size >= 2) return;
    event.preventDefault(); event.currentTarget.focus();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const before = [...pointers.current.values()];
    if (!pointers.current.has(event.pointerId)) return;
    event.preventDefault();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...pointers.current.values()];
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const center = (points: Point[]) => ({ x: points.reduce((n, p) => n + p.x, 0) / points.length, y: points.reduce((n, p) => n + p.y, 0) / points.length });
    const oldCenter = center(before); const newCenter = center(after);
    let next = viewRef.current;
    if (before.length === 2) {
      const distance = (points: Point[]) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (distance(before) > 1 && distance(after) > 1) next = zoomViewport(next, distance(before) / distance(after),
        ((oldCenter.x - bounds.left) / bounds.width * width - LEFT) / innerWidth,
        1 - ((oldCenter.y - bounds.top) / bounds.height * HEIGHT - TOP) / innerHeight);
    }
    updateView(panViewport(next,
      -(newCenter.x - oldCenter.x) / bounds.width * width / innerWidth * (next.xMax - next.xMin),
      (newCenter.y - oldCenter.y) / bounds.height * HEIGHT / innerHeight * (next.yMax - next.yMin)));
  };
  const pointerEnd = (event: PointerEvent<SVGSVGElement>) => { pointers.current.delete(event.pointerId); };
  const keyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => move(-0.1, 0), ArrowRight: () => move(0.1, 0),
      ArrowUp: () => move(0, 0.1), ArrowDown: () => move(0, -0.1),
      '+': () => zoom(0.8), '=': () => zoom(0.8), '-': () => zoom(1.25),
      Home: () => updateView(block.viewport),
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  };
  const path = curvePath(parameters, view, innerWidth, innerHeight);
  // A shared offset keeps nearby large coordinates distinguishable in small gutters.
  const offsetFor = (min: number, max: number) => Math.max(Math.abs(min), Math.abs(max)) > (max - min) * 100 ? min : 0;
  const offsetX = offsetFor(view.xMin, view.xMax); const offsetY = offsetFor(view.yMin, view.yMax);
  const tickLabel = (n: number, offset: number) => {
    const relative = n - offset;
    return new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 4,
      notation: Math.abs(relative) >= 10000 || (relative !== 0 && Math.abs(relative) < 0.001) ? 'scientific' : 'standard' }).format(relative);
  };
  const offsetLabel = (axis: string, offset: number) => `${axis}坐标 = 刻度 ${offset < 0 ? '−' : '+'} ${plotNumber(Math.abs(offset))}`;
  return <div className="function-plot">
    <output className="plot-formula" aria-live="polite" aria-atomic="true">{formula(parameters)}</output>
    <p id={description} className="plot-description">{curveDescription(parameters)}</p>
    <p id={help} className="plot-help">拖动画布平移，滚轮或双指缩放；聚焦坐标系后用方向键平移、+/− 缩放、Home 复位。</p>
    <svg ref={svg} className="plot-canvas" viewBox={`0 0 ${width} ${HEIGHT}`} role="application" tabIndex={0}
      aria-label={`${block.title}，函数坐标系`} aria-describedby={`${description} ${help}`}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} onKeyDown={keyDown}>
      <defs><clipPath id={clip}><rect x={LEFT} y={TOP} width={innerWidth} height={innerHeight} /></clipPath></defs>
      <g aria-hidden="true">
        <rect className="plot-background" x={LEFT} y={TOP} width={innerWidth} height={innerHeight} />
        {gridTicks(view.xMin, view.xMax).map((n) => <g key={`x${n}`}><line className="plot-grid" x1={x(n)} x2={x(n)} y1={TOP} y2={HEIGHT - BOTTOM} /><text x={x(n)} y={HEIGHT - 12} textAnchor="middle">{tickLabel(n, offsetX)}</text></g>)}
        {gridTicks(view.yMin, view.yMax).map((n) => <g key={`y${n}`}><line className="plot-grid" x1={LEFT} x2={width - RIGHT} y1={y(n)} y2={y(n)} /><text x={LEFT - 7} y={y(n) + 4} textAnchor="end">{tickLabel(n, offsetY)}</text></g>)}
        {view.xMin <= 0 && view.xMax >= 0 && <line className="plot-axis" x1={x(0)} x2={x(0)} y1={TOP} y2={HEIGHT - BOTTOM} />}
        {view.yMin <= 0 && view.yMax >= 0 && <line className="plot-axis" x1={LEFT} x2={width - RIGHT} y1={y(0)} y2={y(0)} />}
        <text x={width - 8} y={HEIGHT - 12}>x</text><text x={10} y={12}>y</text>
        <g clipPath={`url(#${clip})`}><path data-plot-curve="" className="plot-curve" transform={`translate(${LEFT},${TOP})`} d={path} /></g>
      </g>
    </svg>
    {!path && <p className="plot-help" role="status">当前视口内没有可见曲线，可缩小或复位视口。</p>}
    {offsetX !== 0 && <p className="plot-help">{offsetLabel('横轴', offsetX)}</p>}
    {offsetY !== 0 && <p className="plot-help">{offsetLabel('纵轴', offsetY)}</p>}
    <p className="plot-range">x ∈ [{plotNumber(view.xMin)}, {plotNumber(view.xMax)}] · y ∈ [{plotNumber(view.yMin)}, {plotNumber(view.yMax)}]</p>
    <div className="plot-toolbar" role="group" aria-label="坐标系操作">
      <button type="button" onClick={() => zoom(0.8)}>放大</button><button type="button" onClick={() => zoom(1.25)}>缩小</button>
      <button type="button" aria-label="向左平移" onClick={() => move(-0.1, 0)}>←</button><button type="button" aria-label="向右平移" onClick={() => move(0.1, 0)}>→</button>
      <button type="button" aria-label="向上平移" onClick={() => move(0, 0.1)}>↑</button><button type="button" aria-label="向下平移" onClick={() => move(0, -0.1)}>↓</button>
      <button type="button" onClick={() => updateView(block.viewport)}>复位视口</button>
    </div>
    <div className="plot-parameters" role="group" aria-label="函数参数">
      {block.parameters.map((p) => <label className="plot-parameter" key={p.key}>
        <span>{p.label}<output aria-hidden="true">{plotNumber(parameters[p.key])}</output></span>
        <input type="range" aria-label={p.label} aria-valuetext={`${p.key} = ${plotNumber(parameters[p.key])}`} min={p.min} max={p.max} step="any" value={parameters[p.key]}
          onChange={(e) => {
            const value = sliderValue(Number(e.currentTarget.value), p);
            setParameters((previous) => ({ ...previous, [p.key]: value }));
          }}
          onKeyDown={(e) => {
            const current = parameters[p.key];
            const values: Record<string, number> = { ArrowLeft: current - p.step, ArrowDown: current - p.step, ArrowRight: current + p.step, ArrowUp: current + p.step,
              PageDown: current - 10 * p.step, PageUp: current + 10 * p.step, Home: p.min, End: p.max };
            if (Object.hasOwn(values, e.key)) {
              e.preventDefault(); const value = Math.max(p.min, Math.min(p.max, Number(values[e.key].toPrecision(15))));
              setParameters((previous) => ({ ...previous, [p.key]: value }));
            }
          }} />
        <span className="plot-parameter-bounds"><span>{plotNumber(p.min)}</span><span>步长 {plotNumber(p.step)}</span><span>{plotNumber(p.max)}</span></span>
      </label>)}
    </div>
    <button className="plot-reset" type="button" onClick={() => setParameters(defaults())}>复位参数</button>
  </div>;
}
