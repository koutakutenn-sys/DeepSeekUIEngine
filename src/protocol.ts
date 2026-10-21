import { z } from 'zod';
import { validateExpression } from './math/plot-expression.ts';

z.config({ jitless: true });

// Keep legitimate emoji/Persian joiners; reject other hidden format controls and unsafe C0/C1 controls.
const unsafeText = /(?:(?![\u200c\u200d])\p{Cf})|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
// Unicode RGI_Emoji_Tag_Sequence has exactly three members (England, Scotland, Wales); their subdivision
// letters are Cf tag characters. Only these exact, complete sequences are exempted from the Cf scan below.
const rgiSubdivisionFlag = /\u{1F3F4}\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F}/gu;
// Strip those whole sequences only for the check; the validated payload is never rewritten or normalized.
const hasUnsafeText = (value: string) => unsafeText.test(value.replace(rgiSubdivisionFlag, ''));
const lineBreak = /[\r\n\t\u2028\u2029]/u;
const boundedText = (max: number, multiline = false) => z.string().max(max)
  .refine((value) => !hasUnsafeText(value) && (multiline || !lineBreak.test(value)), { message: 'Unsafe text controls or multiline label' });
const shortText = boundedText(160).min(1);
const text = boundedText(2000, true);
const number = z.number().finite();
const cell = z.union([boundedText(500, true), number, z.boolean(), z.null()]);
const safeKey = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/)
  .refine((key) => !['__proto__', 'prototype', 'constructor'].includes(key));
const base = { id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), title: shortText };

const metricSchema = z.strictObject({
  ...base, type: z.literal('metric_grid'),
  items: z.array(z.strictObject({
    label: shortText, value: z.union([boundedText(160), number]),
    unit: boundedText(40).optional(), change: boundedText(80).optional(),
  })).min(1).max(12),
});
const chartSchema = z.strictObject({
  ...base, type: z.literal('bar_chart'), unit: boundedText(40).optional(),
  items: z.array(z.strictObject({ label: shortText, value: number })).min(1).max(30),
});
const tableSchema = z.strictObject({
  ...base, type: z.literal('data_table'),
  columns: z.array(z.strictObject({ key: safeKey, label: shortText })).min(1).max(12),
  rows: z.array(z.record(safeKey, cell)).max(50),
}).superRefine((block, context) => {
  const keys = new Set(block.columns.map((column) => column.key));
  if (keys.size !== block.columns.length || block.rows.some((row) => Object.keys(row).some((key) => !keys.has(key)))) {
    context.addIssue({ code: 'custom', message: 'Table columns must be unique and match row keys' });
  }
});
const timelineSchema = z.strictObject({
  ...base, type: z.literal('timeline'),
  items: z.array(z.strictObject({
    date: shortText, title: shortText, description: text.optional(),
    status: z.enum(['done', 'active', 'pending']).optional(),
  })).min(1).max(30),
});

export const PLOT_LIMITS = { coefficient: 10_000, coordinate: 1_000_000, minSpan: 0.001, maxSpan: 1_000_000, minStep: 0.000001 } as const;
const coefficient = number.min(-PLOT_LIMITS.coefficient).max(PLOT_LIMITS.coefficient);
const coordinate = number.min(-PLOT_LIMITS.coordinate).max(PLOT_LIMITS.coordinate);
const plotParameter = z.strictObject({
  key: z.enum(['a', 'b', 'c', 'd', 'p', 'q']), label: shortText,
  value: coefficient, min: coefficient, max: coefficient,
  step: number.min(PLOT_LIMITS.minStep).max(2 * PLOT_LIMITS.coefficient),
}).refine((p) => p.max - p.min >= PLOT_LIMITS.minStep && p.min <= p.value && p.value <= p.max,
  { message: 'Slider value must be inside a nonempty bounded range' });
const viewportSchema = z.strictObject({ xMin: coordinate, xMax: coordinate, yMin: coordinate, yMax: coordinate })
  .refine((v) => [v.xMax - v.xMin, v.yMax - v.yMin].every((span) => span >= PLOT_LIMITS.minSpan && span <= PLOT_LIMITS.maxSpan),
    { message: 'Viewport spans must be between 0.001 and 1000000' });
const plotLatex = boundedText(1024).min(1).refine((value) => value.trim().length > 0, { message: 'Empty LaTeX definition' }).optional();
const quadraticPlotSchema = z.strictObject({
  ...base, type: z.literal('function_plot'), preset: z.literal('quadratic'),
  latex: plotLatex,
  parameters: z.array(plotParameter).length(3).refine((p) => new Set(p.map((entry) => entry.key)).size === 3 && p.every((entry) => ['a', 'b', 'c'].includes(entry.key)),
    { message: 'Parameters must contain exactly a, b and c' }),
  viewport: viewportSchema,
});
const expressionPlotSchema = z.strictObject({
  ...base, type: z.literal('function_plot'), preset: z.literal('expression'),
  expression: boundedText(256).min(1),
  latex: plotLatex,
  parameters: z.array(plotParameter).max(6).refine((p) => new Set(p.map((entry) => entry.key)).size === p.length,
    { message: 'Parameters must be unique' }),
  viewport: viewportSchema,
}).refine((block) => validateExpression(block.expression, block.parameters.map((p) => p.key)),
  { message: 'Unsupported or unsafe mathematical expression' });
const functionPlotSchema = z.discriminatedUnion('preset', [quadraticPlotSchema, expressionPlotSchema]);

const chartValue = number.min(-1e12).max(1e12);
const lineSchema = z.strictObject({
  ...base, type: z.literal('line_chart'), unit: boundedText(40).optional(),
  series: z.array(z.strictObject({ key: safeKey, label: shortText })).min(1).max(6),
  items: z.array(z.strictObject({ label: shortText, values: z.record(safeKey, chartValue.nullable()) })).max(30),
}).superRefine((block, context) => {
  const keys = new Set(block.series.map((series) => series.key));
  if (keys.size !== block.series.length || block.items.some((item) =>
    Object.keys(item.values).length !== keys.size || Object.keys(item.values).some((key) => !keys.has(key)))) {
    context.addIssue({ code: 'custom', message: 'Line series keys must be unique and exactly match every data row' });
  }
});
const pieSchema = z.strictObject({
  ...base, type: z.literal('pie_chart'), unit: boundedText(40).optional(),
  variant: z.enum(['pie', 'donut']).optional(),
  items: z.array(z.strictObject({ label: shortText, value: chartValue.min(0) })).max(30),
});
const scatterSchema = z.strictObject({
  ...base, type: z.literal('scatter_chart'),
  xLabel: shortText.optional(), yLabel: shortText.optional(),
  xUnit: boundedText(40).optional(), yUnit: boundedText(40).optional(),
  items: z.array(z.strictObject({ x: chartValue, y: chartValue, label: shortText.optional() })).max(30),
});
const progressSchema = z.strictObject({
  ...base, type: z.literal('progress'), value: number.min(0).max(100),
  label: shortText.optional(), description: text.optional(),
});
const infoSchema = z.strictObject({
  ...base, type: z.literal('info_card'), description: text.min(1),
  tone: z.enum(['neutral', 'info', 'success', 'warning']).optional(),
});
const comparisonSchema = z.strictObject({
  ...base, type: z.literal('comparison'),
  items: z.array(z.strictObject({
    label: shortText, description: text.min(1),
    features: z.array(shortText).max(8).optional(), highlight: z.boolean().optional(),
  })).min(2).max(4),
});
const leafBlockSchema = z.discriminatedUnion('type', [metricSchema, chartSchema, tableSchema, timelineSchema,
  functionPlotSchema, lineSchema, pieSchema, scatterSchema, progressSchema, infoSchema, comparisonSchema]);
const panelItems = z.array(z.strictObject({
  id: base.id, label: shortText, blocks: z.array(leafBlockSchema).min(1).max(3),
})).min(1).max(6).refine((items) => new Set(items.map((item) => item.id)).size === items.length,
  { message: 'Panel item IDs must be unique within their container' });
const tabsSchema = z.strictObject({
  ...base, type: z.literal('tabs'), items: panelItems, defaultTab: base.id.optional(),
}).refine((block) => block.defaultTab === undefined || block.items.some((item) => item.id === block.defaultTab),
  { message: 'Default tab must name an existing item' });
const accordionSchema = z.strictObject({
  ...base, type: z.literal('accordion'), items: panelItems, defaultOpen: z.array(base.id).max(6).optional(),
}).refine((block) => block.defaultOpen === undefined || (new Set(block.defaultOpen).size === block.defaultOpen.length
  && block.defaultOpen.every((id) => block.items.some((item) => item.id === id))),
{ message: 'Initially open accordion items must exist and be unique' });

const payloadBaseSchema = z.strictObject({
  protocol: z.literal('dsui'), version: z.literal(1),
  blocks: z.array(z.discriminatedUnion('type', [leafBlockSchema, tabsSchema, accordionSchema])).min(1).max(3),
});

export type Payload = z.infer<typeof payloadBaseSchema>;
export type Block = Payload['blocks'][number];
export type LeafBlock = z.infer<typeof leafBlockSchema>;
export type ContainerBlock = Extract<Block, { type: 'tabs' | 'accordion' }>;
export type FunctionPlotBlock = Extract<Block, { type: 'function_plot' }>;

/** Count all declared content, including unvisited panels, without recursive layouts. */
export function payloadBlocks(payload: Payload): Block[] {
  return payload.blocks.flatMap((block) => block.type === 'tabs' || block.type === 'accordion'
    ? [block, ...block.items.flatMap((item) => item.blocks)] : [block]);
}

export const payloadSchema = payloadBaseSchema.superRefine((value, context) => {
  const all = payloadBlocks(value);
  if (new Set(all.map((block) => block.id)).size !== all.length) {
    context.addIssue({ code: 'custom', message: 'Block IDs must be globally unique' });
  }
  if (all.length > 12 || all.filter((block) => block.type === 'function_plot').length > 3) {
    context.addIssue({ code: 'custom', message: 'Reply allows at most 12 total blocks and 3 function plots' });
  }
});

/** No evaluation, HTML parsing or network access. Incomplete streams remain untouched. */
export function parsePayload(source: string): Payload | null {
  if (source.length > 100_000) return null;
  try {
    const result = payloadSchema.safeParse(JSON.parse(source));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
