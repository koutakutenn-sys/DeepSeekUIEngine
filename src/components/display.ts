const formatNumber = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 15 });

export function display(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return formatNumber.format(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  return '—';
}
