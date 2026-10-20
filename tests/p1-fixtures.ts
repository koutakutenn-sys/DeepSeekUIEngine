export const lineChart = {
  id: 'trend-1', type: 'line_chart', title: '每周趋势', unit: '次',
  series: [{ key: 'alpha', label: '方案 A' }, { key: 'beta', label: '方案 B' }],
  items: [
    { label: '周一', values: { alpha: 10, beta: 8 } },
    { label: '周二', values: { alpha: 15, beta: null } },
    { label: '周三', values: { alpha: 12, beta: 9 } },
  ],
};
export const pieChart = {
  id: 'pie-1', type: 'pie_chart', title: '渠道占比', variant: 'donut',
  items: [{ label: '自然访问', value: 60 }, { label: '推荐访问', value: 40 }],
};
export const scatterChart = {
  id: 'scatter-1', type: 'scatter_chart', title: '实验坐标', xLabel: '时间', yLabel: '偏差', xUnit: '秒',
  items: [{ label: '样本 A', x: -3, y: 4 }, { label: '样本 B', x: 2, y: -1 }],
};
export const progress = { id: 'progress-1', type: 'progress', title: '完成进度', value: 72.5, label: '开发进度', description: '按已完成工作统计' };
export const infoCard = { id: 'info-1', type: 'info_card', title: '说明', description: '只展示当前对话提供的信息。', tone: 'info' };
export const comparison = {
  id: 'comparison-1', type: 'comparison', title: '方案对比',
  items: [
    { label: '本地方案', description: '离线处理', features: ['无需网络', '数据留在本地'], highlight: true },
    { label: '备用方案', description: '按实际条件选择', features: ['保持原有流程'] },
  ],
};
export const tabs = {
  id: 'tabs-1', type: 'tabs', title: '数据与摘要', defaultTab: 'trend',
  items: [{ id: 'trend', label: '趋势', blocks: [lineChart] }, { id: 'summary', label: '摘要', blocks: [infoCard, progress] }],
};
export const accordion = {
  id: 'accordion-1', type: 'accordion', title: '更多详情', defaultOpen: ['options'],
  items: [{ id: 'options', label: '对比方案', blocks: [comparison] }, { id: 'points', label: '坐标明细', blocks: [scatterChart] }],
};
export const p1Blocks = [lineChart, pieChart, scatterChart, tabs, accordion, progress, infoCard, comparison];
