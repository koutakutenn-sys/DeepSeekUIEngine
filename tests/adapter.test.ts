import { describe, expect, it } from 'vitest';
import { findComposer, findMessages, findSources, findSendButton, isDisabled } from '../src/content/adapter';
import { message, payload } from './fixtures';

describe('DeepSeek DOM adapter', () => {
  it('only identifies dsui code blocks in assistant messages', () => {
    const { article } = message();
    const user = message();
    user.article.dataset.messageAuthorRole = 'user';
    const js = document.createElement('pre');
    js.innerHTML = '<code class="language-javascript">alert(1)</code>';
    article.append(js);
    expect(findMessages(document)).toEqual([article]);
    expect(findSources(article)).toHaveLength(1);
    expect(findSources(article)[0].text).toBe(payload());
  });
  it('recognizes DeepSeek code banners without relying on hashed classes', () => {
    document.body.innerHTML = '<div class="ds-message"><div class="ds-markdown"><div class="ds-code-block"><div class="ds-code-block-banner"><span>dsui</span><button>复制</button></div><pre class="ds-code-block-content"><code></code></pre></div></div></div>';
    document.querySelector('code')!.textContent = payload();
    const messages = findMessages(document);
    expect(messages).toHaveLength(1);
    expect(findSources(messages[0])[0].text).toBe(payload());
  });
  it('does not fall back to Markdown inside a known user message', () => {
    document.body.innerHTML = '<div data-message-author-role="user"><div class="ds-markdown"><pre><code class="language-dsui">{}</code></pre></div></div>';
    expect(findMessages(document)).toHaveLength(0);
  });
  it('finds only an unambiguous chat composer and associated send control', () => {
    document.body.innerHTML = '<textarea aria-label="Search"></textarea><form><textarea id="chat-input"></textarea><button type="submit">发送</button></form>';
    expect(findComposer(document)?.id).toBe('chat-input');
    expect(findSendButton(findComposer(document)!)).toBe(document.querySelector('button'));
  });
  it.each(['dsui', 'json'])('reads the observed md-code-block / pre / span structure (%s)', (language) => {
    document.body.innerHTML = `<div class="ds-message"><div class="ds-markdown ds-assistant-message-main-content"><div class="md-code-block md-code-block-light"><div class="md-code-block-banner-wrap"><div class="md-code-block-banner"><div><span>${language}</span></div><div role="button"><span>复制</span></div></div></div><pre><span></span></pre></div></div></div>`;
    document.querySelector('pre span')!.textContent = payload();
    const messages = findMessages(document);
    expect(messages).toHaveLength(1);
    const sources = findSources(messages[0]);
    expect(sources).toHaveLength(1);
    expect(sources[0].element.classList.contains('md-code-block')).toBe(true);
    expect(sources[0].text).toBe(payload());
  });
  it('recognizes the official unlabeled send button and its disabled class', () => {
    document.body.innerHTML = '<div><div><textarea placeholder="给 DeepSeek 发送消息 "></textarea></div><div role="button" class="ds-button ds-button--iconLabelPrimary">附件</div><div role="button" class="ds-button ds-button--primary ds-button--circle ds-button--disabled"><svg><path d="M7 3V15.0417H7V3.95579" /></svg></div></div>';
    const send = findSendButton(findComposer(document)!);
    expect(send).toBe(document.querySelector('.ds-button--primary'));
    expect(isDisabled(send)).toBe(true);
  });
});
