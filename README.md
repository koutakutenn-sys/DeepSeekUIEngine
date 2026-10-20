# DeepSeek UI Engine

[简体中文](README.md) | [繁體中文（香港）](README.zh-HK.md) | [English](README.en.md)

为 DeepSeek 官方 Chat 网页原位添加指标卡片、柱状图、可排序表格、可展开时间轴和交互初等函数图的 Manifest V3 扩展。

更新记录：[changelog.txt](changelog.txt)。

## 构建与安装

需要 Node.js 22.18 或更新版本，以及 npm。

```powershell
npm install --ignore-scripts
npm run build
```

1. 在 Edge 打开 `edge://extensions`。
2. 打开“开发人员模式”，选择“加载解压缩的扩展”。
3. 选择项目内的 `dist` 目录。
4. 打开或刷新 <https://chat.deepseek.com/>，使用官方账号登录。
5. 点击扩展图标选择模式，默认 Auto。已有页面立即应用设置；扩展重新加载后请刷新聊天页面。

构建输出包含 `manifest.json`、独立的 `content.js`、弹窗及本地资源、`dsui.schema.json`。无需服务器、API 密钥或浏览器后台服务。

## 使用方式

在聊天输入框旁点击 **“启用 UI”**。扩展会通过官方输入框自动发送一条独立的格式说明，成功后按钮显示“UI 已启用”。每个会话只需启用一次，普通消息始终原样发送。

| 模式 | 点击“启用 UI” | 收到 DSUI 代码块 |
| --- | --- | --- |
| Off | 隐藏启用按钮 | 保留官方原文 |
| Auto（默认） | 发送按需呈现 UI 的说明 | 校验通过后原位渲染 |
| Force | 发送优先呈现 UI 的说明 | 校验通过后原位渲染 |

试着提供一组真实数据后发送：“用表格和柱状图比较这些数据”。模型是否遵循格式取决于它的回答，Force 也不能保证每条回复都有 UI。

每次回复最多三个顶层区块，图表最多 30 点，表格最多 50 行。标签页和折叠面板可包含一层基础组件；整条回复最多 12 个区块（含容器），函数图最多三个。普通文字不增加组件。数据表格点击列标题排序，时间轴点击条目展开；图表下有可访问的数据表，所有视图都能展开查看原始 DSUI。深浅色跟随页面，表格在窄屏可横向滚动。

函数图采用 [mauriciopoppe/function-plot](https://github.com/mauriciopoppe/function-plot) 1.26.0，支持多项式、分式、根式、指数、对数、三角及反三角函数等。可以要求“用 function_plot 的 expression 模式展示 y=a*sin(x)，提供振幅 a 滑块”。询问二次函数时也可要求“用 function_plot 展示 y=ax²+bx+c，并提供 a/b/c 滑块”。拖动滑块本地实时更新曲线和公式，`a=0` 自动退化为直线；拖动画布平移、滚轮/双指缩放，也可用按钮或键盘。参数与视口分别支持复位。函数图本地采样不受柱状图的 30 点限制，精确格式及安全上限见[协议说明](docs/protocol.md#function_plot)。旧会话中的格式说明不会自动更新，建议新建会话后点击“启用 UI”。

切换 Auto / Force 不会重发说明，也不会改写当前会话已发送的说明。标签页内按会话路径记忆启用状态，刷新时识别已加载用户历史中的协议标记，不持久保存会话或聊天内容。新会话需要重新点击启用；已有旧版协议说明的会话会显示“UI 已启用”。模型遗忘早期上下文时，可以新建会话重新引导。

有未发送草稿、正在输入法组合输入，或页面正在生成回复而没有可识别的发送动作时，启用按钮暂时禁用。请先发送或清空草稿，再点击启用。发送失败时只清除扩展自己填入且尚未消费的说明，保留用户后来输入的文字，并允许重试。扩展不再监听普通消息的 Enter、点击发送或表单提交来附加提示。

支持官方实际的 `.md-code-block` / `<pre><span>…</span></pre>` 结构，以及带语言类的 Markdown 代码块。`dsui` 和 `json` 标签均可识别，但内容必须完整通过 DSUI 协议校验；普通 JSON 不会渲染为 UI。

## P1 常用富 UI（v0.3）

v0.3 新增以下组件：

实现范围、自动化测试结果及人工验收状态见 [P1 验证记录](docs/P1_VALIDATION.md)。

| 类型 | 能力 |
| --- | --- |
| `line_chart` | 1–6 条折线，明确的 `null` 缺失值保留断点 |
| `pie_chart` | 饼图或环形图；拒绝负值，全零数据展示空态 |
| `scatter_chart` | 数值 X/Y 坐标、坐标名称与单位 |
| `tabs` / `accordion` | 标签页及可独立展开的面板，支持键盘和触屏 |
| `progress` | 0–100 的真实百分比与原生进度条 |
| `info_card` / `comparison` | 纯文本说明卡和 2–4 个方案的对比卡 |

可以在新会话启用 UI 后要求：“用 `tabs` 分组展示这些数据的 `line_chart` 和摘要”。容器仅接受一层非容器组件，打开过的面板保留表格排序和函数图参数；不提供任意 HTML、自动动作或跨组件状态绑定。格式、示例及完整边界见[协议说明](docs/protocol.md)。

## 开源复用与本项目实现

当前源码复用以下主要运行库，具体安装版本以 `package-lock.json` 和构建产物中的第三方声明为准：

| 开源项目 | 在本项目中的用途 |
| --- | --- |
| [React / React DOM](https://react.dev/) | 扩展弹窗及 Shadow DOM 内的组件渲染、状态和生命周期 |
| [Recharts](https://github.com/recharts/recharts) | 柱状图，以及 P1 折线图、饼图/环形图、散点图的 SVG、坐标轴和提示框 |
| [function-plot](https://github.com/mauriciopoppe/function-plot) | 初等函数的区间采样、SVG 绘图、坐标轴和平移缩放 |
| [D3 Scale](https://github.com/d3/d3-scale)（`d3-scale`） | 数值比例尺；P1 对极小数值范围增加端点刻度适配，现已显式声明为直接依赖 |
| [Math.js](https://github.com/josdejong/mathjs) | 解析数学表达式的语法树；由本项目的白名单和受限适配层检查、计算 |
| [interval-arithmetic](https://github.com/mauriciopoppe/interval-arithmetic) | 数学表达式的区间运算，供函数图的区间采样使用 |
| [decimal.js](https://github.com/MikeMcl/decimal.js) | 滑块数值的十进制步进与吸附计算 |
| [Zod](https://github.com/colinhacks/zod) | DSUI 声明式数据的严格结构校验及 JSON Schema 导出 |

DSUI 协议、安全边界、官方页面适配、原文回退、主题样式，以及卡片、标签页、折叠面板和控件适配代码由本项目实现。进度条使用浏览器原生 `progress` 元素；标签页和折叠面板使用 React 按钮与 ARIA 关系，当前未接入 Radix UI 或 shadcn/ui。P1 新能力的发布状态见上节。

版权及许可证入口见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；构建生成的 `dist/THIRD_PARTY_NOTICES.txt` 保留生产依赖及传递依赖的许可证文本和相关归属声明。

## 开发与验证

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
```

GitHub Actions 在推送到 `main`、针对 `main` 的 Pull Request 以及手动触发时，使用 Node.js 22 执行上述检查，并查询全部生产依赖的 npm 公告，在发现中等或更高等级漏洞时失败。CI 无需配置 Secret；E2E 失败时仅上传本地测试夹具的 PNG 截图，保留 3 天，不上传 trace、源码或浏览器 profile。

浏览器测试会在 `.cache/ms-playwright` 下载项目私有 Chromium，并用独立测试配置加载真实构建的扩展。夹具使用从已登录官方网页观察到的代码块结构，以及真实 React 受控输入框和页面发送控件。官方域名请求由测试拦截，不发送真实聊天；覆盖既有与 P1 组件、流式补全、模式切换、原文恢复、手动启用、草稿保护、普通消息原样发送、会话去重、新建会话分配 ID、历史标记刷新、排序、展开、深色及窄屏。函数图另覆盖滑块鼠标/触屏/键盘、平移缩放、双指手势和完成流追加空白时保留本地状态。P1 还验证多序列断点、空数据、容器键盘导航、隐藏面板恢复及跨代码块资源限制。截图输出到 `test-results`。模拟测试与登录后的真实页面检查分别记录。

function-plot 自动化验证覆盖 32 个初等函数案例、已知数学坐标、定义域空洞与渐近线；具体命令与结果见[验证记录](docs/FUNCTION_PLOT_VALIDATION.md)。维护者已确认完成人工验收；本文所列自动化检查使用本地夹具，两类验证分别记录。更新扩展后，请重新加载 `dist` 并刷新 DeepSeek 页面；新建会话并启用 UI 可获取最新格式说明。

安装依赖时禁用生命周期脚本。构建临时文件位于 `.cache/tmp`，不改变系统环境。`dist`、缓存、测试结果不纳入 Git。

代码入口：`src/protocol.ts`（校验）、`src/prompt.ts`（协议提示）、`src/content/adapter.ts`（官方网页选择器）、`src/content/engine.ts`（观察与生命周期）、`src/components`（视图）、`src/popup`（设置）。[协议说明](docs/protocol.md) 包含全部格式与示例。

## 隐私与边界

- 仅在 `https://chat.deepseek.com/*` 自动运行，只申请 `storage` 权限，仅持久保存模式。
- 不读取认证 Cookie、不获取登录凭据、不保存聊天、不上传聊天到第三方，不访问内部 API。
- 不拦截网络请求；在官方输入框和页面 DOM 上工作。
- 脚本和样式均随扩展打包，不加载远程代码，不执行模型提供的 HTML/JavaScript；所有文本经过 React 转义。
- 无效、超限、未知版本或组件渲染失败时保留原始 Markdown。未完成的流式 JSON 不隐藏原文。
- 拒绝双向/不可见格式控制字符（保留合法 ZWJ/ZWNJ 连接符）和危险控制字符，标签只接受单行文本；说明可保留换行。不会静默改写模型数据，非法内容整体回退原文。
- DeepSeek 网页 DOM 并非公开稳定接口。官方改版可能需要调整适配器，不能以模拟页面测试代替真实兼容性检查。

## License

本项目采用 [MIT License](LICENSE)。

## Third-party licenses

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
for third-party copyright and license notices.

构建会将该通知复制到 `dist/THIRD_PARTY_NOTICES.md`，并保留生产依赖许可证汇总 `dist/THIRD_PARTY_NOTICES.txt`。

`interval-arithmetic@1.1.3` 的发布包许可文本与源码头存在 BSL/MIT 来源差异，适用范围尚未厘清；原有声明均保留，结构化记录见构建产物 `dist/THIRD_PARTY_COVERAGE.json` 的 `unresolved`。安全问题报告方式见 [SECURITY.md](SECURITY.md)。
