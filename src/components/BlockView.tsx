import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Block } from '../protocol';
import { FunctionPlot } from './FunctionPlot';

const formatNumber = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 15 });
function display(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return formatNumber.format(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value;
}

function DataTable({ block }: { block: Extract<Block, { type: 'data_table' }> }) {
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(null);
  const rows = block.rows.map((row, index) => ({ row, index }));
  if (sort) rows.sort((a, b) => {
    const left = a.row[sort.key];
    const right = b.row[sort.key];
    if (left == null && right == null) return a.index - b.index;
    if (left == null) return 1;
    if (right == null) return -1;
    const comparison = typeof left === 'number' && typeof right === 'number'
      ? left - right : String(left).localeCompare(String(right), 'zh-CN', { numeric: true });
    return comparison * sort.direction || a.index - b.index;
  });
  return <div className="table-scroll" tabIndex={0} aria-label={`${block.title}，可横向滚动`}>
    <table>
      <caption className="sr-only">{block.title}</caption>
      <thead><tr>{block.columns.map((column) => <th key={column.key}
        aria-sort={sort?.key === column.key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className="sort-button" onClick={() => setSort({ key: column.key, direction: sort?.key === column.key && sort.direction === 1 ? -1 : 1 })}>
          {column.label}<span aria-hidden="true">{sort?.key === column.key ? (sort.direction === 1 ? '↑' : '↓') : '↕'}</span>
        </button>
      </th>)}</tr></thead>
      <tbody>{rows.map(({ row, index }) => <tr key={index}>{block.columns.map((column) => <td key={column.key}>{display(row[column.key])}</td>)}</tr>)}</tbody>
    </table>
    {rows.length === 0 && <p className="empty-state">暂无数据</p>}
  </div>;
}

function Chart({ block }: { block: Extract<Block, { type: 'bar_chart' }> }) {
  return <>
    <div className="chart" role="img" aria-label={`${block.title}，${block.items.length}项数据${block.unit ? `，单位：${block.unit}` : ''}。下方可查看数据。`}>
      <ResponsiveContainer width="100%" height={248} minWidth={0}>
        <BarChart data={block.items} margin={{ top: 12, right: 12, left: 0, bottom: 12 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--dsui-line)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: 'var(--dsui-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={(value: string) => value.length > 12 ? `${value.slice(0, 11)}…` : value} />
          <YAxis width={56} tick={{ fill: 'var(--dsui-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'var(--dsui-soft)' }} contentStyle={{ background: 'var(--dsui-surface)', border: '1px solid var(--dsui-line)', borderRadius: 10, color: 'var(--dsui-text)' }}
            formatter={(value) => [`${display(Number(value))}${block.unit ? ` ${block.unit}` : ''}`, '数值']} />
          <Bar dataKey="value" fill="var(--dsui-accent)" radius={[5, 5, 0, 0]} maxBarSize={52} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <details className="chart-data"><summary>查看数据{block.unit ? ` · ${block.unit}` : ''}</summary>
      <table><caption className="sr-only">{block.title}原始数据</caption><thead><tr><th>项目</th><th>数值</th></tr></thead>
        <tbody>{block.items.map((item, index) => <tr key={index}><td>{item.label}</td><td>{display(item.value)}{block.unit ? ` ${block.unit}` : ''}</td></tr>)}</tbody>
      </table>
    </details>
  </>;
}

export function BlockView({ block }: { block: Block }) {
  return <section className="block" aria-label={block.title}>
    <h3 className="block-title">{block.title}</h3>
    {block.type === 'function_plot' && <FunctionPlot block={block} />}
    {block.type === 'metric_grid' && <div className="metric-grid">{block.items.map((item, index) => <div key={index} className="metric">
      <div className="metric-label">{item.label}</div>
      <div className="metric-value">{display(item.value)}{item.unit && <span className="metric-unit">{item.unit}</span>}</div>
      {item.change && <div className="metric-change">{item.change}</div>}
    </div>)}</div>}
    {block.type === 'bar_chart' && <Chart block={block} />}
    {block.type === 'data_table' && <DataTable block={block} />}
    {block.type === 'timeline' && <ol className="timeline">{block.items.map((item, index) => <li key={index} data-status={item.status ?? 'pending'}>
      <div className="timeline-dot" aria-hidden="true" />
      <details><summary><span className="timeline-date">{item.date}</span><span className="timeline-title">{item.title}</span>
        <span className="timeline-status">{{ done: '已完成', active: '进行中', pending: '待开始' }[item.status ?? 'pending']}</span>
      </summary><p>{item.description || '暂无详细说明'}</p></details>
    </li>)}</ol>}
  </section>;
}
