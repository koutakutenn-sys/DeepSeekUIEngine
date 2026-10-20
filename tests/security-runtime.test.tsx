import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockView } from '../src/components/BlockView';
import { display } from '../src/components/display';
import { PayloadView } from '../src/components/PayloadView';
import { findComposer, findSendButton, isSendAction } from '../src/content/adapter';
import { sendActivationPrompt } from '../src/content/composer';
import { parsePayload } from '../src/protocol';
import { payload } from './fixtures';
import { infoCard } from './p1-fixtures';

describe('security audit interaction regressions', () => {
  it('identifies enhanced data as model-generated content that needs verification', () => {
    const source = payload([infoCard]);
    render(<PayloadView payload={parsePayload(source)!} source={source} onFailure={() => { throw Error('Unexpected render failure'); }} />);
    expect(screen.getByText('内容由模型生成，请核实数据。')).toBeTruthy();
  });
  it.each(['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'toLocaleString'])('treats a missing %s cell as missing while retaining owned values and stable sorting', (key) => {
    const data = { id: 'prototype-table', type: 'data_table', title: '属性名表格', columns: [
      { key: 'name', label: '记录' }, { key, label: '排序值' },
    ], rows: [{ name: '缺失' }, { name: '第二', [key]: 'B' }, { name: '第一', [key]: 'A' }] };
    const parsed = parsePayload(payload([data]));
    expect(parsed).not.toBeNull();
    render(<BlockView block={parsed!.blocks[0]} />);
    const rows = () => within(screen.getByRole('table', { name: '属性名表格' })).getAllByRole('row').slice(1);
    expect(within(rows()[0]).getAllByRole('cell')[1].textContent).toBe('—');
    const sort = screen.getByRole('button', { name: /排序值/ });
    fireEvent.click(sort);
    expect(rows().map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['第一', '第二', '缺失']);
    fireEvent.click(sort);
    expect(rows().map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['第二', '第一', '缺失']);
  });
  it('never returns nonprimitive or nonfinite values as display content', () => {
    for (const value of [() => {}, {}, Symbol('text'), NaN, Infinity, -Infinity]) expect(display(value)).toBe('—');
  });
  it('ignores unrelated submit controls before the actual send button', () => {
    document.body.innerHTML = '<form><textarea id="chat-input"></textarea><button type="submit">Search</button><button aria-label="发送消息">发送</button></form>';
    expect(findSendButton(findComposer(document)!)).toBe(document.querySelector('[aria-label="发送消息"]'));
  });
  it.each(['Search', 'Send feedback', '发送附件', 'Stop'])('does not classify %s submit as chat send', (name) => {
    document.body.innerHTML = '<form><textarea id="chat-input"></textarea><button type="submit"></button></form>';
    const button = document.querySelector('button')!; button.textContent = name;
    expect(isSendAction(button)).toBe(false);
    expect(findSendButton(findComposer(document)!)).toBeNull();
  });
  it('refuses ambiguous send controls and ignores hidden send candidates', () => {
    document.body.innerHTML = '<form><textarea id="chat-input"></textarea><button aria-label="发送">发送</button><button aria-label="发送消息">发送消息</button></form>';
    const input = findComposer(document)!;
    expect(findSendButton(input)).toBeNull();
    document.querySelector('button')!.hidden = true;
    expect(findSendButton(input)).toBe(document.querySelector('[aria-label="发送消息"]'));
  });
  it('never submits feedback after the send control changes during the controlled-input update', async () => {
    document.body.innerHTML = '<form><textarea id="chat-input"></textarea><button type="submit" aria-label="发送">发送</button></form>';
    const input = document.querySelector('textarea')!, button = document.querySelector('button')!;
    const submissions: string[] = [];
    document.querySelector('form')!.addEventListener('submit', (event) => { event.preventDefault(); submissions.push(input.value); input.value = ''; });
    input.addEventListener('input', () => { button.setAttribute('aria-label', 'Send feedback'); button.textContent = 'Send feedback'; });
    expect(await sendActivationPrompt(document, 'auto', () => false)).toBe(false);
    expect(submissions).toEqual([]);
    expect(input.value).toBe('');
  });
});
