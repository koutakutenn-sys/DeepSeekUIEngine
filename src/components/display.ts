const formatNumber = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 15 });

export function display(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return formatNumber.format(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value;
}
