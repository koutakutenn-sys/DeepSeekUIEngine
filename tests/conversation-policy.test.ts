import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createConversationPolicy } from '../src/content/conversation-policy';
import { appendPrompt } from '../src/prompt';

beforeEach(() => { history.replaceState(null, '', '/a/chat/s/first'); });
const policies: ReturnType<typeof createConversationPolicy>[] = [];
function createPolicy() {
  const policy = createConversationPolicy(document);
  policies.push(policy);
  return policy;
}
afterEach(() => { for (const policy of policies.splice(0)) policy.dispose(); });

describe('one protocol introduction per conversation', () => {
  it('starts inactive until an explicit activation is recorded', () => {
    const policy = createPolicy();
    expect(policy.isEnabled()).toBe(false);
    policy.markSent(policy.conversationKey());
    expect(policy.isEnabled()).toBe(true);
  });
  it('stays initialized when modes change and remembers visited conversations', () => {
    const policy = createPolicy();
    policy.markSent(policy.conversationKey());
    expect(policy.isEnabled()).toBe(true);
    history.replaceState(null, '', '/a/chat/s/second');
    expect(policy.isEnabled()).toBe(false);
    history.replaceState(null, '', '/a/chat/s/first');
    expect(policy.isEnabled()).toBe(true);
  });
  it('carries the first introduction across the new-chat URL transition', () => {
    history.replaceState(null, '', '/');
    const policy = createPolicy();
    policy.markSent(policy.conversationKey());
    history.replaceState(null, '', '/a/chat/s/created');
    expect(policy.isEnabled()).toBe(true);
    history.replaceState(null, '', '/');
    expect(policy.isEnabled()).toBe(false);
  });
  it('recognizes previous user introductions after refresh without storing chat data', () => {
    document.body.innerHTML = '<div class="ds-message"><div class="user-content"></div></div>';
    document.querySelector('.user-content')!.textContent = appendPrompt('画一张柱状图', 'auto');
    const policy = createPolicy();
    expect(policy.isEnabled()).toBe(true);
  });
  it('does not mistake an assistant quoting the marker for a user introduction', () => {
    document.body.innerHTML = '<div class="ds-message"><div class="ds-assistant-message-main-content"></div></div>';
    document.querySelector('.ds-assistant-message-main-content')!.textContent = appendPrompt('示例', 'auto');
    const policy = createPolicy();
    expect(policy.isEnabled()).toBe(false);
  });
  it('observes an assigned conversation ID even when no later message is sent before starting another chat', async () => {
    history.replaceState(null, '', '/');
    const policy = createPolicy();
    policy.markSent(policy.conversationKey());
    history.replaceState(null, '', '/a/chat/s/created');
    document.body.append(document.createElement('article'));
    await Promise.resolve();
    history.replaceState(null, '', '/');
    document.body.replaceChildren();
    await Promise.resolve();
    expect(policy.isEnabled()).toBe(false);
  });
});
