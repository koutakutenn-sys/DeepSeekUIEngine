import { z } from 'zod';

const shortText = z.string().min(1).max(160);
const text = z.string().max(2000);
const number = z.number().finite();
const cell = z.union([z.string().max(500), number, z.boolean(), z.null()]);
const safeKey = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/)
  .refine((key) => !['__proto__', 'prototype', 'constructor'].includes(key));
const base = { id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), title: shortText };

const metricSchema = z.strictObject({
  ...base, type: z.literal('metric_grid'),
  items: z.array(z.strictObject({
    label: shortText, value: z.union([z.string().max(160), number]),
    unit: z.string().max(40).optional(), change: z.string().max(80).optional(),
  })).min(1).max(12),
});
const chartSchema = z.strictObject({
  ...base, type: z.literal('bar_chart'), unit: z.string().max(40).optional(),
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
  key: z.enum(['a', 'b', 'c']), label: shortText,
  value: coefficient, min: coefficient, max: coefficient,
  step: number.min(PLOT_LIMITS.minStep).max(2 * PLOT_LIMITS.coefficient),
}).refine((p) => p.max - p.min >= PLOT_LIMITS.minStep && p.min <= p.value && p.value <= p.max,
  { message: 'Slider value must be inside a nonempty bounded range' });
const viewportSchema = z.strictObject({ xMin: coordinate, xMax: coordinate, yMin: coordinate, yMax: coordinate })
  .refine((v) => [v.xMax - v.xMin, v.yMax - v.yMin].every((span) => span >= PLOT_LIMITS.minSpan && span <= PLOT_LIMITS.maxSpan),
    { message: 'Viewport spans must be between 0.001 and 1000000' });
const functionPlotSchema = z.strictObject({
  ...base, type: z.literal('function_plot'), preset: z.literal('quadratic'),
  parameters: z.array(plotParameter).length(3).refine((p) => new Set(p.map((entry) => entry.key)).size === 3,
    { message: 'Parameters must contain exactly a, b and c' }),
  viewport: viewportSchema,
});

export const payloadSchema = z.strictObject({
  protocol: z.literal('dsui'), version: z.literal(1),
  blocks: z.array(z.discriminatedUnion('type', [metricSchema, chartSchema, tableSchema, timelineSchema, functionPlotSchema])).min(1).max(3),
}).refine((value) => new Set(value.blocks.map((block) => block.id)).size === value.blocks.length,
  { message: 'Block IDs must be unique' });

export type Payload = z.infer<typeof payloadSchema>;
export type Block = Payload['blocks'][number];
export type FunctionPlotBlock = Extract<Block, { type: 'function_plot' }>;

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
