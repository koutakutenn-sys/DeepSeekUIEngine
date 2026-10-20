import { parsePayload, payloadBlocks } from '../protocol';
import type { Mode } from '../prompt';
import { findMessages, findSources } from './adapter';
import { mountPayload, type MountedView, type Theme } from './mount';

export function pageTheme(doc: Document): Theme {
  for (const element of [doc.documentElement, doc.body]) {
    if (!element) continue;
    const value = element.getAttribute('data-theme') ?? element.getAttribute('data-color-scheme');
    if (value === 'dark' || element.classList.contains('dark')) return 'dark';
    if (value === 'light' || element.classList.contains('light')) return 'light';
    if (element.style.colorScheme === 'dark' || element.style.colorScheme === 'light') return element.style.colorScheme;
  }
  return doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function startEngine(doc: Document, initialMode: Mode) {
  let mode = initialMode;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const mounted = new Map<HTMLElement, { text: string; view: MountedView }>();
  const failed = new WeakMap<HTMLElement, string>();

  const remove = (element: HTMLElement) => {
    const current = mounted.get(element);
    if (current) { mounted.delete(element); current.view.dispose(); }
  };
  const reconcile = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (disposed) return;
    if (mode === 'off') { for (const element of mounted.keys()) remove(element); return; }
    const active = new Set<HTMLElement>();
    const theme = pageTheme(doc);
    for (const message of findMessages(doc)) {
      let count = 0;
      let totalCount = 0;
      let plots = 0;
      const ids = new Set<string>();
      for (const source of findSources(message)) {
        const payload = parsePayload(source.text);
        if (!payload) continue;
        const blocks = payloadBlocks(payload);
        const nextPlots = blocks.filter((block) => block.type === 'function_plot').length;
        if (count + payload.blocks.length > 3 || totalCount + blocks.length > 12 || plots + nextPlots > 3
          || blocks.some((block) => ids.has(block.id))) continue;
        count += payload.blocks.length;
        totalCount += blocks.length;
        plots += nextPlots;
        blocks.forEach((block) => ids.add(block.id));
        if (failed.get(source.element) === source.text) continue;
        active.add(source.element);
        const current = mounted.get(source.element);
        if (current && current.view.host.isConnected && source.element.nextElementSibling === current.view.host) {
          if (current.text !== source.text) {
            current.view.update(payload, source.text);
            current.text = source.text;
          }
          current.view.setTheme(theme);
        } else {
          remove(source.element);
          const onFailure = () => {
            const text = mounted.get(source.element)?.text ?? source.text;
            failed.set(source.element, text);
            // React may call this while committing; defer root disposal until that commit ends.
            setTimeout(() => {
              if (mounted.get(source.element)?.text === text) remove(source.element);
            }, 0);
          };
          try {
            const view = mountPayload(source.element, payload, source.text, theme, onFailure);
            mounted.set(source.element, { text: source.text, view });
          } catch { onFailure(); }
        }
      }
    }
    for (const element of mounted.keys()) if (!active.has(element)) remove(element);
  };
  const schedule = () => { if (!disposed && timer === undefined) timer = setTimeout(reconcile, 60); };
  const observer = new MutationObserver((records) => {
    if (records.some((record) => !(record.target instanceof Element && record.target.closest('[data-dsui-host]')))) schedule();
  });
  observer.observe(doc.documentElement, { childList: true, characterData: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-color-scheme', 'data-message-author-role', 'data-role', 'data-language', 'style'] });
  const media = doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener('change', schedule);
  reconcile();
  return {
    setMode(next: Mode) { mode = next; reconcile(); },
    dispose() {
      disposed = true;
      observer.disconnect();
      media?.removeEventListener('change', schedule);
      if (timer !== undefined) clearTimeout(timer);
      for (const element of mounted.keys()) remove(element);
    },
  };
}
