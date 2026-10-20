import type { LeafBlock } from '../protocol';
import { display } from './display';

type CardBlock = Extract<LeafBlock, { type: 'progress' | 'info_card' | 'comparison' }>;

export function CardContent({ block, nested }: { block: CardBlock; nested: boolean }) {
  if (block.type === 'progress') return <div className="progress-card">
    <div className="progress-label"><span>{block.label ?? block.title}</span><strong>{display(block.value)}%</strong></div>
    <progress aria-label={block.label ?? block.title} max={100} value={block.value}>{display(block.value)}%</progress>
    {block.description && <p>{block.description}</p>}
  </div>;
  if (block.type === 'info_card') return <div className="info-card" data-tone={block.tone ?? 'neutral'}><p>{block.description}</p></div>;
  const Heading = nested ? 'h5' : 'h4';
  return <ul className="comparison-grid" aria-label={`${block.title}方案`}>{block.items.map((item, index) => <li key={index} data-highlight={item.highlight || undefined}>
    <Heading>{item.label}</Heading><p>{item.description}</p>
    {item.features?.length ? <ul>{item.features.map((feature, i) => <li key={i}>{feature}</li>)}</ul> : null}
  </li>)}</ul>;
}
