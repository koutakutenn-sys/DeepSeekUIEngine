export const metrics = {
  id: 'metrics-1', type: 'metric_grid', title: '本月概览',
  items: [{ label: '活跃用户', value: 1280, unit: '人', change: '+12%' },
    { label: '满意度', value: 98.4, unit: '%' }, { label: '平均响应', value: 1.8, unit: '秒' }],
};
export const chart = {
  id: 'chart-1', type: 'bar_chart', title: '模型性能对比',
  items: [{ label: 'A', value: 77 }, { label: 'B', value: 74 }],
};
export const table = {
  id: 'table-1', type: 'data_table', title: '对比详情',
  columns: [{ key: 'name', label: '名称' }, { key: 'score', label: '得分' }],
  rows: [{ name: 'B', score: 74 }, { name: 'A', score: 77 }, { name: 'C', score: null }],
};
export const timeline = {
  id: 'timeline-1', type: 'timeline', title: '项目计划',
  items: [{ date: '第 1 周', title: '调研', description: '整理需求与使用场景', status: 'done' },
    { date: '第 2 周', title: '开发', description: '实现首个版本', status: 'active' }],
};
export const quadratic = {
  id: 'quadratic-1', type: 'function_plot', title: '二次函数参数实验', preset: 'quadratic',
  parameters: [
    { key: 'a', label: 'a', value: 1, min: -5, max: 5, step: 0.1 },
    { key: 'b', label: 'b', value: 0, min: -10, max: 10, step: 0.5 },
    { key: 'c', label: 'c', value: 0, min: -10, max: 10, step: 0.5 },
  ],
  viewport: { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
};
export function payload(blocks: unknown[] = [chart]) {
  return JSON.stringify({ protocol: 'dsui', version: 1, blocks });
}
export function message(text = payload()) {
  const article = document.createElement('article');
  article.dataset.messageAuthorRole = 'assistant';
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.className = 'language-dsui';
  code.textContent = text;
  pre.append(code);
  article.append(pre);
  document.body.append(article);
  return { article, pre, code };
}
