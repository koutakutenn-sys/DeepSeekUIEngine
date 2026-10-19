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
- 每个区块必须有 `id`、`type`、`title`。`id` 是 1–64 位字母、数字、下划线或连字符；同一回复不得重复。标题为 1–160 字符。
- 类型及子对象均不接受额外字段。所有数字必须有限，不接受 `NaN`、`Infinity` 或字符串冒充数字。
- 一条回复的多个代码块合计也最多三个区块。按出现顺序接收完整代码块，若某代码块会超限或 ID 冲突，整块保留原文，不局部截断。
- 一个 JSON 源最多 100,000 个 UTF-16 代码单元；无效或未完成的 JSON 原样保留。
- `src/protocol.ts` 的 Zod schema 是运行时的定义，构建时生成标准 JSON Schema 到 `dist/dsui.schema.json`。ID 唯一性、列键唯一性、行列对应关系、函数参数键唯一性和数字间的范围关系另由运行时检查。

## metric_grid

```json
{
  "id": "metrics-1", "type": "metric_grid", "title": "本月概览",
  "items": [{ "label": "活跃用户", "value": 1280, "unit": "人", "change": "+12%" }]
}
```

1–12 项。`label` 为 1–160 字符，`value` 为有限数字或不超过 160 字符的文本。可选的 `unit` 最多 40 字符，`change` 最多 80 字符。变化文本不自动推断为好坏或事实。

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

不解析或执行 HTML，不执行 JavaScript，不对文本中的链接做自动导航。每个代码块整体校验后才渲染；原始 DOM 留在页面，切换 Off、JSON 继续变化为非法值、组件异常或扩展卸载清理时恢复原文。Shadow DOM 隔离样式，模型不能传入自定义颜色、样式、HTML 或事件处理器。

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
