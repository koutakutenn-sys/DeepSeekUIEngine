const assistant = '[data-message-author-role="assistant"], [data-role="assistant"], [data-testid="assistant-message"], .ds-assistant-message-main-content, .ds-markdown';

function hasIntroduction(doc: Document): boolean {
  // Inspect only visible chat DOM, never cookies, site state or storage. Both legacy
  // and current prompts carry these delimiters, so existing conversations survive refresh.
  return [...doc.querySelectorAll<HTMLElement>('[data-message-author-role="user"], [data-role="user"], [data-testid="user-message"], .ds-message')]
    .filter((element) => !element.matches(assistant) && !element.querySelector(assistant))
    .some((element) => {
      const text = element.textContent ?? '';
      return text.includes('<!-- DSUI:v1 -->') && text.includes('<!-- /DSUI -->');
    });
}

function routeKey(doc: Document): string {
  const pathname = doc.location?.pathname ?? '/';
  return /^\/(?:a\/chat\/?)?$/.test(pathname) ? 'new' : pathname;
}

/** Only conversation keys live in this tab's memory; no chat data is persisted. */
export function createConversationPolicy(doc: Document) {
  const initialized = new Set<string>();
  const listeners = new Set<() => void>();
  let previous = routeKey(doc);
  const conversationKey = () => {
    const current = routeKey(doc);
    if (current !== previous) {
      // DeepSeek assigns /a/chat/s/<id> only after the new chat's first send.
      if (previous === 'new' && initialized.has('new') && /^\/a\/chat\/s\//.test(current)) initialized.add(current);
      if (current === 'new') initialized.delete('new');
      previous = current;
    }
    return current;
  };
  // SPA routes can change several times between sends. Track each transition so
  // new -> assigned ID -> new cannot collapse into a single unchanged "new" key.
  const onRouteChange = () => { conversationKey(); listeners.forEach((listener) => listener()); };
  const observer = new MutationObserver(onRouteChange);
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'disabled', 'aria-disabled', 'placeholder', 'd', 'data-theme', 'data-color-scheme'] });
  const navigation = (doc.defaultView as (Window & { navigation?: EventTarget }) | null)?.navigation;
  navigation?.addEventListener('currententrychange', onRouteChange);
  doc.defaultView?.addEventListener('popstate', onRouteChange);
  return {
    conversationKey,
    isEnabled(): boolean {
      const key = conversationKey();
      if (initialized.has(key)) return true;
      // During SPA navigation, old messages can outlive their URL briefly. Treat
      // history as current DOM evidence, never permanent state for the new key.
      return hasIntroduction(doc);
    },
    markSent(key: string) {
      initialized.add(key);
      const current = conversationKey();
      if (key === 'new' && /^\/a\/chat\/s\//.test(current)) initialized.add(current);
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() {
      observer.disconnect();
      navigation?.removeEventListener('currententrychange', onRouteChange);
      doc.defaultView?.removeEventListener('popstate', onRouteChange);
      listeners.clear();
    },
  };
}
