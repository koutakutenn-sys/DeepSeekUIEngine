import { createEnablePrompt, type Mode } from '../prompt';
import { findComposer, findSendButton, isDisabled, isSendAction, type Composer } from './adapter';

export function readComposer(composer: Composer): string {
  return composer instanceof HTMLTextAreaElement ? composer.value : composer.textContent ?? '';
}

function writeComposer(composer: Composer, value: string): void {
  if (composer instanceof HTMLTextAreaElement) {
    // Bypass the instance value tracker, then notify the official controlled input.
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(composer, value);
  } else {
    composer.textContent = value;
  }
  composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: null }));
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 30));

/** Called only by the explicit Enable UI action. Ordinary sends have no listeners. */
export async function sendActivationPrompt(doc: Document, mode: Mode, cancelled: (submitted: boolean) => boolean): Promise<boolean> {
  const composer = findComposer(doc);
  if (mode === 'off' || !composer || readComposer(composer) !== '' || !isSendAction(findSendButton(composer))) return false;
  const prompt = createEnablePrompt(mode);
  writeComposer(composer, prompt);
  try {
    // Give the official controlled input time to render its new state and enable Send.
    const deadline = Date.now() + 1200;
    let control = findSendButton(composer);
    do {
      await nextTask();
      if (cancelled(false) || findComposer(doc) !== composer || readComposer(composer) !== prompt) return false;
      control = findSendButton(composer);
    } while ((!isSendAction(control) || isDisabled(control)) && Date.now() < deadline);
    if (!control || !isSendAction(control) || isDisabled(control)) return false;
    control.click();
    do {
      await nextTask();
      if (cancelled(true) || findComposer(doc) !== composer) return false;
      if (readComposer(composer) === '') return true;
      if (readComposer(composer) !== prompt) return false;
    } while (Date.now() < deadline);
    return false;
  } finally {
    // Restore only our unconsumed prompt. Never replace text typed in the meantime.
    if (composer.isConnected && readComposer(composer) === prompt) writeComposer(composer, '');
  }
}
