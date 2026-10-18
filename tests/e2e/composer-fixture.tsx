import { useState } from 'react';
import { createRoot } from 'react-dom/client';

/** Test-only stand-in for the official React controlled composer, in the page's MAIN world. */
function ControlledComposer() {
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState('');
  const send = () => { setSent(draft); setDraft(''); };
  return <>
    <form onSubmit={(event) => { event.preventDefault(); send(); }}>
      <div><textarea placeholder="给 DeepSeek 发送消息 " aria-label="消息" value={draft} onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
        }} /></div>
      <div role="button" tabIndex={0} className={`ds-button ds-button--primary ds-button--circle${draft.trim() ? '' : ' ds-button--disabled'}`} onClick={() => { if (draft.trim()) send(); }}>发送</div>
    </form>
    <pre id="sent">{sent}</pre>
  </>;
}
createRoot(document.getElementById('composer-fixture')!).render(<ControlledComposer />);
