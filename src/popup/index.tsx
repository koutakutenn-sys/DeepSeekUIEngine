import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { readMode, saveMode, subscribeMode } from '../settings';
import type { Mode } from '../prompt';
import './popup.css';

const choices: { mode: Mode; label: string; detail: string; icon: string }[] = [
  { mode: 'off', label: 'Off', detail: '关闭增强，保留原始聊天', icon: '○' },
  { mode: 'auto', label: 'Auto', detail: '手动启用后，按需呈现 UI', icon: '✧' },
  { mode: 'force', label: 'Force', detail: '手动启用时，引导优先使用 UI', icon: '↗' },
];

function Popup() {
  const [mode, setMode] = useState<Mode>('auto');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('正在读取设置…');
  useEffect(() => {
    let active = true;
    let changed = false;
    const unsubscribe = subscribeMode((next) => { changed = true; if (active) setMode(next); });
    void readMode().then((next) => { if (active) { if (!changed) setMode(next); setReady(true); setFeedback('设置保存在此设备'); } })
      .catch(() => { if (active) setFeedback('无法读取设置，请关闭后重试'); });
    return () => { active = false; unsubscribe(); };
  }, []);
  const select = async (next: Mode) => {
    if (saving || !ready) return;
    setSaving(true);
    try { await saveMode(next); setMode(next); setFeedback('已保存 · 对已打开的 DeepSeek 页面即时生效'); }
    catch { setFeedback('保存失败，请重试'); }
    finally { setSaving(false); }
  };
  return <main>
    <header><div className="logo" aria-hidden="true">✧</div><div><h1>DeepSeek UI Engine</h1><p>让信息有更清晰的表达</p></div><span className="version">v{chrome.runtime.getManifest().version}</span></header>
    <div className="section-label">智能 UI 模式<span>本地运行</span></div>
    <fieldset disabled={!ready || saving}><legend className="sr-only">选择智能 UI 模式</legend>
      {choices.map((choice) => <label key={choice.mode} className={`choice ${mode === choice.mode ? 'selected' : ''}`}>
        <input type="radio" name="mode" value={choice.mode} checked={mode === choice.mode} onChange={() => void select(choice.mode)} />
        <span className="choice-icon" aria-hidden="true">{choice.icon}</span><span className="choice-text"><strong>{choice.label}{choice.mode === 'auto' && <small>推荐</small>}</strong><span>{choice.detail}</span></span><span className="radio-mark" aria-hidden="true" />
      </label>)}
    </fieldset>
    <div className="feedback" role="status" aria-live="polite">{feedback}</div>
    <div className="note"><span aria-hidden="true">↳</span><p>在聊天输入框旁点击“启用 UI”，会自动发送一条启用说明。普通消息始终原样发送。</p></div>
    <footer><span className="privacy-dot" />仅保存模式 · 无需 API 密钥</footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Popup />);
