import { describe, expect, it } from 'vitest';
import { appendPrompt, stripPrompt } from '../src/prompt';

describe('prompt injection', () => {
  it('leaves Off and blank messages byte-for-byte unchanged', () => {
    expect(appendPrompt('原始草稿  ', 'off')).toBe('原始草稿  ');
    expect(appendPrompt(' \n ', 'auto')).toBe(' \n ');
  });
  it('appends a bounded schema guide with the correct mode', () => {
    const auto = appendPrompt('比较 A 和 B', 'auto');
    expect(auto.startsWith('比较 A 和 B\n\n')).toBe(true);
    expect(auto).toContain('适合可视化时');
    expect(auto).toContain('30');
    expect(auto).toContain('50');
    expect(auto).toContain('不得编造');
    expect(appendPrompt('比较 A 和 B', 'force')).toContain('优先');
  });
  it('does not duplicate its own suffix and can switch modes', () => {
    const original = '含有 DSUI 字样的草稿\n';
    const once = appendPrompt(original, 'auto');
    expect(appendPrompt(once, 'auto')).toBe(once);
    expect(stripPrompt(once)).toBe(original);
    expect(appendPrompt(once, 'force')).toBe(appendPrompt(original, 'force'));
    expect(appendPrompt(once, 'off')).toBe(original);
  });
  it('does not remove a marker embedded in user text', () => {
    const text = '请解释 <!-- DSUI:v1 --> 这段标记';
    expect(stripPrompt(text)).toBe(text);
  });
});
