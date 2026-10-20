import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ContainerBlock, LeafBlock } from '../protocol';

export function Panels({ block, renderLeaf }: { block: ContainerBlock; renderLeaf: (leaf: LeafBlock) => ReactNode }) {
  const prefix = useId();
  const isTabs = block.type === 'tabs';
  const initial = isTabs ? block.defaultTab ?? block.items[0].id : '';
  const [selected, setSelected] = useState(initial);
  const [open, setOpen] = useState(() => new Set(block.type === 'accordion' ? block.defaultOpen ?? [] : []));
  const [visited, setVisited] = useState(() => new Set(isTabs ? [initial] : [...open]));
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  const activate = (id: string) => {
    setVisited((previous) => new Set([...previous, id]));
    if (isTabs) setSelected(id);
    else setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = isTabs ? 'ArrowRight' : 'ArrowDown';
    const backward = isTabs ? 'ArrowLeft' : 'ArrowUp';
    const next = event.key === forward ? (index + 1) % block.items.length
      : event.key === backward ? (index + block.items.length - 1) % block.items.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? block.items.length - 1 : -1;
    if (next === -1) return;
    event.preventDefault();
    if (isTabs) activate(block.items[next].id);
    controls.current[next]?.focus();
  };
  const controlId = (index: number) => `${prefix}-control-${index}`;
  const panelId = (index: number) => `${prefix}-panel-${index}`;
  if (isTabs) return <div className="tabs">
    <div className="tab-list" role="tablist" aria-label={block.title}>{block.items.map((item, index) => <button key={item.id}
      ref={(node) => { controls.current[index] = node; }} type="button" role="tab" id={controlId(index)}
      aria-selected={selected === item.id} aria-controls={panelId(index)} tabIndex={selected === item.id ? 0 : -1}
      onClick={() => activate(item.id)} onKeyDown={(event) => navigate(event, index)}>{item.label}</button>)}</div>
    {block.items.map((item, index) => <div key={item.id} role="tabpanel" className="panel-content" id={panelId(index)}
      aria-labelledby={controlId(index)} hidden={selected !== item.id} tabIndex={0}>
      {visited.has(item.id) && item.blocks.map((leaf) => <div key={leaf.id}>{renderLeaf(leaf)}</div>)}
    </div>)}
  </div>;
  return <div className="accordion">{block.items.map((item, index) => <div key={item.id} className="accordion-item">
    <h4 className="accordion-heading"><button type="button" id={controlId(index)}
      ref={(node) => { controls.current[index] = node; }} aria-expanded={open.has(item.id)} aria-controls={panelId(index)}
      onClick={() => activate(item.id)} onKeyDown={(event) => navigate(event, index)}>
      <span>{item.label}</span><span className="accordion-indicator" aria-hidden="true">{open.has(item.id) ? '−' : '+'}</span>
    </button></h4>
    <div className="panel-content" id={panelId(index)} role="region" aria-labelledby={controlId(index)} hidden={!open.has(item.id)}>
      {visited.has(item.id) && item.blocks.map((leaf) => <div key={leaf.id}>{renderLeaf(leaf)}</div>)}
    </div>
  </div>)}</div>;
}
