import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockView } from '../src/components/BlockView';
import { parsePayload } from '../src/protocol';
import { payload, table } from './fixtures';
import { accordion, comparison, infoCard, lineChart, pieChart, progress, scatterChart, tabs } from './p1-fixtures';

function block(source: unknown) {
  const parsed = parsePayload(payload([source]));
  if (!parsed) throw new Error('Invalid test fixture');
  return parsed.blocks[0];
}

describe('P1 real components', () => {
  it('exposes the original multi-series values and missing gap in its accessible data table', () => {
    render(<BlockView block={block(lineChart)} />);
    fireEvent.click(screen.getByText(/查看数据/));
    const rows = within(screen.getByRole('table', { name: '每周趋势原始数据' })).getAllByRole('row');
    expect(within(rows[2]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['周二', '15', '—']);
    expect(within(rows[0]).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['项目', '方案 A（次）', '方案 B（次）']);
  });
  it.each([lineChart, scatterChart])('shows an honest empty state for $type without inventing samples', (source) => {
    render(<BlockView block={block({ ...source, items: [] })} />);
    expect(screen.getByRole('status').textContent).toContain('暂无可绘制数据');
    fireEvent.click(screen.getByText(/查看数据/));
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
  it('keeps zero pie values visible in data, while not drawing a made-up pie', () => {
    render(<BlockView block={block({ ...pieChart, items: [{ label: '零值', value: 0 }] })} />);
    expect(screen.getByRole('status').textContent).toContain('暂无正数数据');
    fireEvent.click(screen.getByText(/查看数据/));
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['零值', '0']);
  });
  it('preserves signed scatter coordinates and axis units in its data table', () => {
    render(<BlockView block={block(scatterChart)} />);
    fireEvent.click(screen.getByText(/查看数据/));
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['样本 A', '-3', '4']);
    expect(screen.getByRole('columnheader', { name: '时间（秒）' })).toBeTruthy();
  });
  it.each([0, 72.5, 100])('shows the actual progress value %s without fake completion', (value) => {
    render(<BlockView block={block({ ...progress, value })} />);
    const element = screen.getByRole('progressbar', { name: '开发进度' }) as HTMLProgressElement;
    expect(element.value).toBe(value);
    expect(element.max).toBe(100);
    expect(screen.getAllByText(`${value}%`).some((node) => node !== element)).toBe(true);
  });
  it('renders model-provided card markup literally without creating active content', () => {
    const literal = '<img src=x onerror=alert(1)>';
    const { container } = render(<>
      <BlockView block={block({ ...infoCard, description: literal })} />
      <BlockView block={block({ ...comparison, items: [{ ...comparison.items[0], label: literal }, comparison.items[1]] })} />
    </>);
    expect(screen.getAllByText(literal)).toHaveLength(2);
    expect(container.querySelector('script,img,iframe,svg')).toBeNull();
    expect(screen.getByText('无需网络')).toBeTruthy();
  });
  it('switches tabs with arrows/Home/End and keeps selection, focus and the visible panel in agreement', () => {
    render(<BlockView block={block(tabs)} />);
    const trend = screen.getByRole('tab', { name: '趋势' });
    const summary = screen.getByRole('tab', { name: '摘要' });
    trend.focus();
    expect(trend.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: '趋势' })).toBeTruthy();
    fireEvent.keyDown(trend, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(summary);
    expect(summary.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: '摘要' })).toBeTruthy();
    expect(screen.queryByRole('tabpanel', { name: '趋势' })).toBeNull();
    fireEvent.keyDown(summary, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(trend);
    fireEvent.keyDown(trend, { key: 'End' });
    expect(document.activeElement).toBe(summary);
    fireEvent.keyDown(summary, { key: 'Home' });
    expect(document.activeElement).toBe(trend);
  });
  it('retains a visited child table sort when its tab is hidden and reopened', () => {
    const source = { ...tabs, items: [{ ...tabs.items[0], blocks: [{ ...table, id: 'nested-table' }] }, tabs.items[1]] };
    render(<BlockView block={block(source)} />);
    fireEvent.click(screen.getByRole('button', { name: /得分/ }));
    fireEvent.click(screen.getByRole('button', { name: /得分/ }));
    const firstName = () => within(screen.getByRole('table', { name: '对比详情' })).getAllByRole('row')[1].querySelector('td')?.textContent;
    expect(firstName()).toBe('A');
    fireEvent.click(screen.getByRole('tab', { name: '摘要' }));
    expect(screen.queryByRole('table', { name: '对比详情' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '趋势' }));
    expect(firstName()).toBe('A');
  });
  it('assigns independent tab/panel IDs across separately rendered replies', () => {
    const parsed = block(tabs);
    render(<><BlockView block={parsed} /><BlockView block={parsed} /></>);
    const controls = screen.getAllByRole('tab');
    expect(new Set(controls.map((control) => control.id)).size).toBe(4);
    const targets = controls.map((control) => document.getElementById(control.getAttribute('aria-controls')!));
    expect(new Set(targets).size).toBe(4);
    for (let i = 0; i < controls.length; i++) expect(targets[i]?.getAttribute('aria-labelledby')).toBe(controls[i].id);
    fireEvent.click(controls[1]);
    expect(controls[1].getAttribute('aria-selected')).toBe('true');
    expect(controls[2].getAttribute('aria-selected')).toBe('true');
  });
  it('opens and closes accordion sections independently and moves focus between disclosure buttons', () => {
    render(<BlockView block={block(accordion)} />);
    const first = screen.getByRole('button', { name: '对比方案' });
    const second = screen.getByRole('button', { name: '坐标明细' });
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(second.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(second);
    expect(second.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('img', { name: /实验坐标/ })).toBeTruthy();
    fireEvent.click(first);
    expect(first.getAttribute('aria-expanded')).toBe('false');
    expect(second.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('heading', { name: '本地方案' })).toBeNull();
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: 'Home' });
    expect(document.activeElement).toBe(first);
  });
});
