import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import functionPlot, { Chart, type FunctionPlotOptions, type FunctionPlotDatum } from 'function-plot';
import type { FunctionPlotBlock } from '../protocol';
import { createPlotEvaluator, type Bounds } from '../math/plot-expression';
import { curveDescription, formula, panViewport, plotNumber, sliderValue, sliderKeyValue, zoomViewport, type Coefficients, type Viewport } from './function-plot';

const HEIGHT = 290;
const offsetFor = (min: number, max: number) => Math.max(Math.abs(min), Math.abs(max)) > (max - min) * 100 ? min : 0;
const tickLabel = (n: number, offset: number) => new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 4,
  notation: Math.abs(n - offset) >= 10000 || (n !== offset && Math.abs(n - offset) < 0.001) ? 'scientific' : 'standard' }).format(n - offset);
const offsetLabel = (axis: string, offset: number) => `${axis}坐标 = 刻度 ${offset < 0 ? '−' : '+'} ${plotNumber(Math.abs(offset))}`;

/** Rebase the upstream D3 gesture transform after accessible controls or resize. */
function rebase(chart: Chart) {
  const transform = chart.draggable.node()?.__zoom;
  if (transform) chart.draggable.node().__zoom = transform.translate(-transform.x / transform.k, -transform.y / transform.k).scale(1 / transform.k);
  chart.meta.zoomBehavior.xScale = chart.meta.xScale!.copy();
  chart.meta.zoomBehavior.yScale = chart.meta.yScale!.copy();
  const spans = [chart.meta.xScale!.domain(), chart.meta.yScale!.domain()].map(([min, max]) => max - min);
  chart.meta.zoomBehavior.scaleExtent([Math.max(...spans) / 1_000_000, Math.min(...spans) / 0.001]);
}

export function FunctionPlot({ block }: { block: FunctionPlotBlock }) {
  const defaults = () => Object.fromEntries(block.parameters.map((p) => [p.key, p.value]));
  const [parameters, setParameters] = useState(defaults);
  const [view, setView] = useState(block.viewport);
  const [width, setWidth] = useState(640);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const target = useRef<HTMLDivElement>(null);
  const chart = useRef<Chart | null>(null);
  const help = useId(); const description = useId();
  const expression = block.preset === 'quadratic' ? 'a*x^2+b*x+c' : block.expression;
  const evaluate = useMemo(() => createPlotEvaluator(expression, parameters), [expression, parameters]);
  const guard = (action: () => void) => { try { action(); } catch { setFailed(true); } };
  const updateView = (next: Viewport) => guard(() => {
    if (!chart.current) return;
    chart.current.meta.xScale!.domain([next.xMin, next.xMax]);
    chart.current.meta.yScale!.domain([next.yMin, next.yMax]);
    rebase(chart.current); chart.current.draw();
  });
  useEffect(() => {
    const element = target.current!;
    const resize = () => {
      const measured = element.getBoundingClientRect().width;
      if (Number.isFinite(measured) && measured > 0) setWidth(Math.min(2000, Math.max(180, measured)));
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    guard(() => {
      const data: FunctionPlotDatum[] = [{ fn: ({ x }) => evaluate({ x }), graphType: 'interval', sampler: 'interval',
        fnType: 'linear', nSamples: Math.min(1024, Math.max(256, Math.ceil(width * 2))),
        attr: { 'data-plot-curve': '' }, skipTip: true }];
      if (!chart.current) {
        const options: FunctionPlotOptions = { target: target.current!, width, height: HEIGHT, grid: true,
          xAxis: { domain: [block.viewport.xMin, block.viewport.xMax], label: 'x' },
          yAxis: { domain: [block.viewport.yMin, block.viewport.yMax], label: 'y' }, data };
        // Register bounds/formatting before the first draw, including initial axes.
        const instance = new Chart(options);
        chart.current = instance;
        instance.on('eval', (groups: ([Bounds, Bounds] | null)[][]) => {
          const [min, max] = instance.meta.yScale!.domain();
          setVisible(groups.some((samples) => samples.some((sample) => sample && sample[1].lo <= max && sample[1].hi >= min)));
        });
        instance.on('before:draw', () => {
          const [xMin, xMax] = instance.meta.xScale!.domain(); const [yMin, yMax] = instance.meta.yScale!.domain();
          const raw = { xMin, xMax, yMin, yMax };
          const bounded = Object.values(raw).every(Number.isFinite) ? panViewport(raw, 0, 0) : block.viewport;
          instance.meta.xScale!.domain([bounded.xMin, bounded.xMax]); instance.meta.yScale!.domain([bounded.yMin, bounded.yMax]);
          instance.meta.xAxis!.tickFormat((n: number) => tickLabel(Number(n), offsetFor(bounded.xMin, bounded.xMax)));
          instance.meta.yAxis!.tickFormat((n: number) => tickLabel(Number(n), offsetFor(bounded.yMin, bounded.yMax)));
        });
        instance.on('after:draw', () => {
          const [xMin, xMax] = instance.meta.xScale!.domain(); const [yMin, yMax] = instance.meta.yScale!.domain();
          setView((previous) => previous.xMin === xMin && previous.xMax === xMax && previous.yMin === yMin && previous.yMax === yMax
            ? previous : { xMin, xMax, yMin, yMax });
        });
        functionPlot(options);
        rebase(instance);
      } else {
        const instance = chart.current;
        instance.options.data = data;
        if (instance.options.width !== width) { instance.options.width = width; instance.build(); rebase(instance); }
        else instance.draw();
      }
    });
  }, [block, evaluate, width]);
  useEffect(() => () => {
    const instance = chart.current;
    if (!instance) return;
    instance.draggable?.on('.zoom', null).on('mouseover', null).on('mouseout', null).on('mousemove', null);
    instance.removeAllListeners();
    if (instance.options.id) delete Chart.cache[instance.options.id];
    chart.current = null;
    target.current?.replaceChildren();
  }, []);
  if (failed) throw new Error('Function plot rendering failed');
  const move = (dx: number, dy: number) => updateView(panViewport(view, dx * (view.xMax - view.xMin), dy * (view.yMax - view.yMin)));
  const zoom = (factor: number) => updateView(zoomViewport(view, factor));
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => move(-0.1, 0), ArrowRight: () => move(0.1, 0), ArrowUp: () => move(0, 0.1), ArrowDown: () => move(0, -0.1),
      '+': () => zoom(0.8), '=': () => zoom(0.8), '-': () => zoom(1.25), Home: () => updateView(block.viewport),
    };
    if (Object.hasOwn(actions, event.key)) { event.preventDefault(); actions[event.key](); }
  };
  const offsetX = offsetFor(view.xMin, view.xMax); const offsetY = offsetFor(view.yMin, view.yMax);
  return <div className="function-plot">
    <output className="plot-formula" aria-live="polite" aria-atomic="true">{block.preset === 'quadratic' ? formula(parameters as Coefficients) : `y = ${block.expression}`}</output>
    <p id={description} className="plot-description">{block.preset === 'quadratic' ? curveDescription(parameters as Coefficients) : '初等函数图像（实数域，角度单位为弧度）。'}</p>
    <p id={help} className="plot-help">拖动画布平移，滚轮或双指缩放；聚焦坐标系后用方向键平移、+/− 缩放、Home 复位。</p>
    <div ref={target} className="plot-canvas" role="application" tabIndex={0}
      aria-label={`${block.title}，函数坐标系`} aria-describedby={`${description} ${help}`} onKeyDown={keyDown} />
    {!visible && <p className="plot-help" role="status">当前视口内没有可见曲线，可缩小或复位视口，或检查实数定义域与数值范围。</p>}
    {offsetX !== 0 && <p className="plot-help">{offsetLabel('横轴', offsetX)}</p>}
    {offsetY !== 0 && <p className="plot-help">{offsetLabel('纵轴', offsetY)}</p>}
    <p className="plot-range">x ∈ [{plotNumber(view.xMin)}, {plotNumber(view.xMax)}] · y ∈ [{plotNumber(view.yMin)}, {plotNumber(view.yMax)}]</p>
    <div className="plot-toolbar" role="group" aria-label="坐标系操作">
      <button type="button" onClick={() => zoom(0.8)}>放大</button><button type="button" onClick={() => zoom(1.25)}>缩小</button>
      <button type="button" aria-label="向左平移" onClick={() => move(-0.1, 0)}>←</button><button type="button" aria-label="向右平移" onClick={() => move(0.1, 0)}>→</button>
      <button type="button" aria-label="向上平移" onClick={() => move(0, 0.1)}>↑</button><button type="button" aria-label="向下平移" onClick={() => move(0, -0.1)}>↓</button>
      <button type="button" onClick={() => updateView(block.viewport)}>复位视口</button>
    </div>
    {block.parameters.length > 0 && <div className="plot-parameters" role="group" aria-label="函数参数">
      {block.parameters.map((p) => <label className="plot-parameter" key={p.key}>
        <span>{p.label}<output aria-hidden="true">{plotNumber(parameters[p.key])}</output></span>
        <input type="range" aria-label={p.label} aria-valuetext={`${p.key} = ${plotNumber(parameters[p.key])}`} min={p.min} max={p.max} step="any" value={parameters[p.key]}
          onChange={(e) => {
            const value = sliderValue(Number(e.currentTarget.value), p);
            setParameters((previous) => ({ ...previous, [p.key]: value }));
          }}
          onKeyDown={(e) => {
            const value = sliderKeyValue(parameters[p.key], e.key, p);
            if (value !== undefined) {
              e.preventDefault();
              setParameters((previous) => ({ ...previous, [p.key]: value }));
            }
          }} />
        <span className="plot-parameter-bounds"><span>{plotNumber(p.min)}</span><span>步长 {plotNumber(p.step)}</span><span>{plotNumber(p.max)}</span></span>
      </label>)}
    </div>}
    {block.parameters.length > 0 && <button className="plot-reset" type="button" onClick={() => setParameters(defaults())}>复位参数</button>}
  </div>;
}
