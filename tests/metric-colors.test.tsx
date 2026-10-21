import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockView } from '../src/components/BlockView';
import { parsePayload } from '../src/protocol';
import { metrics, payload } from './fixtures';

describe('per-item metric colors', () => {
  it.each(['#123', '#4d6bfe', '#A1B2C3'])('accepts literal hex color %s for a single item', (color) => {
    const parsed = parsePayload(payload([{ ...metrics, items: [{ label: '值', value: 42, color }] }]));
    expect(parsed?.blocks[0]).toMatchObject({ items: [{ color }] });
  });
  it.each(['red', 'rgb(1,2,3)', 'url(https://example.invalid)', '#123;position:fixed', '#12345678', 'var(--color)', '#zzzzzz', 12])('rejects arbitrary CSS or invalid color %j', (color) => {
    expect(parsePayload(payload([{ ...metrics, items: [{ label: '值', value: 42, color }] }]))).toBeNull();
  });
  it('scopes the value/accent color to its own card and keeps the next item unconfigured', () => {
    const parsed = parsePayload(payload([{ ...metrics, items: [{ label: '一', value: 42, color: '#208568' }, { label: '二', value: 7 }] }]));
    expect(parsed).not.toBeNull();
    const { container } = render(<BlockView block={parsed!.blocks[0]} />);
    const cards = container.querySelectorAll<HTMLElement>('.metric');
    expect(cards[0].style.getPropertyValue('--metric-color')).toBe('#208568');
    expect(cards[1].style.getPropertyValue('--metric-color')).toBe('');
    expect(cards[0].style.background).toBe('');
  });
});
