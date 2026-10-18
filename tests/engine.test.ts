import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { startEngine } from '../src/content/engine';
import { message, metrics, payload, table, timeline } from './fixtures';

describe('live rendering engine', () => {
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
