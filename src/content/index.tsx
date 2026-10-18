import { attachActivationButton } from './activation-button';
import { startEngine } from './engine';
import { readMode, subscribeMode } from '../settings';
import type { Mode } from '../prompt';

// Static manifest injection is restricted to the official site; fail closed if reused.
if (location.origin === 'https://chat.deepseek.com') {
  let mode: Mode = 'off';
  let changed = false;
  let disposed = false;
  const engine = startEngine(document, mode);
  const activation = attachActivationButton(document, () => mode);
  const unsubscribe = subscribeMode((next) => { changed = true; mode = next; engine.setMode(next); activation.refresh(); });
  void readMode().then((next) => {
    if (!changed && !disposed) { mode = next; engine.setMode(next); activation.refresh(); }
  }).catch(() => {
    // No settings access (e.g. extension reloaded): leave the official chat unchanged.
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe(); activation.dispose(); engine.dispose();
  };
  addEventListener('pagehide', (event) => { if (!event.persisted) dispose(); });
}
