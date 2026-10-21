export type Mode = 'off' | 'auto' | 'force';

export function isMode(value: unknown): value is Mode {
  return value === 'off' || value === 'auto' || value === 'force';
}

const functionPlotExample = { protocol: 'dsui', version: 1, blocks: [{
  id: 'sine-example', type: 'function_plot', title: '正弦函数示例', preset: 'expression',
  expression: 'a*sin(x)', latex: String.raw`y=a\sin x`,
  parameters: [{ key: 'a', label: '振幅 a', value: 1, min: -5, max: 5, step: 0.1 }],
  viewport: { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
}] };

const svgExample = { protocol: 'dsui', version: 1, blocks: [{ id: 'svg-example', type: 'svg', title: '流程示意图',
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><defs><linearGradient id="paint" x2="100%"><stop offset="0%" stop-color="#4d6bfe"/><stop offset="100%" stop-color="#208568"/></linearGradient><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="currentColor"/></marker></defs><rect x="10" y="30" width="100" height="60" rx="10" fill="url(#paint)"/><text x="60" y="65" text-anchor="middle" fill="#fff">开始</text><path d="M120 60 L200 60" stroke="currentColor" stroke-width="2" marker-end="url(#arrow)"/><rect x="210" y="30" width="100" height="60" rx="10" fill="url(#paint)"/><text x="260" y="65" text-anchor="middle" fill="#fff">结束</text></svg>',
}] };

const guide = String.raw`保留正常文字回答，按需另附一个 dsui Markdown 代码块，JSON 为 {"protocol":"dsui","version":1,"blocks":[...]}。不得编造数据，不输出 HTML/JS；静态SVG只能放入下面svg区块的svg字段。没有可靠数据就用文字说明。
同一回答（包括多个代码块）最多3个顶层区块、12个总区块（含容器和全部子区块）、3个function_plot；全部区块id全局唯一，id为1-64位字母数字下划线或连字符，title为短标题。每个JSON代码块不超过100000字符。区块只能用以下字段：
metric_grid: {id,type:"metric_grid",title,items:[{label,value,unit?,change?,color?}]}，最多12项，value为文本或有限数字，unit/change为文本。每项可选color，只接受#RGB或#RRGGBB十六进制色值，如"#208568"；仅改变该项数值与强调线，不接受任意CSS、颜色函数或背景配置。省略时沿用主题。
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
function_plot: {id,type:"function_plot",title,preset:"expression",expression:"a*sin(x)",latex:"y=a\\sin x",parameters:[{key:"a",label:"振幅 a",value:1,min:-5,max:5,step:0.1}],viewport:{xMin:-8,xMax:8,yMin:-8,yMax:8}}。绘制实数 y=f(x)，expression最长256字符、最多64个语法节点、嵌套深度≤16。只用 x、常数 pi/e、已声明参数 a/b/c/d/p/q（最多6个，无参数时传[]），支持 + - * / ^、括号、sin/cos/tan/asin/acos/atan/sinh/cosh/tanh/exp/log/ln/log10/log2/sqrt/cbrt/abs，函数仅单参数；log/ln为自然对数，角度为弧度，负数立方根用cbrt(x)。不得传JS、赋值、对象、数组、条件表达式、样式、URL或采样点。兼容旧preset:"quadratic"（不传expression，parameters恰好a/b/c，表示a*x^2+b*x+c）。value/min/max绝对值≤10000，min≤value≤max，max-min≥0.000001，step在0.000001至20000之间；视口边界绝对值≤1000000，各轴跨度0.001至1000000；滑块由浏览器本地重绘。
function_plot默认同时提供latex排版函数定义；两种preset都支持，字段可省略仅用于兼容旧数据或无法正确排版时回退。latex为1-1024字符的非空单行LaTeX数学内容，不带$或其他定界符；必须与实际函数一致，参数保留符号形式。它只用于显示，计算仍使用expression或quadratic及滑块当前值；不要在expression中写LaTeX。仅数学排版，禁止链接、图像、HTML、颜色/样式、宏定义和外部资源。LaTeX解析失败时显示普通函数定义。
function_plot完整JSON示例：${JSON.stringify(functionPlotExample)}
svg: {id,type:"svg",title,svg:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 320 160\">...</svg>"}，仅静态示意图，SVG字段最长20000字符、最多500个元素、嵌套深度≤16。可放tabs/accordion内。只用svg/g/defs/path/rect/circle/ellipse/line/polyline/polygon/text/tspan/title/desc/linearGradient/radialGradient/stop/clipPath/marker；根必须有viewBox，4个有限数字，各维跨度≥0.001，坐标绝对值≤1000000。几何数值无单位，渐变坐标及stop offset可用0-100%；font-size≤256。颜色用十六进制、标准色名、none或currentColor；fill/stroke、clip-path、marker-*只可通过url(#本图id)引用本图渐变/裁剪/标记。id以字母开头，仅字母数字下划线横线，最多64字符，不重复；禁止循环引用。禁止script、foreignObject、image、use、a、style、动画、filter、事件、href、CSS、字体/图片等外部资源；xmlns标准命名空间和本图url(#id)不是外部资源。扩展会清洗SVG并限制显示范围，非法或超限图形回退原始DSUI。不要把HTML或SVG混入其他文本字段。
svg完整JSON示例：${JSON.stringify(svgExample)}
title/label/date及features的文本不超过160字符，表格文本值不超过500字符，description不超过2000字符，unit/xUnit/yUnit不超过40字符。标题/标签/单位等短文本必须单行，说明、表格文本和SVG可换行；不得含双向、不可见格式或危险控制字符，正常emoji和拼写用的ZWJ/ZWNJ连接符除外。key不得为__proto__/prototype/constructor。不添加额外字段、HTML、JS、任意CSS、外部URL、事件、网络请求或跨区块共享状态。`;

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
