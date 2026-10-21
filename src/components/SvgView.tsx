import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createSafeSvg } from '../svg/sanitize-svg';

export function SvgView({ source, title }: { source: string; title: string }) {
  const target = useRef<HTMLDivElement>(null), id = useId().replace(/[^A-Za-z0-9_-]/g, '-');
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    try { target.current!.replaceChildren(createSafeSvg(source, id)); }
    catch { target.current!.replaceChildren(); setFailed(true); }
  }, [source, id]);
  if (failed) throw new Error('Static SVG validation failed');
  return <div className="svg-canvas" role="img" aria-label={title} ref={target} />;
}
