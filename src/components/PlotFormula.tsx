import { useLayoutEffect, useRef, useState } from 'react';
import katex from 'katex';

// Function definitions accept mathematical notation, not document macros, links or custom styling.
// TeX control words end before digits/underscores as well as punctuation.
const documentCommands = /\\(?:href|url|includegraphics|html[a-z]*|color|textcolor|colorbox|fcolorbox|class|cssId|style|def|gdef|edef|xdef|let|futurelet|newcommand|renewcommand|providecommand|global|newenvironment|renewenvironment|require)(?![a-z@])/i;

export function PlotFormula({ latex, plain }: { latex?: string; plain: string }) {
  const target = useRef<HTMLSpanElement>(null);
  const [rendered, setRendered] = useState(false);
  useLayoutEffect(() => {
    const element = target.current!;
    element.replaceChildren();
    setRendered(false);
    if (!latex || documentCommands.test(latex)) return;
    try {
      // Native MathML needs no remote CSS/fonts or additional extension permissions.
      // Render detached first so a failed parse cannot leave a partial formula behind.
      const detached = element.ownerDocument.createElement('span');
      katex.render(latex, detached, { output: 'mathml', displayMode: true, throwOnError: true,
        trust: false, strict: 'error', maxExpand: 100, maxSize: 6, macros: {} });
      // Built-in aliases such as \red can introduce colors without a \color token.
      if (detached.querySelector('[mathcolor], [mathbackground], [style], [href], [src]')) return;
      element.replaceChildren(...detached.childNodes);
      setRendered(true);
    } catch {
      // A display-only parse error must not remove a valid numerical plot.
    }
  }, [latex]);
  return <output className="plot-formula" aria-live="polite" aria-atomic="true">
    <span className="plot-math" ref={target} hidden={!rendered} />
    {!rendered && plain}
  </output>;
}
