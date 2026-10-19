import { createRoot } from 'react-dom/client';
import type { Payload } from '../protocol';
import { PayloadView } from '../components/PayloadView';
import styles from '../styles.css?inline';

export type Theme = 'light' | 'dark';
export type MountedView = {
  host: HTMLElement;
  update: (payload: Payload, source: string) => void;
  setTheme: (theme: Theme) => void;
  dispose: () => void;
};

export function mountPayload(element: HTMLElement, payload: Payload, source: string, theme: Theme, onFailure: () => void): MountedView {
  const host = element.ownerDocument.createElement('div');
  host.dataset.dsuiHost = '';
  host.dataset.theme = theme;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = element.ownerDocument.createElement('style');
  style.textContent = styles;
  const container = element.ownerDocument.createElement('div');
  shadow.append(style, container);
  element.after(host);
  const root = createRoot(container, { onUncaughtError: onFailure });
  // Formatting-only stream updates preserve local controls; changed data resets them.
  const update = (next: Payload, text: string) => root.render(<PayloadView key={JSON.stringify(next)} payload={next} source={text} onFailure={onFailure} />);
  update(payload, source);
  const hidden = element.hidden;
  const display = element.style.getPropertyValue('display');
  const priority = element.style.getPropertyPriority('display');
  element.hidden = true;
  // Author styles on the host page can override the browser's [hidden] rule.
  element.style.setProperty('display', 'none', 'important');
  return {
    host, update,
    setTheme: (next) => { if (host.dataset.theme !== next) host.dataset.theme = next; },
    dispose: () => {
      root.unmount(); host.remove(); element.hidden = hidden;
      if (element.style.getPropertyValue('display') === 'none' && element.style.getPropertyPriority('display') === 'important') {
        if (display) element.style.setProperty('display', display, priority);
        else element.style.removeProperty('display');
      }
    },
  };
}
