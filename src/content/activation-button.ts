import type { Mode } from '../prompt';
import { findComposer, findSendButton, isSendAction } from './adapter';
import { readComposer, sendActivationPrompt } from './composer';
import { createConversationPolicy } from './conversation-policy';
import { pageTheme } from './engine';

const styles = `
:host { all: initial; display: block; margin: 0 0 8px; color-scheme: light; }
.row { display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:8px; font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif; }
button { display:inline-flex; align-items:center; gap:6px; font:inherit; cursor:pointer; padding:6px 11px; border:1px solid #dce2ee; border-radius:9px; background:#f7f9ff; color:#4561db; }
button:hover:enabled { background:#eef2ff; border-color:#bac7ff; }
button:disabled { cursor:default; color:#8c94a4; background:#f7f8fa; border-color:#e5e8ef; }
button:focus-visible { outline:2px solid #4d6bfe; outline-offset:3px; }
.status { color:#858c99; font-size:11px; }
:host([data-theme="dark"]) { color-scheme:dark; }
:host([data-theme="dark"]) button { background:#292e43; border-color:#454e74; color:#a6b5ff; }
:host([data-theme="dark"]) button:disabled { background:#292a30; border-color:#3b3d47; color:#999fac; }
`;

export function attachActivationButton(doc: Document, getMode: () => Mode) {
  const policy = createConversationPolicy(doc);
  const host = doc.createElement('div'); host.dataset.dsuiActivationHost = '';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style'); style.textContent = styles;
  const row = doc.createElement('div'); row.className = 'row';
  const button = doc.createElement('button'); button.type = 'button';
  const status = doc.createElement('span'); status.className = 'status'; status.setAttribute('role', 'status');
  row.append(status, button); shadow.append(style, row);
  let disposed = false;
  let sending = false;
  let composing = false;
  let failure = '';

  const refresh = () => {
    if (disposed) return;
    const composer = findComposer(doc);
    const mode = getMode();
    const anchor = composer?.closest('form') ?? composer?.parentElement?.parentElement;
    if (!composer || !anchor || mode === 'off') { host.remove(); return; }
    if (anchor.previousElementSibling !== host) anchor.before(host);
    const theme = pageTheme(doc);
    if (host.dataset.theme !== theme) host.dataset.theme = theme;
    const enabled = policy.isEnabled();
    const draft = readComposer(composer) !== '';
    const available = isSendAction(findSendButton(composer));
    button.disabled = enabled || sending || draft || composing || !available;
    button.textContent = sending ? '正在启用…' : enabled ? 'UI 已启用' : '启用 UI';
    button.title = enabled ? '当前会话已发送过 UI 说明' : draft ? '请先发送或清空草稿，再启用 UI' : !available ? '等待页面可以发送消息' : '向当前会话自动发送一条 UI 启用说明';
    status.textContent = failure || (draft && !enabled ? '请先处理草稿' : '');
  };
  const activate = async () => {
    refresh();
    if (disposed || button.disabled || getMode() === 'off') return;
    const conversation = policy.conversationKey();
    sending = true; failure = ''; refresh();
    try {
      const sent = await sendActivationPrompt(doc, getMode(), (submitted) => {
        const current = policy.conversationKey();
        const assigned = submitted && conversation === 'new' && /^\/a\/chat\/s\//.test(current);
        return disposed || getMode() === 'off' || (current !== conversation && !assigned);
      });
      if (sent) policy.markSent(conversation);
      else if (!disposed && policy.conversationKey() === conversation) failure = '未发送成功，请重试';
    } catch { failure = '未发送成功，请重试'; }
    finally { sending = false; refresh(); }
  };
  const onStart = () => { composing = true; refresh(); };
  const onEnd = () => { composing = false; refresh(); };
  button.addEventListener('click', () => { void activate(); });
  const unsubscribe = policy.subscribe(refresh);
  doc.addEventListener('input', refresh, true);
  doc.addEventListener('compositionstart', onStart, true);
  doc.addEventListener('compositionend', onEnd, true);
  refresh();
  return {
    refresh,
    dispose() {
      disposed = true; unsubscribe(); policy.dispose(); host.remove();
      doc.removeEventListener('input', refresh, true);
      doc.removeEventListener('compositionstart', onStart, true);
      doc.removeEventListener('compositionend', onEnd, true);
    },
  };
}
