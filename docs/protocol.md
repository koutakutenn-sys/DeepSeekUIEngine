# DSUI v1 协议

在正常 Markdown 回答之外输出一个语言名为 `dsui` 的代码块。内容必须是纯 JSON：

```dsui
{
  "protocol": "dsui",
  "version": 1,
  "blocks": [
    {
      "id": "chart-1",
      "type": "bar_chart",
      "title": "模型性能对比",
      "items": [{ "label": "A", "value": 77 }, { "label": "B", "value": 74 }]
    }
  ]
}
```

这里的数值仅用于说明协议。实际回答必须使用用户提供或可核实的数据。

渲染器也接受标记为 `json` 的代码块，前提是内容完整通过同一个 DSUI schema，包含正确的 `protocol` 和 `version`。普通 JSON、未完成流或不支持的协议仍保留原文。

## 通用字段与限制

- 顶层只允许 `protocol`、`version`、`blocks`，固定为 `dsui`、`1`、1–3 个区块。
- 每个区块必须有 `id`、`type`、`title`。`id` 是 1–64 位字母、数字、下划线或连字符；同一回复内包括容器子区块在内均不得重复。标题为 1–160 字符。
- 类型及子对象均不接受额外字段。所有数字必须有限，不接受 `NaN`、`Infinity` 或字符串冒充数字。
- 一条回复的多个代码块合计也最多三个顶层区块。包含容器与子区块在内，整条回复最多 12 个区块、最多 3 个函数图；未打开的面板内容同样计入。按出现顺序接收完整代码块，若某代码块会超限或 ID 冲突，整块保留原文，不局部截断。
- 一个 JSON 源最多 100,000 个 UTF-16 代码单元；无效或未完成的 JSON 原样保留。
- 所有展示文本拒绝 Unicode 双向/不可见格式控制字符及危险 C0/C1 控制字符；保留用于正常拼写和 emoji 的 ZWNJ/ZWJ（U+200C/U+200D），以及完整合法的 RGI 地区旗帜 tag 序列（英格兰、苏格兰、威尔士），孤立、截断或非法的 tag 序列仍拒绝。不做静默剥离或规范化。标题、标签、单位和指标短文本须单行；描述及表格文本可包含换行、回车和制表符。校验失败时整个代码块保留原文，ARIA 使用同一份已校验文本。
- `src/protocol.ts` 的 Zod schema 是运行时的定义，构建时生成标准 JSON Schema 到 `dist/dsui.schema.json`。ID 与键唯一性、行列/序列对应关系、面板初始状态、函数参数和数字间的范围关系另由运行时检查；跨代码块的共享限制还由渲染引擎检查。

## metric_grid

```json
{
  "id": "metrics-1", "type": "metric_grid", "title": "本月概览",
  "items": [{ "label": "活跃用户", "value": 1280, "unit": "人", "change": "+12%" }]
}
```

1–12 项。`label` 为 1–160 字符，`value` 为有限数字或不超过 160 字符的文本。可选的 `unit` 最多 40 字符，`change` 最多 80 字符。变化文本不自动推断为好坏或事实。

当前开发分支新增每项可选的 `color`，只接受 `#RGB` 或 `#RRGGBB`，如 `"color":"#208568"`。它仅改变该项数值及侧边强调线，不改变标题、单位、卡片背景或其他项；省略时保持原主题。拒绝任意 CSS、颜色函数、透明度色值、URL 和额外样式字段。配色仍须配合可读的文字，不能仅靠颜色表达结论。

## svg（静态示意图）

v0.3.3 支持模型提供 SVG 字符串：

```json
{
  "id": "svg-1", "type": "svg", "title": "步骤示意",
  "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 320 120\"><rect x=\"10\" y=\"20\" width=\"300\" height=\"80\" rx=\"12\" fill=\"#4d6bfe\"/><text x=\"160\" y=\"65\" text-anchor=\"middle\" fill=\"#fff\">示意图</text></svg>"
}
```

SVG 是叶区块，也可放在 tabs/accordion 内；仍计入原有区块预算。字符串最长 20,000 个 UTF-16 代码单元，可换行；先解析 detached XML，再用 DOMPurify 清洗，最终只挂载通过检查的原生 SVG 节点，不经过 HTML 字符串插入。

- 根节点必须为 SVG 命名空间的 `svg`，必须有 `viewBox`；四个数均有限，绝对值不超过 1,000,000，宽高至少 0.001。扩展接管根宽高、比例及裁剪，响应容器宽度，显示高度最多 640px。
- 允许 `svg/g/defs/path/rect/circle/ellipse/line/polyline/polygon/text/tspan/title/desc/linearGradient/radialGradient/stop/clipPath/marker`。不支持嵌套 SVG、过滤器、动画或交互。
- 原始及清洗后的树都最多 500 个元素、16 层深度。几何数值有界，标量属性只接受单个数值，文字的 x/y/dx/dy 可为数值列表；字体大小不超过 256，渐变坐标和 stop offset 可用 0–100%。路径/点列最多 2,000 个数值。路径须从 M/m 开始，命令带完整参数组，圆弧的两个标志分别写作 0 或 1。XML 声明、DTD 和实体声明不接受；数值字符实体解码后的文字也受原有 Unicode 规则约束。
- 只接受固定几何及展示属性；文字、描边、填充和渐变可以使用合法色值。`style`、事件、链接、外部图片和字体均不接受；普通文本字段继续按文本处理。
- 渐变、裁剪和箭头标记可用 `url(#id)` 引用本图对应定义，ID 以字母开头，只含字母数字、下划线及横线，最多 64 字符。重复、缺失、类型错误或循环引用均失败；所有 ID 和引用在挂载前获得每图独立前缀，避免跨区块串用。
- `marker-*` 的非 none 引用只允许写在 defs/资源容器之外的 path/line/polyline/polygon 上，该几何元素也不能包含 marker 定义；不允许在根或分组继承箭头。defs/渐变/裁剪/标记内部不能引用 marker 或 clipPath，避免无环嵌套同样放大绘制量；标记内部仍可用渐变填充。
- DOMPurify 清除不支持的元素/属性，包括 `script/foreignObject/image/use/a/style` 等。清洗后未通过白名单、参数或资源边界校验时，整个原始 JSON 代码块恢复原文，不保留同块中部分增强视图；扩展不保证对所有 SVG 视觉效果进行语义纠错。

完整白名单在 [SVG 校验实现](../src/svg/sanitize-svg.ts)。本功能不为模型提供 HTML、JavaScript、任意 CSS、外部资源加载或自动动作能力；需要这些能力的原始 SVG 不属于此静态子集。

## bar_chart

1–30 项，每项仅含 `label`（1–160 字符）、`value`（有限数字），允许负数与零。区块可以有不超过 40 字符的 `unit`。重复标签按数据顺序展示，不合并、不改写数值。

## data_table

```json
{
  "id": "table-1", "type": "data_table", "title": "对比详情",
  "columns": [{ "key": "name", "label": "名称" }, { "key": "score", "label": "得分" }],
  "rows": [{ "name": "A", "score": 77 }, { "name": "B", "score": 74 }]
}
```

1–12 列、0–50 行。列键须唯一，以英文字母开头，仅含字母数字下划线，最多 40 字符；禁止 `constructor`、`prototype` 等危险键。列标题为 1–160 字符。行键必须属于声明的列，允许缺少某个单元格，以破折号显示。

单元格只接受最多 500 字符的文本、有限数字、布尔或 `null`。数值按数值排序，其他值按文本排序，空值始终排在末尾；排序不修改模型的源数据。

## timeline

```json
{
  "id": "timeline-1", "type": "timeline", "title": "项目计划",
  "items": [
    { "date": "第 1 周", "title": "调研", "description": "整理需求", "status": "done" },
    { "date": "第 2 周", "title": "开发", "status": "active" }
  ]
}
```

1–30 项。`date` 和 `title` 为 1–160 字符；日期是展示文本，不强制为 ISO 日期。可选的 `description` 最多 2000 字符；`status` 仅接受 `done`、`active`、`pending`，省略时显示“待开始”。按输入顺序展示，不自动改写日期或进度。

## function_plot

支持兼容预设 `quadratic`（`y = ax² + bx + c`）以及下文的 `expression` 数学表达式模式。禁止模型传入样式、颜色、事件、URL 或采样点。两种模式均使用 function-plot 渲染。

```dsui
{
  "protocol": "dsui", "version": 1,
  "blocks": [{
    "id": "quadratic-1", "type": "function_plot", "title": "二次函数参数实验", "preset": "quadratic",
    "parameters": [
      { "key": "a", "label": "a", "value": 1, "min": -5, "max": 5, "step": 0.1 },
      { "key": "b", "label": "b", "value": 0, "min": -10, "max": 10, "step": 0.5 },
      { "key": "c", "label": "c", "value": 0, "min": -10, "max": 10, "step": 0.5 }
    ],
    "viewport": { "xMin": -8, "xMax": 8, "yMin": -8, "yMax": 8 }
  }]
}
```

参数必须恰好包含 `a`、`b`、`c` 各一次，每项只有 `key/label/value/min/max/step`；`label` 为 1–160 字符。所有数字有限，`value/min/max` 绝对值不超过 10,000，`min ≤ value ≤ max`，`max - min ≥ 0.000001`；`step` 在 0.000001–20,000 之间。滑块增减与吸附采用 decimal.js 十进制运算后转换为绘图库使用的数值。默认值无需与步长对齐，初次显示和复位保留精确默认值；鼠标/触屏滑动按步长吸附，键盘方向键增减一个步长、PageUp/PageDown 增减十步、Home/End 取端点。

视口只接受 `xMin/xMax/yMin/yMax`，绝对值不超过 1,000,000；各轴跨度在 0.001–1,000,000 之间。交互也限制到这些边界。每次绘制设置 256–1,024 个采样边界点，由 function-plot 的区间采样器计算，刻度由 D3 生成；与柱状图的 30 点限制无关。曲线超出视口时裁剪，无可见曲线时显示提示。

坐标很大而视口跨度很小时，刻度使用共同偏移量，并在图下明确显示换算关系，避免相邻坐标被四舍五入为相同文字。

`a=0` 时显示直线，`a=b=0` 时显示水平线。公式和曲线描述同步参数更新，不发送消息、不修改历史、不发起网络请求。拖动画布平移，滚轮或双指缩放；方向键平移、+/− 缩放、Home 复位视口，也可使用按钮。“复位参数”和“复位视口”分别恢复模型给定默认值。

沿用 DSUI v1 和三块限制。旧客户端不识别此类型时显示原始代码块。已经启用 UI 的旧会话可在新会话重新启用，以获得包含函数图的格式说明；扩展不会自动改写历史中的说明。

## 安全回退

P1 的容器也遵循相同回退规则：无效子区块使整个 JSON 代码块保留原文，不丢弃字段后部分渲染。旧客户端不认识新增类型时，同样保留整个原始代码块。

不执行 HTML 或 JavaScript，不对文本中的链接做自动导航。普通文本不作为标记解析；只有 svg 区块的 svg 字段经过独立 XML/DOMPurify/静态白名单处理。每个代码块整体校验后才渲染；原始 DOM 留在页面，切换 Off、JSON 继续变化为非法值、组件异常或扩展卸载清理时恢复原文。Shadow DOM 隔离样式，颜色仅开放已声明的指标色值及静态 SVG 展示属性，不接受任意 CSS、HTML 或事件处理器。

### 通用初等函数表达式

`preset: "expression"` 通过 [mauriciopoppe/function-plot](https://github.com/mauriciopoppe/function-plot) 1.26.0 绘制显式实函数 `y = f(x)`：

```dsui
{
  "protocol": "dsui", "version": 1,
  "blocks": [{
    "id": "sine-1", "type": "function_plot", "title": "正弦函数", "preset": "expression",
    "expression": "a*sin(x)+b",
    "parameters": [
      { "key": "a", "label": "振幅 a", "value": 1, "min": -5, "max": 5, "step": 0.1 },
      { "key": "b", "label": "偏移 b", "value": 0, "min": -5, "max": 5, "step": 0.1 }
    ],
    "viewport": { "xMin": -8, "xMax": 8, "yMin": -6, "yMax": 6 }
  }]
}
```

- `expression` 为 1–256 字符，最多 64 个 AST 节点，深度不超过 16。变量只有 `x`、常数 `pi/e` 和已声明参数。
- `parameters` 必填，无参数时为 `[]`；最多六个，键仅 `a/b/c/d/p/q`，不得重复；数值、滑块、视口上限沿用上文。
- 运算：`+ - * / ^`、一元正负号及括号；乘法建议显式写 `*`，幂使用 `^`。`-x^2` 表示 `-(x^2)`。
- 单参数函数：`sin/cos/tan/asin/acos/atan/sinh/cosh/tanh/exp/log/ln/log10/log2/sqrt/cbrt/abs`。`log/ln` 是自然对数，所有角度均为弧度。负数实立方根使用 `cbrt(x)`；分数幂遵循非负实底数约定。
- 拒绝赋值、对象访问、数组、条件/比较表达式、函数定义、单位、任意函数调用和 JavaScript；未知语法使整个代码块回退原文。JSON Schema 只能描述结构，表达式白名单和复杂度还须通过运行时检查。
- mathjs 解析 AST，受限适配层把 AST 转为可信数值/区间回调。`function-plot` 负责区间采样、SVG、坐标轴和 D3 缩放/拖动。构建将上游未使用的动态字符串编译器替换为拒绝入口，不启用 `eval`、`Function`、远程脚本或新权限。
- 当前只开放单条显式实函数；隐函数、参数曲线、极坐标、分段条件式、复数和符号求导不在本次范围内。固定采样有分辨率限制，不能保证极高频振荡或所有病态函数的数学完整性。

32 个初等函数案例与断点检查见[函数图库迁移验证](FUNCTION_PLOT_VALIDATION.md)。

### LaTeX 函数定义（v0.3.3）

两种函数图预设都可增加可选的 `latex` 字段，用于函数定义的数学排版。例如，在上面的 expression 区块中使用：

```json
{
  "expression": "a*sin(x)/sqrt(x^2+1)",
  "latex": "y=a\\frac{\\sin x}{\\sqrt{x^2+1}}"
}
```

这里仅展示需要添加/替换的字段；完整区块仍须包含 `id/type/title/preset/parameters/viewport`。`latex` 为 1–1024 字符的非空单行数学内容，不带 `$`、`$$` 或 `\[` 定界符；JSON 中的反斜杠必须写作 `\\`。沿用展示文本的 Unicode 控制字符限制。

`latex` 只显示函数定义，不参与求值或转换成计算代码。模型应保持它与 `expression`（或 quadratic 预设）一致；滑块改变计算参数，LaTeX 定义保留参数符号，当前数值在滑块旁显示。未提供 `latex` 时保留原有显示，包括二次函数随参数更新的普通公式。

公式使用本地 KaTeX 生成原生 MathML，不加载外部脚本、样式或字体。禁止链接、图像、HTML 扩展、颜色/样式及自定义宏；限制展开次数和尺寸。合法字符串中的 TeX 语法错误或不支持的命令只让公式回退普通文本，曲线和滑块继续工作；字段类型、长度或控制字符不合法时，仍按协议将整个代码块回退原文。

## P1 新增组件（v0.3）

以下能力在 v0.3 中新增，仍使用 DSUI v1。以下单区块示例需要放入顶层 `blocks` 数组；示例数字仅用于说明结构，不得当作真实数据。

新图表均支持 0–30 个数据点，数字绝对值不得超过 `1e12`；饼图还要求非负。空数据正常展示空态，不会补造样本。所有图表都有可展开的原始数据表、键盘支持和跟随页面的深浅色。

原始数据表保留可往返的数字文本，极小数值可能采用科学计数法。数值轴范围极小时使用端点刻度，避免自动刻度下溢；不修改原始数据或扩大坐标范围来合并不同值。

### line_chart

```json
{
  "id": "line-1", "type": "line_chart", "title": "趋势", "unit": "次",
  "series": [{ "key": "a", "label": "方案 A" }, { "key": "b", "label": "方案 B" }],
  "items": [
    { "label": "周一", "values": { "a": 10, "b": 8 } },
    { "label": "周二", "values": { "a": 15, "b": null } },
    { "label": "周三", "values": { "a": 12, "b": 9 } }
  ]
}
```

`series` 必须有 1–6 个序列；`key` 沿用表格的安全键规则且不可重复，`label` 为 1–160 字符。每一行的 `values` 键必须与声明序列完全一致，不允许缺失键或额外键；明确缺失的值写 `null`，显示为“—”，折线在此断开，不跨越缺失点连线。横轴按输入标签顺序展示，不自动排序。`unit` 可选，最多 40 字符；不做单位换算。

### pie_chart

```json
{
  "id": "pie-1", "type": "pie_chart", "title": "渠道", "variant": "donut",
  "items": [{ "label": "自然访问", "value": 60 }, { "label": "推荐访问", "value": 40 }]
}
```

`items` 每项只有 `label`（1–160 字符）与非负的 `value`。`variant` 可选，仅 `pie` / `donut`，省略为饼图；`unit` 可选、最多 40 字符。全零或空数组显示“暂无正数数据”，原始零值仍可查看。不会将零值自动改成平均份额；图形表示原数值的相对份额，不宣称这些数值是百分比。

### scatter_chart

```json
{
  "id": "scatter-1", "type": "scatter_chart", "title": "实验坐标",
  "xLabel": "时间", "yLabel": "偏差", "xUnit": "秒",
  "items": [{ "label": "样本 A", "x": -3, "y": 4 }, { "label": "样本 B", "x": 2, "y": -1 }]
}
```

`x/y` 必须是有限数字，允许负数与零，不接受 `null`；点的 `label` 可选，为 1–160 字符。`xLabel/yLabel` 可选、同为 1–160 字符，省略时为 X/Y；`xUnit/yUnit` 可选、最多 40 字符。坐标轴按数字值定位，不将数值当分类标签，不自动连线或推断相关性。

### progress

```json
{
  "id": "progress-1", "type": "progress", "title": "开发进度",
  "value": 72.5, "label": "已完成", "description": "按已完成工作统计"
}
```

`value` 必须为 0–100 的有限数字，直接表示百分比；不截断错误值、不自动计算完成度。`label` 可选、1–160 字符，省略时使用标题；`description` 可选、最多 2000 字符。使用原生进度条并保留可见百分比。

### info_card

```json
{
  "id": "info-1", "type": "info_card", "title": "说明",
  "description": "仅展示用户提供的信息。", "tone": "info"
}
```

`description` 必填，为 1–2000 字符的纯文本，保留换行；不会解析 Markdown、HTML 或链接。`tone` 可选，只能是 `neutral`（默认）、`info`、`success`、`warning`，仅影响预设外观，不代表扩展确认了内容的真实性。

### comparison

```json
{
  "id": "comparison-1", "type": "comparison", "title": "方案对比",
  "items": [
    { "label": "本地方案", "description": "离线处理", "features": ["无需网络"], "highlight": true },
    { "label": "备用方案", "description": "保持现有流程", "features": ["按实际条件选择"] }
  ]
}
```

必须有 2–4 个方案。每项包含 1–160 字符的 `label` 和 1–2000 字符的 `description`；`features` 可选，最多 8 条，每条 1–160 字符；`highlight` 可选，只接受布尔值。内容为纯文本，不包含 URL、操作按钮或任意样式；突出边框仅表示输入要求突出显示，不表示扩展为方案背书。

### tabs

```json
{
  "id": "tabs-1", "type": "tabs", "title": "项目概览", "defaultTab": "note",
  "items": [
    { "id": "note", "label": "说明", "blocks": [
      { "id": "tab-note", "type": "info_card", "title": "说明", "description": "来自当前对话的说明。" }
    ] },
    { "id": "status", "label": "进度", "blocks": [
      { "id": "tab-progress", "type": "progress", "title": "进度", "value": 50 }
    ] }
  ]
}
```

`items` 为 1–6 个面板，每项必须有 `id`、`label`、`blocks`。面板 `id` 沿用区块 ID 格式，在当前容器内唯一；`label` 为 1–160 字符。每个面板有 1–3 个**非容器**区块，不能再次包含 `tabs` 或 `accordion`。各子区块的 ID 仍须在整条回复中唯一。`defaultTab` 可选，必须指向存在的面板，省略时选中第一项。

鼠标、触屏与键盘均可切换。左右方向键循环移动并选中，Home/End 选择首末项；Tab 进入选中面板。面板首次访问后保留组件状态，切换回来时不会丢失表格排序或函数图参数。相同有效 JSON 仅增加格式空白时保留状态；实际数据变化会重置为新数据的初始状态。

### accordion

```json
{
  "id": "accordion-1", "type": "accordion", "title": "详情", "defaultOpen": ["first"],
  "items": [
    { "id": "first", "label": "展开说明", "blocks": [
      { "id": "accordion-note", "type": "info_card", "title": "说明", "description": "可以展开或收起。" }
    ] },
    { "id": "second", "label": "更多进度", "blocks": [
      { "id": "accordion-progress", "type": "progress", "title": "进度", "value": 25 }
    ] }
  ]
}
```

`items` 的结构、数量和子区块限制与标签页相同。`defaultOpen` 可选，省略时全部收起；若传入，必须是唯一且存在的面板 ID 数组，最多 6 个。多个面板可独立展开；Enter/Space 切换展开状态，上下方向键与 Home/End 只移动标题按钮焦点。展开过的面板关闭后保留本地组件状态。

容器不包含用户动作、自动发消息、网络操作、任意递归或共享状态绑定。这些属于后续 Runtime 范围。
