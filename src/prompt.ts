export type Mode = 'off' | 'auto' | 'force';

export function isMode(value: unknown): value is Mode {
  return value === 'off' || value === 'auto' || value === 'force';
}

const guide = String.raw`保留正常文字回答，按需另附一个 dsui Markdown 代码块，JSON 为 {"protocol":"dsui","version":1,"blocks":[...]}。不得编造数据，不输出 HTML/JS；没有可靠数据就用文字说明。
同一回答（包括多个代码块）最多3个顶层区块、12个总区块（含容器和全部子区块）、3个function_plot；全部区块id全局唯一，id为1-64位字母数字下划线或连字符，title为短标题。每个JSON代码块不超过100000字符。区块只能用以下字段：
metric_grid: {id,type:"metric_grid",title,items:[{label,value,unit?,change?}]}，最多12项，value为文本或有限数字，unit/change为文本。
bar_chart: {id,type:"bar_chart",title,unit?,items:[{label,value}]}，最多30点，value为有限数字。
data_table: {id,type:"data_table",title,columns:[{key,label}],rows:[{key:值}]}，最多12列50行；key以英文字母开头，仅含字母数字下划线，最多40字符；值为文本、数字、布尔或null，不嵌套。
timeline: {id,type:"timeline",title,items:[{date,title,description?,status?}]}，最多30项，status仅done/active/pending。
line_chart: {id,type:"line_chart",title,unit?,series:[{key,label}],items:[{label,values:{key:数值或null}}]}，1-6个系列，0-30点；系列key唯一且遵守表格key规则，每行values的键必须与全部系列key完全一致；null表示缺测断线，不补零、不跨过缺测连接。
pie_chart: {id,type:"pie_chart",title,unit?,variant?,items:[{label,value}]}，0-30项，value非负；variant仅pie/donut，省略为pie；全零或空数组显示无正数数据。
scatter_chart: {id,type:"scatter_chart",title,xLabel?,yLabel?,xUnit?,yUnit?,items:[{x,y,label?}]}，0-30点，x/y为真实坐标。以上三种新图表的数值绝对值≤1000000000000，均须有限，不编造采样点。
progress: {id,type:"progress",title,value,label?,description?}，value为0-100的有限数字，只展示已知进度。
info_card: {id,type:"info_card",title,description,tone?}，description非空，tone仅neutral/info/success/warning。
comparison: {id,type:"comparison",title,items:[{label,description,features?,highlight?}]}，2-4个方案，description非空，features为最多8个短文本，highlight为布尔值。
tabs: {id,type:"tabs",title,defaultTab?,items:[{id,label,blocks:[...]}]}；accordion: {id,type:"accordion",title,defaultOpen?,items:[{id,label,blocks:[...]}]}。两种容器各1-6项，项id在本容器内唯一；每项1-3个非容器区块，禁止嵌套tabs/accordion。defaultTab只能为已有项id，省略选第一项；defaultOpen为不重复的已有项id数组，省略全部关闭。交互仅浏览器本地切换，不带动作或绑定。
function_plot: {id,type:"function_plot",title,preset:"expression",expression:"a*sin(x)",parameters:[{key:"a",label:"振幅 a",value:1,min:-5,max:5,step:0.1}],viewport:{xMin:-8,xMax:8,yMin:-8,yMax:8}}。绘制实数 y=f(x)，expression最长256字符、最多64个语法节点、嵌套深度≤16。只用 x、常数 pi/e、已声明参数 a/b/c/d/p/q（最多6个，无参数时传[]），支持 + - * / ^、括号、sin/cos/tan/asin/acos/atan/sinh/cosh/tanh/exp/log/ln/log10/log2/sqrt/cbrt/abs，函数仅单参数；log/ln为自然对数，角度为弧度，负数立方根用cbrt(x)。不得传JS、赋值、对象、数组、条件表达式、样式、URL或采样点。兼容旧preset:"quadratic"（不传expression，parameters恰好a/b/c，表示a*x^2+b*x+c）。value/min/max绝对值≤10000，min≤value≤max，max-min≥0.000001，step在0.000001至20000之间；视口边界绝对值≤1000000，各轴跨度0.001至1000000；滑块由浏览器本地重绘。
function_plot两种preset均可选latex，建议用它排版函数定义，例如JSON字段 "latex":"y=a\\sin x"。latex为1-1024字符的非空单行LaTeX数学内容，不带$或其他定界符；必须与实际函数一致，参数保留符号形式。它只用于显示，计算仍使用expression或quadratic及滑块当前值；不要在expression中写LaTeX。仅数学排版，禁止链接、图像、HTML、颜色/样式、宏定义和外部资源。LaTeX解析失败时显示普通函数定义，省略时保留原显示。
title/label/date及features的文本不超过160字符，表格文本值不超过500字符，description不超过2000字符，unit/xUnit/yUnit不超过40字符。标题/标签/单位等短文本必须单行，说明和表格文本可换行；不得含双向、不可见格式或危险控制字符，正常emoji和拼写用的ZWJ/ZWNJ连接符除外。key不得为__proto__/prototype/constructor。不添加额外字段、HTML、JS、CSS、URL、事件、网络请求或跨区块共享状态。`;

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
