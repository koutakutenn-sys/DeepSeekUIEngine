# DeepSeek UI Engine

[简体中文](README.md) | [繁體中文（香港）](README.zh-HK.md) | [English](README.en.md)

A Manifest V3 extension that adds metric cards, bar charts, sortable tables, expandable timelines, and interactive elementary function plots directly to the official DeepSeek Chat website.

Release history: [changelog.txt](changelog.txt).

## Build and install

Requires Node.js 22.18 or later and npm.

```powershell
npm install --ignore-scripts
npm run build
```

1. Open `edge://extensions` in Edge.
2. Enable Developer mode and choose **Load unpacked**.
3. Select the project's `dist` directory.
4. Open or refresh <https://chat.deepseek.com/> and sign in with your official account.
5. Click the extension icon to select a mode. The default is Auto. Settings apply immediately to open pages; refresh the chat page after reloading the extension.

The build includes `manifest.json`, a standalone `content.js`, the popup and local assets, and `dsui.schema.json`. No server, API key, or browser background service is required.

## Usage

Click **启用 UI** (Enable UI) next to the chat input. The interface currently uses Simplified Chinese. The extension automatically sends a separate formatting instruction through the official input. After a successful send, the button displays **UI 已启用** (UI enabled). Enable it once per conversation. Ordinary messages are always sent unchanged.

| Mode | Enable UI button | Received DSUI code blocks |
| --- | --- | --- |
| Off | Hidden | Keep the original content |
| Auto (default) | Send instructions to use UI when appropriate | Render in place after validation |
| Force | Send instructions to prioritize UI | Render in place after validation |

Try providing real data and asking: “Compare these data using a table and a bar chart.” Whether the model follows the format depends on its response. Even Force cannot guarantee UI in every reply.

Each reply supports up to three top-level blocks, with up to 30 points per chart and 50 rows per table. Tabs and accordions can contain one level of leaf components; the whole reply allows at most 12 blocks including containers, and at most three function plots. Ordinary text does not create components. Click table column headers to sort and timeline items to expand. Charts include an accessible data table, and every view can show the original DSUI. Light and dark themes follow the page; tables scroll horizontally on narrow screens.

Function plots use [mauriciopoppe/function-plot](https://github.com/mauriciopoppe/function-plot) 1.26.0 and support polynomials, rational functions, radicals, exponentials, logarithms, trigonometric functions, inverse trigonometric functions, and more. Ask: “Show y=a*sin(x) using function_plot in expression mode, with a slider for amplitude a.” For quadratics, ask: “Show y=ax²+bx+c using function_plot, with a/b/c sliders.” Moving a slider updates the curve and formula locally; `a=0` reduces the quadratic to a line. Drag to pan, use the wheel or pinch to zoom, or use the buttons and keyboard. Parameters and the viewport have separate reset controls. Local function sampling is independent of the bar chart's 30-point limit. See the [protocol](docs/protocol.md#function_plot) for the exact format and safety limits. Existing conversations do not receive updated formatting instructions automatically; start a new conversation and enable UI again.

Switching between Auto and Force neither resends instructions nor changes instructions already sent in the current conversation. The tab remembers enablement by conversation path. After a refresh, it checks loaded user history for the protocol marker without persistently storing conversations or chat content. New conversations need to be enabled again; conversations containing an older protocol instruction still show UI as enabled. If the model forgets earlier context, start a new conversation and enable UI again.

The enable button is temporarily disabled when there is an unsent draft, an active input-method composition, or a response in progress without an identifiable send action. Send or clear the draft first. If sending fails, the extension clears only its own instruction that has not yet been consumed, preserves text entered afterward, and allows a retry. It no longer appends prompts by listening to Enter, send clicks, or form submissions for ordinary messages.

The extension supports the official `.md-code-block` / `<pre><span>…</span></pre>` structure and Markdown code blocks with language classes. Both `dsui` and `json` labels are recognized, but the content must fully pass DSUI protocol validation. Ordinary JSON is not rendered as UI.

## P1 rich UI (development branch)

The current source adds the following components. They are not included in the published v0.2 release yet.

See the [P1 validation record](docs/P1_VALIDATION.md) for scope, test results, and outstanding acceptance checks.

| Type | Capability |
| --- | --- |
| `line_chart` | 1–6 series with explicit `null` gaps preserved as breaks |
| `pie_chart` | Pie or donut charts; negative values are rejected and all-zero data shows an empty state |
| `scatter_chart` | Numeric X/Y coordinates, axis names, and units |
| `tabs` / `accordion` | Keyboard- and touch-accessible tabs and independently expandable panels |
| `progress` | An actual percentage from 0 to 100 and a native progress indicator |
| `info_card` / `comparison` | Plain-text information cards and comparisons of 2–4 options |

Enable UI in a new conversation and ask: “Use `tabs` to group a `line_chart` and a summary of these data.” Containers accept only one level of non-container blocks. Visited panels retain table sorting and function-plot parameters. Arbitrary HTML, automatic actions, and cross-component state bindings are not supported. See the [protocol](docs/protocol.md) for exact shapes, examples, and limits.

## Open-source reuse and project implementation

The current source uses the following main runtime libraries. See `package-lock.json` and the distribution notices for the installed versions.

| Open-source project | Use in this project |
| --- | --- |
| [React / React DOM](https://react.dev/) | Rendering, state, and lifecycle for the popup and components inside Shadow DOM |
| [Recharts](https://github.com/recharts/recharts) | SVG charts, axes, and tooltips for bar charts and P1 line, pie/donut, and scatter charts |
| [function-plot](https://github.com/mauriciopoppe/function-plot) | Interval sampling, SVG plotting, axes, panning, and zooming for elementary functions |
| [D3 Scale](https://github.com/d3/d3-scale) (`d3-scale`) | Numeric scales; P1 adds endpoint-tick handling for tiny numeric ranges using this existing transitive dependency |
| [Math.js](https://github.com/josdejong/mathjs) | Parsing mathematical expression syntax trees, checked and evaluated by this project's allowlist and restricted adapter |
| [interval-arithmetic](https://github.com/mauriciopoppe/interval-arithmetic) | Interval operations for mathematical expressions used by function-plot's interval sampling |
| [decimal.js](https://github.com/MikeMcl/decimal.js) | Decimal slider stepping and snapping calculations |
| [Zod](https://github.com/colinhacks/zod) | Strict validation of declarative DSUI data and JSON Schema export |

This project implements the DSUI protocol, safety boundaries, official-page adapter, original-source fallback, theme styles, cards, tabs, accordions, and control adapters. Progress indicators use the browser's native `progress` element. Tabs and accordions use React buttons and ARIA relationships; Radix UI and shadcn/ui are not currently integrated. See the preceding section for the release status of P1 features.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for copyright and license information. The generated `dist/THIRD_PARTY_NOTICES.txt` preserves license texts and relevant attributions for production dependencies and their transitive dependencies.

## Development and verification

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
```

GitHub Actions runs these checks on Node.js 22 for pushes to `main`, pull requests targeting `main`, and manual runs. CI requires no secrets. On E2E failure, it uploads only PNG screenshots from local test fixtures, retained for three days; it does not upload traces, source code, or browser profiles.

Browser tests download a project-private Chromium into `.cache/ms-playwright` and load the actual extension build with an isolated test configuration. The fixtures use code-block structures observed on the signed-in official site, real React controlled inputs, and page send controls. Tests intercept requests to the official domain and send no real chat messages. Coverage includes the existing and P1 components, streaming completion, mode switching, restoring original text, manual enablement, draft protection, unchanged ordinary messages, conversation deduplication, new conversation IDs, history-marker refresh, sorting, expansion, dark mode, and narrow screens. Function-plot checks also cover mouse, touch, and keyboard slider input, panning and zooming, pinch gestures, and preserving local state when trailing whitespace arrives after streaming completion. P1 additionally checks multi-series gaps, empty data, keyboard panel navigation, restored hidden panels, and reply budgets across code fences. Screenshots are written to `test-results`. Fixture tests and signed-in checks on the real website are recorded separately.

The function-plot migration was checked against 32 elementary-function cases, known mathematical coordinates, domain gaps, and asymptotes. Commands and results are in the [validation record](docs/FUNCTION_PLOT_VALIDATION.md). An earlier visit to the real official site from a fresh isolated browser, without request interception, received CloudFront HTTP 403. The current checks use local fixtures; end-to-end compatibility in a signed-in official conversation has not been accepted, and fixture results do not replace that check. Reload `dist` in your usual browser, sign in to the official site, start a new conversation, enable UI, and check the protocol examples.

Dependency installation disables lifecycle scripts. Build temporary files stay in `.cache/tmp` without changing the system environment. `dist`, caches, and test results are excluded from Git.

Code entry points: `src/protocol.ts` (validation), `src/prompt.ts` (protocol instructions), `src/content/adapter.ts` (official-page selectors), `src/content/engine.ts` (observation and lifecycle), `src/components` (views), and `src/popup` (settings). The [protocol](docs/protocol.md) includes the complete format and examples.

## Privacy and limitations

- Runs automatically only on `https://chat.deepseek.com/*`, requests only the `storage` permission, and persistently stores only the selected mode.
- Does not read authentication cookies, obtain login credentials, save chats, upload chats to third parties, or access internal APIs.
- Does not intercept network requests; it operates through the official input and page DOM.
- Scripts and styles are bundled locally. The extension loads no remote code and executes no model-provided HTML or JavaScript. React escapes all text.
- Invalid, oversized, unknown-version, or failed components keep the original Markdown. Incomplete streaming JSON never hides the original content.
- The DeepSeek page DOM is not a public, stable interface. Site updates may require adapter changes; fixture tests cannot replace real-site compatibility checks.

## License

This project is licensed under the [MIT License](LICENSE).

## Third-party licenses

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party copyright and license notices.

The build copies that notice to `dist/THIRD_PARTY_NOTICES.md` and retains the production-dependency license collection in `dist/THIRD_PARTY_NOTICES.txt`.

Linked protocol and validation documents are currently primarily in Simplified Chinese.
