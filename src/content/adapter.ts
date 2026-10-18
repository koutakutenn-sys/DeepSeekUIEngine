export type Composer = HTMLTextAreaElement | HTMLElement;
export type Source = { element: HTMLElement; text: string };

const assistantSelector = '[data-message-author-role="assistant"], [data-role="assistant"], [data-testid="assistant-message"]';
const userSelector = '[data-message-author-role="user"], [data-role="user"], [data-testid="user-message"]';

/** DeepSeek's hashed CSS classes are deliberately excluded from this boundary. */
export function findMessages(doc: Document): HTMLElement[] {
  const messages = new Set<HTMLElement>();
  for (const element of doc.querySelectorAll<HTMLElement>(`${assistantSelector}, .ds-markdown`)) {
    if (element.closest(userSelector) || element.closest('[data-dsui-host]') || element.closest('.ds-think-content')) continue;
    const message = element.closest<HTMLElement>(assistantSelector)
      ?? element.closest<HTMLElement>('.ds-message, [data-message-id]')
      ?? element;
    // An explicit message root can contain its Markdown fallback matches.
    messages.add(message);
  }
  return [...messages].filter((message) => ![...messages].some((other) => other !== message && other.contains(message)));
}

export function findSources(message: HTMLElement): Source[] {
  const sources = new Map<HTMLElement, string>();
  for (const candidate of message.querySelectorAll<HTMLElement>('pre, .ds-code-block, .md-code-block')) {
    if (candidate.closest('[data-dsui-host]')) continue;
    const wrapper = candidate.closest<HTMLElement>('.ds-code-block, .md-code-block');
    const pre = candidate.closest<HTMLElement>('pre') ?? candidate.querySelector<HTMLElement>('pre');
    const code = pre?.querySelector<HTMLElement>('code') ?? pre ?? candidate;
    const language = code.dataset.language ?? pre?.dataset.language;
    const hasClass = ['language-dsui', 'language-json'].some((name) => code.classList.contains(name) || pre?.classList.contains(name));
    const banner = wrapper?.querySelector('.ds-code-block-banner, .md-code-block-banner');
    const hasBanner = banner && [...banner.querySelectorAll('span')].some((node) => ['dsui', 'json'].includes(node.textContent?.trim().toLowerCase() ?? ''));
    if (!['dsui', 'json'].includes(language?.toLowerCase() ?? '') && !hasClass && !hasBanner) continue;
    const element = wrapper ?? pre;
    const body = pre ?? wrapper?.querySelector<HTMLElement>('.ds-code-block-content') ?? code;
    if (element) sources.set(element, body.textContent ?? '');
  }
  return [...sources].map(([element, text]) => ({ element, text }));
}

export function findComposer(doc: Document): Composer | null {
  const textarea = doc.querySelector<HTMLTextAreaElement>('textarea#chat-input, textarea[data-testid="chat-input"], textarea[placeholder*="DeepSeek"], textarea[placeholder*="发送消息"], textarea[placeholder*="Message"]');
  if (textarea && !textarea.disabled && !textarea.readOnly) return textarea;
  const editable = doc.querySelector<HTMLElement>('[contenteditable="true"][role="textbox"][data-testid="chat-input"], [contenteditable="true"]#chat-input');
  return editable?.getAttribute('aria-disabled') === 'true' ? null : editable;
}

export function findSendButton(composer: Composer): HTMLElement | null {
  // Restrict fallback submit buttons to the composer's own form/container.
  const scope = composer.closest('form') ?? composer.parentElement?.parentElement;
  if (!scope) return null;
  return scope.querySelector<HTMLElement>('[data-testid="send-button"], button[aria-label="发送"], button[aria-label="发送消息"], button[aria-label="Send"], button[aria-label="Send message"], [role="button"][aria-label="发送"], [role="button"][aria-label="Send message"], .ds-icon-button[aria-label="发送消息"], button[type="submit"], [role="button"].ds-button--primary.ds-button--circle');
}

export function isDisabled(button: HTMLElement | null): boolean {
  return !!button && (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true' || button.classList.contains('ds-icon-button--disabled') || button.classList.contains('ds-button--disabled'));
}

export function isSendAction(button: HTMLElement | null): boolean {
  if (!button) return false;
  const label = `${button.getAttribute('aria-label') ?? ''} ${button.getAttribute('data-testid') ?? ''} ${button.textContent ?? ''}`;
  if (/stop|停止/i.test(label)) return false;
  if (/send|发送/i.test(label) || button.matches('button[type="submit"]')) return true;
  // The current official unlabeled control has this upward-arrow path. Unknown
  // icons (especially Stop during generation) are never clicked automatically.
  return button.matches('.ds-button--primary.ds-button--circle')
    && [...button.querySelectorAll('svg path')].some((path) => path.getAttribute('d')?.includes('V15.0417H7V3.95579'));
}
