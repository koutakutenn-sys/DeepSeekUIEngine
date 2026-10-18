import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachActivationButton } from '../src/content/activation-button';
import type { Mode } from '../src/prompt';

const cleanups: (() => void)[] = [];
beforeEach(() => { history.replaceState(null, '', '/'); });
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); });

function setup(consume = true) {
  document.body.innerHTML = '<form><textarea id="chat-input"></textarea><button type="submit" aria-label="发送">发送</button></form>';
  const input = document.querySelector('textarea')!;
  const sent: string[] = [];
  let mode: Mode = 'auto';
  const controller = attachActivationButton(document, () => mode);
  cleanups.push(controller.dispose);
  document.querySelector('form')!.addEventListener('submit', (event) => {
    event.preventDefault(); sent.push(input.value);
    if (consume) input.value = '';
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault(); sent.push(input.value); if (consume) input.value = '';
    }
  });
  const button = () => document.querySelector('[data-dsui-activation-host]')!.shadowRoot!.querySelector('button')!;
  return { input, sent, button, controller, setMode: (next: Mode) => { mode = next; controller.refresh(); } };
}

describe('manual UI activation', () => {
  it('sends an independent protocol message only when Enable UI is clicked', async () => {
    const { input, sent, button } = setup();
    input.value = '画一张柱状图';
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(sent).toEqual(['画一张柱状图']);
    fireEvent.click(button());
    await waitFor(() => expect(button().textContent).toBe('UI 已启用'));
    expect(sent).toHaveLength(2);
    expect(sent[1]).toContain('为当前会话启用 UI');
    expect(sent[1]).toContain('<!-- DSUI:v1 -->');
    fireEvent.click(button());
    expect(sent).toHaveLength(2);
  });
  it('keeps an existing draft untouched and explains why activation is disabled', () => {
    const { input, sent, button } = setup();
    input.value = '尚未发送的草稿'; fireEvent.input(input);
    expect(button().disabled).toBe(true);
    expect(button().title).toContain('草稿');
    fireEvent.click(button());
    expect(input.value).toBe('尚未发送的草稿');
    expect(sent).toEqual([]);
  });
  it('stays enabled when the official first send assigns the new conversation an ID', async () => {
    const { button, sent } = setup();
    document.querySelector('form')!.addEventListener('submit', () => {
      history.replaceState(null, '', '/a/chat/s/created');
    });
    fireEvent.click(button());
    await waitFor(() => expect(button().textContent).toBe('UI 已启用'));
    expect(button().disabled).toBe(true);
    expect(sent).toHaveLength(1);
  });
  it('cancels activation if the user changes conversations before Send is clicked', async () => {
    const { input, button, sent } = setup();
    input.addEventListener('input', () => { history.replaceState(null, '', '/a/chat/s/other'); }, { once: true });
    fireEvent.click(button());
    await waitFor(() => expect(input.value).toBe(''));
    expect(sent).toEqual([]);
    expect(button().textContent).toBe('启用 UI');
  });
  it('does not activate or click the official Stop action while a response is generating', () => {
    const { button, sent, controller } = setup();
    const official = document.querySelector('form > button')!;
    official.setAttribute('aria-label', '停止生成'); official.textContent = '停止';
    controller.refresh();
    expect(button().disabled).toBe(true);
    fireEvent.click(button());
    expect(sent).toEqual([]);
  });
  it('keeps ordinary Enter and send-button messages verbatim in Force too', () => {
    const { input, sent, setMode } = setup();
    setMode('force');
    input.value = '普通消息'; fireEvent.keyDown(input, { key: 'Enter' });
    input.value = '表格和图表'; fireEvent.click(document.querySelector('form > button')!);
    expect(sent).toEqual(['普通消息', '表格和图表']);
  });
  it('restores an unconsumed activation message and allows retry', async () => {
    const { input, button, sent } = setup(false);
    fireEvent.click(button());
    await waitFor(() => expect(input.value).toBe(''), { timeout: 2500 });
    await waitFor(() => expect(button().disabled).toBe(false));
    expect(button().textContent).toBe('启用 UI');
    expect(sent).toHaveLength(1);
  });
  it('hides in Off and recognizes an introduction already in the current history', () => {
    const { button, setMode } = setup();
    const user = document.createElement('div'); user.className = 'ds-message';
    user.textContent = '<!-- DSUI:v1 -->格式说明<!-- /DSUI -->';
    document.body.append(user);
    setMode('auto');
    expect(button().textContent).toBe('UI 已启用');
    expect(button().disabled).toBe(true);
    setMode('off');
    expect(document.querySelector('[data-dsui-activation-host]')).toBeNull();
  });
  it('does not remember old history as activation of a newly opened conversation', async () => {
    history.replaceState(null, '', '/a/chat/s/existing');
    const { button, controller } = setup();
    const oldMessage = document.createElement('div'); oldMessage.className = 'ds-message';
    oldMessage.textContent = '<!-- DSUI:v1 -->格式说明<!-- /DSUI -->';
    document.body.append(oldMessage); controller.refresh();
    expect(button().textContent).toBe('UI 已启用');
    // Navigation changes before React replaces the previous conversation's DOM.
    history.replaceState(null, '', '/');
    dispatchEvent(new PopStateEvent('popstate'));
    oldMessage.remove();
    await waitFor(() => expect(button().textContent).toBe('启用 UI'));
    expect(button().disabled).toBe(false);
  });
  it('cleans up and remounts a single button when the composer is replaced', async () => {
    const { controller } = setup();
    const form = document.querySelector('form')!;
    form.replaceWith(form.cloneNode(true));
    await waitFor(() => expect(document.querySelectorAll('[data-dsui-activation-host]')).toHaveLength(1));
    controller.dispose();
    expect(document.querySelector('[data-dsui-activation-host]')).toBeNull();
  });
});
