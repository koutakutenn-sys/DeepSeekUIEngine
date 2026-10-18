import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockView } from '../src/components/BlockView';
import { parsePayload } from '../src/protocol';
import { metrics, payload, table, timeline } from './fixtures';

describe('rich UI interactions', () => {
  it('sorts numeric table values and keeps nulls at the end in either direction', () => {
    render(<BlockView block={parsePayload(payload([table]))!.blocks[0]} />);
    const sort = screen.getByRole('button', { name: /得分/ });
    fireEvent.click(sort);
    let rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['B', 'A', 'C']);
    fireEvent.click(sort);
    rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['A', 'B', 'C']);
  });
  it('makes timeline details expandable', () => {
    render(<BlockView block={parsePayload(payload([timeline]))!.blocks[0]} />);
    const summary = screen.getByText('调研').closest('summary')!;
    expect(summary.parentElement?.hasAttribute('open')).toBe(false);
    fireEvent.click(summary);
    expect(summary.parentElement?.hasAttribute('open')).toBe(true);
    expect(screen.getByText('整理需求与使用场景')).toBeTruthy();
  });
  it('renders model markup as text without creating executable elements', () => {
    const label = '<img src=x onerror=alert(1)>';
    const { container } = render(<BlockView block={parsePayload(payload([{ ...metrics, items: [{ label, value: '<script>alert(1)</script>' }] }]))!.blocks[0]} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(container.querySelector('img,script')).toBeNull();
  });
  it('does not round a small nonzero metric down to zero', () => {
    render(<BlockView block={parsePayload(payload([{ ...metrics, items: [{ label: '微量值', value: 0.000000001 }] }]))!.blocks[0]} />);
    expect(screen.getByText('0.000000001')).toBeTruthy();
  });
});
