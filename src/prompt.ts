export type Mode = 'off' | 'auto' | 'force';

export function isMode(value: unknown): value is Mode {
  return value === 'off' || value === 'auto' || value === 'force';
}

const guide = `保留正常文字回答，按需另附一个 dsui Markdown 代码块，JSON 为 {"protocol":"dsui","version":1,"blocks":[...]}。不得编造数据，不输出 HTML/JS；没有可靠数据就用文字说明。
最多3区块，id唯一、1-64位字母数字下划线或连字符，title为短标题。区块只能用以下字段：
metric_grid: {id,type:"metric_grid",title,items:[{label,value,unit?,change?}]}，最多12项，value为文本或有限数字，unit/change为文本。
bar_chart: {id,type:"bar_chart",title,unit?,items:[{label,value}]}，最多30点，value为有限数字。
data_table: {id,type:"data_table",title,columns:[{key,label}],rows:[{key:值}]}，最多12列50行；key以英文字母开头，仅含字母数字下划线，最多40字符；值为文本、数字、布尔或null，不嵌套。
timeline: {id,type:"timeline",title,items:[{date,title,description?,status?}]}，最多30项，status仅done/active/pending。
function_plot: {id,type:"function_plot",title,preset:"expression",expression:"a*sin(x)",parameters:[{key:"a",label:"振幅 a",value:1,min:-5,max:5,step:0.1}],viewport:{xMin:-8,xMax:8,yMin:-8,yMax:8}}。绘制实数 y=f(x)，expression最长256字符、最多64个语法节点、嵌套深度≤16。只用 x、常数 pi/e、已声明参数 a/b/c/d/p/q（最多6个，无参数时传[]），支持 + - * / ^、括号、sin/cos/tan/asin/acos/atan/sinh/cosh/tanh/exp/log/ln/log10/log2/sqrt/cbrt/abs，函数仅单参数；log/ln为自然对数，角度为弧度，负数立方根用cbrt(x)。不得传JS、赋值、对象、数组、条件表达式、样式、URL或采样点。兼容旧preset:"quadratic"（不传expression，parameters恰好a/b/c，表示a*x^2+b*x+c）。value/min/max绝对值≤10000，min≤value≤max，max-min≥0.000001，step在0.000001至20000之间；视口边界绝对值≤1000000，各轴跨度0.001至1000000；滑块由浏览器本地重绘。
title/label/date不超过160字符，表格文本值不超过500字符，description不超过2000字符。不添加额外字段。`;

function suffix(mode: Exclude<Mode, 'off'>): string {
  return `\n\n<!-- DSUI:v1 -->\n${mode === 'auto' ? '仅在适合可视化时附加UI；普通聊天只用文字。' : '优先使用合适的富UI，无法可靠表达时回退文字。'}\n${guide}\n<!-- /DSUI -->`;
}

export function stripPrompt(text: string): string {
  for (const mode of ['auto', 'force'] as const) {
    const ending = suffix(mode);
    if (text.endsWith(ending)) return text.slice(0, -ending.length);
  }
  return text;
}

export function appendPrompt(text: string, mode: Mode): string {
  const original = stripPrompt(text);
  if (mode === 'off' || !original.trim()) return original;
  return original + suffix(mode);
}

export function createEnablePrompt(mode: Exclude<Mode, 'off'>): string {
  return appendPrompt('请为当前会话启用 UI 功能。后续回答遵循下面的格式约定；本条只需简短确认，无需生成示例或虚构数据。', mode);
}
