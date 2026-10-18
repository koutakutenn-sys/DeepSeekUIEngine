import { isMode, type Mode } from './prompt';

const KEY = 'dsui-mode';
export async function readMode(): Promise<Mode> {
  const result = await chrome.storage.local.get(KEY);
  return isMode(result[KEY]) ? result[KEY] : 'auto';
}
export async function saveMode(mode: Mode): Promise<void> {
  await chrome.storage.local.set({ [KEY]: mode });
}
export function subscribeMode(callback: (mode: Mode) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && KEY in changes) callback(isMode(changes[KEY].newValue) ? changes[KEY].newValue : 'auto');
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
