import { act, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { startEngine } from '../src/content/engine';
import { message, metrics, payload, quadratic, table, timeline } from './fixtures';

describe('live rendering engine', () => {
  it('preserves plot interaction state when a completed stream only appends whitespace', async () => {
    const { code } = message(payload([quadratic]));
    let engine!: ReturnType<typeof startEngine>;
    await act(async () => { engine = startEngine(document, 'auto'); });
    try {
      const host = document.querySelector('[data-dsui-host]')!;
      const a = host.shadowRoot!.querySelector('input')!;
      await act(async () => { fireEvent.change(a, { target: { value: '-1' } }); });
      expect(host.shadowRoot!.querySelector('.plot-formula')!.textContent).toBe('y = −x²');
      await act(async () => { code.textContent += '\n '; });
      await waitFor(() => expect(host.shadowRoot!.querySelector('.source-disclosure pre')!.textContent).toBe(payload([quadratic]) + '\n '));
      expect(host.shadowRoot!.querySelector('input')).toBe(a);
      expect(host.shadowRoot!.querySelector('.plot-formula')!.textContent).toBe('y = −x²');
    } finally { await act(async () => engine.dispose()); }
  });
  it('restores the raw plot block after a component fails instead of remounting forever', async () => {
    const { pre } = message(payload([quadratic]));
    const observer = globalThis.ResizeObserver;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.ResizeObserver = class extends observer { constructor() { super(() => {}); throw new Error('injected observer failure'); } };
    let engine!: ReturnType<typeof startEngine>;
    try {
      await act(async () => { engine = startEngine(document, 'auto'); });
      await waitFor(() => expect(pre.hidden).toBe(false));
      await waitFor(() => expect(document.querySelector('[data-dsui-host]')).toBeNull());
      await act(async () => { document.body.className = 'dark'; });
      await new Promise((resolve) => setTimeout(resolve, 90));
      expect(document.querySelector('[data-dsui-host]')).toBeNull();
      expect(pre.textContent).toBe(payload([quadratic]));
    } finally { await act(async () => engine?.dispose()); globalThis.ResizeObserver = observer; errors.mockRestore(); }
  });
  it('waits for complete streaming JSON, renders once and preserves original source', async () => {
    const { code, pre } = message('{"protocol":');
    const engine = startEngine(document, 'auto');
    expect(document.querySelector('[data-dsui-host]')).toBeNull();
    await act(async () => { code.textContent = payload([metrics]); });
    await waitFor(() => expect(pre.hidden).toBe(true));
    const host = document.querySelector('[data-dsui-host]')!;
    expect(host.shadowRoot?.textContent).toContain('活跃用户');
    expect(code.textContent).toBe(payload([metrics]));
    code.append(document.createTextNode(' '));
    await waitFor(() => expect(document.querySelectorAll('[data-dsui-host]')).toHaveLength(1));
    await act(async () => { engine.dispose(); });
    expect(pre.hidden).toBe(false);
  });
  it('restores source when valid streaming content becomes invalid or mode is Off', async () => {
    const { code, pre } = message(payload([metrics]));
    let engine!: ReturnType<typeof startEngine>;
    await act(async () => { engine = startEngine(document, 'auto'); });
    await waitFor(() => expect(pre.hidden).toBe(true));
    await act(async () => { code.textContent += 'garbage'; });
    await waitFor(() => expect(pre.hidden).toBe(false));
    await act(async () => { code.textContent = payload([metrics]); });
    await waitFor(() => expect(pre.hidden).toBe(true));
    await act(async () => { engine.setMode('off'); });
    expect(pre.hidden).toBe(false);
    expect(document.querySelector('[data-dsui-host]')).toBeNull();
    await act(async () => { engine.setMode('force'); });
    await waitFor(() => expect(pre.hidden).toBe(true));
    await act(async () => { engine.dispose(); });
  });
  it('enforces a reply-wide limit across multiple code fences and duplicate ids', async () => {
    const first = message(payload([metrics, table]));
    const extra = message(payload([timeline, { ...metrics, id: 'extra' }]));
    first.article.append(extra.pre);
    const repeated = message(payload([metrics]));
    first.article.append(repeated.pre);
    let engine!: ReturnType<typeof startEngine>;
    await act(async () => { engine = startEngine(document, 'auto'); });
    await waitFor(() => expect(first.pre.hidden).toBe(true));
    expect(extra.pre.hidden).toBe(false);
    expect(repeated.pre.hidden).toBe(false);
    expect(document.querySelectorAll('[data-dsui-host]')).toHaveLength(1);
    await act(async () => { engine.dispose(); });
  });
  it('updates reused nodes and removes roots when a conversation is removed', async () => {
    const first = message(payload([metrics]));
    let engine!: ReturnType<typeof startEngine>;
    await act(async () => { engine = startEngine(document, 'auto'); });
    await waitFor(() => expect(first.pre.hidden).toBe(true));
    await act(async () => { first.code.textContent = payload([{ ...metrics, title: '新会话' }]); });
    await waitFor(() => expect(document.querySelector('[data-dsui-host]')?.shadowRoot?.textContent).toContain('新会话'));
    await act(async () => { first.article.remove(); });
    await waitFor(() => expect(document.querySelector('[data-dsui-host]')).toBeNull());
    const second = message(payload([metrics]));
    await waitFor(() => expect(second.pre.hidden).toBe(true));
    await act(async () => { engine.dispose(); });
  });
});
