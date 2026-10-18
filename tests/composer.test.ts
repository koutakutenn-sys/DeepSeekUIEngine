import { fireEvent, waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { sendActivationPrompt } from '../src/content/composer';
import { appendPrompt } from '../src/prompt';

function setup() {
  document.body.innerHTML = '<form><textarea id="chat-input"></textarea><button type="submit" aria-label="发送">发送</button></form>';
  const input = document.querySelector('textarea')!;
  const button = document.querySelector('button')!;
  const received: string[] = [];
  const send = () => { received.push(input.value); input.value = ''; };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(); }
  });
  document.querySelector('form')!.addEventListener('submit', (event) => { event.preventDefault(); send(); });
  return { input, button, received };
}

describe('explicit activation send', () => {
  it('sends a standalone prompt through the official handler', async () => {
    const { input, received } = setup();
    expect(await sendActivationPrompt(document, 'auto', () => false)).toBe(true);
    expect(received[0]).toContain('为当前会话启用 UI');
    expect(received[0]).toContain('dsui');
    await waitFor(() => expect(input.value).toBe(''));
  });
  it('preserves Shift+Enter, composing input, empty text, and Off', () => {
    const { input, received } = setup();
    input.value = '草稿';
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(input.value).toBe('草稿');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(input.value).toBe('草稿');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(received).toEqual(['草稿']);
  });
  it('clicks Send once when it also triggers form submit', async () => {
    const { received } = setup();
    expect(await sendActivationPrompt(document, 'force', () => false)).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0].match(/<!-- DSUI:v1 -->/g)).toHaveLength(1);
  });
  it('does not click a disabled send and restores its own message', async () => {
    const { input, button, received } = setup();
    button.setAttribute('aria-disabled', 'true');
    expect(await sendActivationPrompt(document, 'auto', () => false)).toBe(false);
    expect(received).toEqual([]);
    expect(input.value).toBe('');
  });
  it('leaves an existing draft untouched without sending', async () => {
    const { input, received } = setup();
    input.value = '未发送的草稿';
    expect(await sendActivationPrompt(document, 'auto', () => false)).toBe(false);
    expect(input.value).toBe('未发送的草稿');
    expect(received).toEqual([]);
  });
  it('does not alter ordinary messages, including UI requests', () => {
    const { input, received } = setup();
    input.value = '你好';
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(received[0]).toBe('你好');
    input.value = '画一张柱状图';
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(received[1]).toBe('画一张柱状图');
    input.value = '再给一个表格';
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(received[2]).toBe('再给一个表格');
  });
  it('does not normalize pasted protocol text when Off is selected', async () => {
    const { input, received } = setup();
    const pasted = appendPrompt('请解释这条完整消息', 'auto');
    input.value = pasted;
    expect(await sendActivationPrompt(document, 'off', () => false)).toBe(false);
    expect(input.value).toBe(pasted);
    expect(received).toEqual([]);
  });
  it('does not overwrite a new draft created while activation is pending', async () => {
    const { input } = setup();
    document.querySelector('form')!.addEventListener('submit', () => { input.value = '新草稿'; });
    expect(await sendActivationPrompt(document, 'auto', () => false)).toBe(false);
    expect(input.value).toBe('新草稿');
  });
});
