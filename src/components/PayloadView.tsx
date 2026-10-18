import { Component, type ReactNode } from 'react';
import type { Payload } from '../protocol';
import { BlockView } from './BlockView';

class RenderBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function PayloadView({ payload, source, onFailure }: { payload: Payload; source: string; onFailure: () => void }) {
  return <RenderBoundary onFailure={onFailure}>
    <div className="dsui-root">
      <div className="view-label"><span aria-hidden="true" className="view-dot" />数据视图<span className="view-brand">DSUI</span></div>
      <div className="flex flex-col gap-4">{payload.blocks.map((block) => <BlockView key={block.id} block={block} />)}</div>
      <details className="source-disclosure"><summary>查看原始 DSUI</summary><pre>{source}</pre></details>
    </div>
  </RenderBoundary>;
}
