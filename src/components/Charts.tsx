import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { LeafBlock } from '../protocol';
import { display } from './display';

type ChartBlock = Extract<LeafBlock, { type: 'line_chart' | 'pie_chart' | 'scatter_chart' }>;
const tick = { fill: 'var(--dsui-muted)', fontSize: 11 };
const tooltipStyle = { background: 'var(--dsui-surface)', border: '1px solid var(--dsui-line)', borderRadius: 10, color: 'var(--dsui-text)' };
const color = (index: number) => `var(--dsui-chart-${index % 6 + 1})`;
const unitLabel = (label: string, unit?: string) => unit ? `${label}（${unit}）` : label;
const shortTick = (value: string) => value.length > 12 ? `${value.slice(0, 11)}…` : value;

function Legend({ labels }: { labels: string[] }) {
  return <ul className="chart-legend" aria-label="图例">{labels.map((label, index) => <li key={index}>
    <span aria-hidden="true" style={{ backgroundColor: color(index) }} />{label}
  </li>)}</ul>;
}

function ChartData({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number | null)[][] }) {
  return <details className="chart-data"><summary>查看数据</summary><div className="table-scroll" tabIndex={0} aria-label={`${title}原始数据，可横向滚动`}>
    <table><caption className="sr-only">{title}原始数据</caption>
      <thead><tr>{headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>{display(value)}</td>)}</tr>)}</tbody>
    </table>
  </div></details>;
}

export function DataChart({ block }: { block: ChartBlock }) {
  let headers: string[];
  let rows: (string | number | null)[][];
  let empty: boolean;
  if (block.type === 'line_chart') {
    headers = ['项目', ...block.series.map((series) => unitLabel(series.label, block.unit))];
    rows = block.items.map((item) => [item.label, ...block.series.map((series) => item.values[series.key])]);
    empty = !block.items.some((item) => block.series.some((series) => item.values[series.key] !== null));
  } else if (block.type === 'pie_chart') {
    headers = ['项目', unitLabel('数值', block.unit)];
    rows = block.items.map((item) => [item.label, item.value]);
    empty = !block.items.some((item) => item.value > 0);
  } else {
    headers = ['样本', unitLabel(block.xLabel ?? 'X', block.xUnit), unitLabel(block.yLabel ?? 'Y', block.yUnit)];
    rows = block.items.map((item, index) => [item.label ?? `数据点 ${index + 1}`, item.x, item.y]);
    empty = block.items.length === 0;
  }
  return <>
    {empty ? <p className="empty-state chart-empty" role="status">{block.type === 'pie_chart' ? '暂无正数数据' : '暂无可绘制数据'}</p>
      : <div className="chart" role="img" aria-label={`${block.title}，${block.items.length}项数据。下方可查看数据。`}>
        <ResponsiveContainer width="100%" height={248} minWidth={0} initialDimension={{ width: 640, height: 248 }}>
          {block.type === 'line_chart' ? <LineChart data={block.items} margin={{ top: 14, right: 16, left: 0, bottom: 12 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--dsui-line)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={tick} tickFormatter={shortTick} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis width={64} tick={tick} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
            <Tooltip cursor={false} contentStyle={tooltipStyle} />
            {block.series.map((series, index) => <Line key={series.key} name={series.label}
              dataKey={(item: (typeof block.items)[number]) => item.values[series.key]} type="linear"
              stroke={color(index)} strokeWidth={2} strokeDasharray={index ? `${index + 3} 3` : undefined}
              dot={{ r: 3, strokeDasharray: 'none' }} activeDot={{ r: 5, strokeDasharray: 'none' }} connectNulls={false} isAnimationActive={false} />)}
          </LineChart> : block.type === 'pie_chart' ? <PieChart accessibilityLayer>
            <Tooltip contentStyle={tooltipStyle} />
            <Pie data={block.items} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={96}
              innerRadius={block.variant === 'donut' ? 54 : 0} stroke="var(--dsui-surface)" isAnimationActive={false}>
              {block.items.map((_, index) => <Cell key={index} fill={color(index)} />)}
            </Pie>
          </PieChart> : <ScatterChart margin={{ top: 14, right: 16, left: 0, bottom: 12 }} accessibilityLayer>
            <CartesianGrid stroke="var(--dsui-line)" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name={block.xLabel ?? 'X'} unit={block.xUnit} tick={tick} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
            <YAxis type="number" dataKey="y" name={block.yLabel ?? 'Y'} unit={block.yUnit} width={64} tick={tick} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
            <Tooltip cursor={false} contentStyle={tooltipStyle} />
            <Scatter data={block.items} name={block.title} fill={color(0)} isAnimationActive={false} />
          </ScatterChart>}
        </ResponsiveContainer>
      </div>}
    {block.type === 'line_chart' && <Legend labels={block.series.map((series) => series.label)} />}
    {block.type === 'pie_chart' && <Legend labels={block.items.map((item) => item.label)} />}
    <ChartData title={block.title} headers={headers} rows={rows} />
  </>;
}
