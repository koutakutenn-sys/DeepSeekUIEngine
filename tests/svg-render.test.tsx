import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockView } from '../src/components/BlockView';
import { parsePayload } from '../src/protocol';
import { payload } from './fixtures';
import { createEnablePrompt } from '../src/prompt';

const diagram = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 140"><rect x="10" y="10" width="300" height="120" rx="12" fill="#4d6bfe"/><text x="160" y="80" text-anchor="middle" fill="#fff">模型绘图</text></svg>';

describe('model-provided static SVG', () => {
  it('renders the actual complete SVG example included in the model activation guide', () => {
    const source = createEnablePrompt('auto').match(/^svg完整JSON示例：(.+)$/m)?.[1];
    expect(source).toBeDefined();
    const parsed = parsePayload(source!);
    expect(parsed).not.toBeNull();
    const { container } = render(<BlockView block={parsed!.blocks[0]} />);
    expect(container.querySelectorAll('.svg-canvas rect')).toHaveLength(2);
    expect(container.querySelector('.svg-canvas marker')).not.toBeNull();
  });
  it('accepts a bounded SVG leaf block and renders real vector shapes and text', () => {
    const parsed = parsePayload(payload([{ id: 'diagram', type: 'svg', title: '流程图', svg: diagram }]));
    expect(parsed).not.toBeNull();
    const { container } = render(<BlockView block={parsed!.blocks[0]} />);
    const root = container.querySelector('.svg-canvas > svg')!;
    expect(root?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(root.querySelector('rect')?.getAttribute('fill')).toBe('#4d6bfe');
    expect(root.querySelector('text')?.textContent).toBe('模型绘图');
  });
  it('removes executable elements and event handlers while retaining the safe diagram', () => {
    const source = diagram.replace('<rect ', '<script>alert(1)</script><foreignObject><div>HTML</div></foreignObject><rect onload="alert(1)" ');
    const parsed = parsePayload(payload([{ id: 'clean', type: 'svg', title: '清洗图', svg: source }]));
    expect(parsed).not.toBeNull();
    const { container } = render(<BlockView block={parsed!.blocks[0]} />);
    expect(container.querySelector('.svg-canvas rect')).not.toBeNull();
    expect(container.querySelector('script, foreignObject, [onload]')).toBeNull();
  });
  it('allows SVG leaves in tabs while counting them in the existing reply budget', () => {
    const leaf = { id: 'nested-svg', type: 'svg', title: '图', svg: diagram };
    expect(parsePayload(payload([{ id: 'tabs-svg', type: 'tabs', title: '标签', items: [{ id: 'one', label: '图', blocks: [leaf] }] }]))).not.toBeNull();
  });
  it.each(['a'.repeat(20001), 12, { html: '<svg />' }])('rejects malformed or oversized SVG field %j', (svg) => {
    expect(parsePayload(payload([{ id: 'bad', type: 'svg', title: '图', svg }]))).toBeNull();
  });
});
