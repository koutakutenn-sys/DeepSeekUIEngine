import createDOMPurify from 'dompurify';
import { hasUnsafeText } from '../text-safety';

const namespace = 'http://www.w3.org/2000/svg';
const tags = new Set(['svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'title', 'desc', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'marker']);
const attributes = ['xmlns', 'viewBox', 'id', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
  'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
  'opacity', 'transform', 'clip-path', 'clip-rule', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'width', 'height', 'points', 'd', 'dx', 'dy', 'font-size', 'font-weight', 'font-style', 'text-anchor',
  'dominant-baseline', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'offset', 'stop-color', 'stop-opacity',
  'clipPathUnits', 'marker-start', 'marker-mid', 'marker-end', 'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'orient'];
const attributeSet = new Set(attributes);
const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const numberToken = /[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g;
const enums: Record<string, readonly string[]> = {
  'fill-rule': ['nonzero', 'evenodd'], 'clip-rule': ['nonzero', 'evenodd'],
  'stroke-linecap': ['butt', 'round', 'square'], 'stroke-linejoin': ['miter', 'round', 'bevel'],
  'text-anchor': ['start', 'middle', 'end'], 'font-style': ['normal', 'italic'],
  'dominant-baseline': ['auto', 'middle', 'central', 'hanging', 'alphabetic', 'text-before-edge', 'text-after-edge'],
  gradientUnits: ['objectBoundingBox', 'userSpaceOnUse'], clipPathUnits: ['objectBoundingBox', 'userSpaceOnUse'],
  spreadMethod: ['pad', 'reflect', 'repeat'], markerUnits: ['strokeWidth', 'userSpaceOnUse'],
};
const numeric = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height',
  'dx', 'dy', 'stroke-width', 'stroke-miterlimit', 'stroke-dashoffset', 'markerWidth', 'markerHeight', 'refX', 'refY']);
function requireSvg(condition: unknown): asserts condition { if (!condition) throw new Error('Unsupported or oversized static SVG'); }
function numbers(value: string, percent = false): number[] {
  const source = percent && value.endsWith('%') ? value.slice(0, -1) : value;
  const matches = source.match(numberToken) ?? [];
  requireSvg(matches.length > 0 && matches.length <= 2000 && !source.replace(numberToken, '').replace(/[\s,]/g, ''));
  const values = matches.map(Number);
  requireSvg(values.every((value) => Number.isFinite(value) && Math.abs(value) <= 1_000_000));
  return values;
}
function bounds(value: string): number[] {
  const values = numbers(value);
  requireSvg(values.length === 4 && values[2] >= 0.001 && values[3] >= 0.001);
  return values;
}
function pathData(value: string) {
  const tokens = [...value.matchAll(/[MmZzLlHhVvCcSsQqTtAa]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g)];
  requireSvg(tokens.length > 0 && /^[Mm]$/.test(tokens[0][0]));
  const isCommand = (token: string) => /^[A-Za-z]$/.test(token);
  let end = 0, count = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index], gap = value.slice(end, token.index);
    requireSvg(/^[\s,]*$/.test(gap) && (gap.match(/,/g)?.length ?? 0) <= 1);
    if (gap.includes(',')) requireSvg(index > 0 && !isCommand(tokens[index - 1][0]) && !isCommand(token[0]));
    if (!isCommand(token[0])) {
      const number = Number(token[0]);
      requireSvg(++count <= 2000 && Number.isFinite(number) && Math.abs(number) <= 1_000_000);
    }
    end = token.index! + token[0].length;
  }
  requireSvg(/^\s*$/.test(value.slice(end)));
  const arities: Record<string, number> = { M: 2, Z: 0, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  let index = 0;
  while (index < tokens.length) {
    const command = tokens[index++][0].toUpperCase(), arity = arities[command], args: string[] = [];
    requireSvg(arity !== undefined);
    while (index < tokens.length && !isCommand(tokens[index][0])) args.push(tokens[index++][0]);
    requireSvg(arity === 0 ? args.length === 0 : args.length >= arity && args.length % arity === 0);
    if (command === 'A') for (let offset = 0; offset < args.length; offset += 7) {
      requireSvg(Number(args[offset]) >= 0 && Number(args[offset + 1]) >= 0
        && /^[01]$/.test(args[offset + 3]) && /^[01]$/.test(args[offset + 4]));
    }
  }
}
function measure(root: Element): Element[] {
  const nodes: Element[] = [], stack = [{ node: root, depth: 1 }];
  while (stack.length) {
    const { node, depth } = stack.pop()!;
    requireSvg(depth <= 16 && nodes.length < 500);
    nodes.push(node);
    for (const child of node.children) stack.push({ node: child, depth: depth + 1 });
  }
  return nodes;
}

/** Sanitizes detached XML and returns native SVG only; it never reparses HTML or loads assets. */
export function createSafeSvg(source: string, prefix: string): SVGSVGElement {
  requireSvg(source.length <= 20_000 && /^[A-Za-z0-9_-]{1,80}$/.test(prefix));
  requireSvg(!/<!\s*(?:DOCTYPE|ENTITY)|<\?/i.test(source));
  const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = xml.documentElement;
  requireSvg(root.localName === 'svg' && root.namespaceURI === namespace && !xml.querySelector('parsererror'));
  measure(root);
  const purifier = createDOMPurify(window);
  purifier.sanitize(root, { IN_PLACE: true, NAMESPACE: namespace, ALLOWED_NAMESPACES: [namespace],
    ALLOWED_TAGS: [...tags, '#text'], ALLOWED_ATTR: attributes, ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    KEEP_CONTENT: false, SANITIZE_DOM: true });
  const nodes = measure(root), ids = new Map<string, Element>(), edges = new Map<string, Set<string>>();
  const changes: { element: Element; name: string; value: string }[] = [];
  for (const node of nodes) {
    requireSvg(node.namespaceURI === namespace && tags.has(node.localName) && (node === root || node.localName !== 'svg'));
    if (node.hasAttribute('id')) {
      const id = node.getAttribute('id')!;
      requireSvg(idPattern.test(id) && !ids.has(id)); ids.set(id, node);
    }
  }
  const reference = (element: Element, name: string, value: string, allowed: string[]) => {
    const match = /^url\(#([A-Za-z][A-Za-z0-9_-]{0,63})\)$/i.exec(value);
    requireSvg(match && ids.has(match[1]) && allowed.includes(ids.get(match[1])!.localName));
    const owner = element.closest('linearGradient, radialGradient, clipPath, marker');
    if (owner) {
      const ownerId = owner.getAttribute('id'); requireSvg(ownerId);
      if (!edges.has(ownerId)) edges.set(ownerId, new Set());
      edges.get(ownerId)!.add(match[1]);
    }
    changes.push({ element, name, value: `url(#dsui-svg-${prefix}-${match[1]})` });
  };
  for (const node of nodes) {
    // Numeric character entities must not bypass display-text control checks.
    requireSvg(!hasUnsafeText(node.textContent ?? ''));
    for (const attribute of [...node.attributes]) {
      const { name, value, namespaceURI } = attribute;
      requireSvg(attributeSet.has(name) && (!namespaceURI || (name === 'xmlns' && value === namespace)));
      if (node === root && ['width', 'height'].includes(name)) continue;
      if (name === 'xmlns') requireSvg(value === namespace);
      else if (name === 'id') changes.push({ element: node, name, value: `dsui-svg-${prefix}-${value}` });
      else if (name === 'viewBox') bounds(value);
      else if (['fill', 'stroke', 'stop-color'].includes(name)) {
        if (/^url/i.test(value)) reference(node, name, value, ['linearGradient', 'radialGradient']);
        else {
          requireSvg(/^(?:#[0-9a-f]{3,8}|[a-z]{1,24})$/i.test(value));
          const probe = document.createElement('span'); probe.style.color = value;
          requireSvg(['none', 'currentColor', 'transparent'].includes(value) || !!probe.style.color);
        }
      } else if (name === 'clip-path') {
        if (value !== 'none') {
          requireSvg(!node.closest('defs, linearGradient, radialGradient, clipPath, marker'));
          reference(node, name, value, ['clipPath']);
        }
      } else if (name.startsWith('marker-')) {
        if (value !== 'none') {
          // Prevent inherited or acyclic nested markers from multiplying paint work.
          requireSvg(['path', 'line', 'polyline', 'polygon'].includes(node.localName)
            && !node.closest('defs, linearGradient, radialGradient, clipPath, marker')
            && !node.querySelector('marker'));
          reference(node, name, value, ['marker']);
        }
      } else if (Object.hasOwn(enums, name)) requireSvg(enums[name].includes(value));
      else if (['opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'offset'].includes(name)) {
        const values = numbers(value, name === 'offset');
        requireSvg(values.length === 1 && values[0] >= 0 && values[0] <= (name === 'offset' && value.endsWith('%') ? 100 : 1));
      } else if (name === 'font-size') { const values = numbers(value); requireSvg(values.length === 1 && values[0] > 0 && values[0] <= 256); }
      else if (name === 'font-weight') requireSvg(/^(?:normal|bold|[1-9]00)$/.test(value));
      else if (name === 'orient' && ['auto', 'auto-start-reverse'].includes(value)) { /* fixed SVG keywords */ }
      else if (['transform', 'gradientTransform'].includes(name)) {
        const remainder = value.replace(/(?:matrix|translate|scale|rotate|skewX|skewY)\(\s*[-+\d.eE,\s]+\)\s*/g, '');
        requireSvg(!remainder && value.length > 0); numbers(value.replace(/[A-Za-z]+\(/g, '').replace(/\)/g, ' '));
      } else if (name === 'd') {
        pathData(value);
      } else if (name === 'points' || name === 'stroke-dasharray') {
        if (name !== 'stroke-dasharray' || value !== 'none') requireSvg(numbers(value).length <= 2000);
      } else if (numeric.has(name) || name === 'orient') {
        const percent = ['linearGradient', 'radialGradient'].includes(node.localName) && ['x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r'].includes(name);
        const values = numbers(value, percent);
        const textList = ['text', 'tspan'].includes(node.localName) && ['x', 'y', 'dx', 'dy'].includes(name);
        requireSvg(textList || values.length === 1);
        if (value.endsWith('%')) requireSvg(values.length === 1 && Math.abs(values[0]) <= 100);
      }
      else requireSvg(false);
    }
  }
  const visited = new Set<string>(), active = new Set<string>();
  function visit(id: string, depth = 0) {
    requireSvg(!active.has(id) && depth <= 16);
    if (visited.has(id)) return;
    active.add(id); for (const next of edges.get(id) ?? []) visit(next, depth + 1);
    active.delete(id); visited.add(id);
  }
  for (const id of edges.keys()) visit(id);
  requireSvg(root.hasAttribute('viewBox'));
  bounds(root.getAttribute('viewBox')!);
  requireSvg(nodes.some((node) => ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text'].includes(node.localName)
    && !node.closest('defs, clipPath, marker')));
  // Only fixed attributes and validated, scoped fragment IDs are changed after purification.
  for (const change of changes) change.element.setAttribute(change.name, change.value);
  root.setAttribute('width', '100%'); root.removeAttribute('height');
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet'); root.setAttribute('aria-hidden', 'true');
  return root as unknown as SVGSVGElement;
}
