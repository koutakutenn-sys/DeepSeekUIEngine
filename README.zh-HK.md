# DeepSeek UI Engine

[简体中文](README.md) | [繁體中文（香港）](README.zh-HK.md) | [English](README.en.md)

為 DeepSeek 官方 Chat 網頁原位加入指標卡片、棒形圖、可排序表格、可展開時間軸，以及互動初等函數圖像的 Manifest V3 擴充功能。

更新記錄：[changelog.txt](changelog.txt)。

## 建置與安裝

需要 Node.js 22.18 或更新版本，以及 npm。

```powershell
npm install --ignore-scripts
npm run build
```

1. 在 Edge 開啟 `edge://extensions`。
2. 開啟開發人員模式，選擇載入已解壓縮的擴充功能。
3. 選擇專案內的 `dist` 目錄。
4. 開啟或重新整理 <https://chat.deepseek.com/>，使用官方帳戶登入。
5. 按一下擴充功能圖示選擇模式，預設為 Auto。已開啟的頁面會即時套用設定；重新載入擴充功能後，請重新整理聊天頁面。

建置輸出包含 `manifest.json`、獨立的 `content.js`、彈出視窗及本機資源、`dsui.schema.json`。毋須伺服器、API 金鑰或瀏覽器背景服務。

## 使用方式

在聊天輸入框旁按一下 **「启用 UI」**（啟用 UI；介面按鈕目前使用簡體中文）。擴充功能會透過官方輸入框自動傳送一則獨立的格式說明，成功後按鈕會顯示「UI 已启用」。每個對話只需啟用一次，一般訊息始終按原文傳送。

| 模式 | 按一下「启用 UI」 | 收到 DSUI 程式碼區塊 |
| --- | --- | --- |
| Off | 隱藏啟用按鈕 | 保留官方原文 |
| Auto（預設） | 傳送按需要呈現 UI 的說明 | 通過驗證後原位呈現 |
| Force | 傳送優先呈現 UI 的說明 | 通過驗證後原位呈現 |

可先提供一組真實數據，再傳送：「用表格和棒形圖比較這些數據」。模型會否遵循格式取決於它的回覆，即使使用 Force，也不能保證每則回覆都有 UI。

每次回覆最多三個頂層區塊，圖表最多 30 個資料點，表格最多 50 列。分頁與摺疊面板可包含一層基本元件；整則回覆最多 12 個區塊（包括容器），函數圖像最多三個。一般文字不會額外加入元件。按一下資料表的欄標題即可排序，按一下時間軸項目即可展開；圖表下方附有無障礙資料表，所有檢視都可展開查看原始 DSUI。深色與淺色外觀跟隨頁面，表格在窄螢幕可橫向捲動。

函數圖像採用 [mauriciopoppe/function-plot](https://github.com/mauriciopoppe/function-plot) 1.26.0，支援多項式、分式、根式、指數、對數、三角及反三角函數等。可以要求：「用 function_plot 的 expression 模式展示 y=a*sin(x)，提供振幅 a 滑桿」。詢問二次函數時，也可要求：「用 function_plot 展示 y=ax²+bx+c，並提供 a/b/c 滑桿」。拖動滑桿會在本機即時更新曲線與公式，`a=0` 時自動退化為直線；可拖動畫布平移、使用滾輪或雙指縮放，也可使用按鈕或鍵盤。參數與視窗範圍可分別重設。函數圖像在本機取樣，不受棒形圖的 30 點限制；詳細格式及安全上限見[協定說明](docs/protocol.md#function_plot)。舊對話中的格式說明不會自動更新，建議開啟新對話後再按一下「启用 UI」。

切換 Auto / Force 不會重新傳送說明，也不會改寫目前對話中已傳送的說明。分頁會按對話路徑記住啟用狀態，重新整理時會辨識已載入使用者歷史訊息中的協定標記；不會持久儲存對話或聊天內容。新對話需要重新啟用；已有舊版協定說明的對話會顯示「UI 已启用」。模型忘記早期上下文時，可以開啟新對話重新引導。

如有尚未傳送的草稿、正在使用輸入法組字，或頁面正在產生回覆而沒有可辨識的傳送動作，啟用按鈕會暫時停用。請先傳送或清除草稿，再按一下啟用。傳送失敗時，只會清除擴充功能自行填入而尚未送出的說明，保留使用者其後輸入的文字，並允許重試。擴充功能不會再透過監聽一般訊息的 Enter、傳送按鈕或表單提交來附加提示。

支援官方實際使用的 `.md-code-block` / `<pre><span>…</span></pre>` 結構，以及帶語言類別的 Markdown 程式碼區塊。可辨識 `dsui` 和 `json` 標籤，但內容必須完整通過 DSUI 協定驗證；一般 JSON 不會呈現為 UI。

v0.3.3 支援讓模型透過可選的 `latex` 欄位排版函數定義，例如 `"latex":"y=\\frac{\\sin x}{x}"`。分式、根式及上下標由本機 KaTeX 顯示為 MathML；繪圖仍使用 `expression`，LaTeX 中的參數保留符號，目前數值顯示於滑桿旁。不合法或不支援的 TeX 會改用一般公式，保留曲線和滑桿。舊對話需要重新提供格式說明，或在新對話啟用 UI，才能讓模型獲得新格式。

## P1 常用富 UI（v0.3）

v0.3.3 另支援每項指標的 `color`（`#RGB` / `#RRGGBB`），設定數值及強調線顏色，卡片背景繼續跟隨主題。新增 `svg` 區塊讓模型繪製包含文字、漸變及箭頭的靜態示意圖。本機 DOMPurify 清洗及靜態白名單檢查後，才交由瀏覽器原生 SVG 顯示；不支援腳本、事件、外部連結／圖片、任意 CSS、動畫或濾鏡，不合法或超出限制時保留原文。格式見[協定](docs/protocol.md#svg静态示意图)，舊對話需重新提供格式說明或在新對話啟用 UI。

v0.3 新增以下元件：

實作範圍、自動化測試結果及人工驗收狀態記錄在維護者本地保留的 P1 驗證記錄中（不隨倉庫分發）。

| 類型 | 功能 |
| --- | --- |
| `line_chart` | 1–6 條折線，以 `null` 明確表示缺失值並保留斷點 |
| `pie_chart` | 圓形圖或環形圖；拒絕負值，全零資料顯示空狀態 |
| `scatter_chart` | 數值 X/Y 座標、座標名稱及單位 |
| `tabs` / `accordion` | 分頁與可獨立展開的面板，支援鍵盤及觸控 |
| `progress` | 0–100 的實際百分比及原生進度條 |
| `info_card` / `comparison` | 純文字資訊卡及 2–4 個方案的比較卡 |

可在新對話啟用 UI 後要求：「用 `tabs` 分組展示這些數據的 `line_chart` 和摘要」。容器只接受一層非容器元件；已開啟過的面板會保留表格排序和函數圖像參數。不提供任意 HTML、自動動作或跨元件狀態綁定。格式、範例及完整限制見[協定說明](docs/protocol.md)。

## 開源重用與本專案實作

目前原始碼重用以下主要執行階段程式庫；實際安裝版本以 `package-lock.json` 及建置產物內的第三方聲明為準：

| 開源專案 | 在本專案中的用途 |
| --- | --- |
| [React / React DOM](https://react.dev/) | 擴充功能彈出視窗及 Shadow DOM 內元件的呈現、狀態與生命週期 |
| [Recharts](https://github.com/recharts/recharts) | 棒形圖，以及 P1 折線圖、圓形圖／環形圖、散點圖的 SVG、座標軸與提示框 |
| [function-plot](https://github.com/mauriciopoppe/function-plot) | 初等函數的區間取樣、SVG 繪圖、座標軸、平移與縮放 |
| [D3 Scale](https://github.com/d3/d3-scale)（`d3-scale`） | 數值比例尺；P1 為極小數值範圍加入端點刻度配接，現已明確宣告為直接依賴 |
| [Math.js](https://github.com/josdejong/mathjs) | 解析數學運算式的語法樹；由本專案的白名單及受限配接層檢查與計算 |
| [interval-arithmetic](https://github.com/mauriciopoppe/interval-arithmetic) | 數學運算式的區間運算，供函數圖像的區間取樣使用 |
| [decimal.js](https://github.com/MikeMcl/decimal.js) | 滑桿數值的十進制步進及對齊計算 |
| [KaTeX](https://github.com/KaTeX/KaTeX) | 將可選的 LaTeX 函數定義轉為原生 MathML，不載入外部字型 |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 清洗模型提供的靜態 SVG，再通過本專案白名單及資源限制檢查 |
| [Zod](https://github.com/colinhacks/zod) | DSUI 宣告式資料的嚴格結構驗證及 JSON Schema 匯出 |

DSUI 協定、安全邊界、官方頁面配接、原文還原、主題樣式，以及卡片、分頁、摺疊面板與控制項配接程式碼由本專案實作。進度列使用瀏覽器原生 `progress` 元素；分頁及摺疊面板使用 React 按鈕與 ARIA 關係，目前未整合 Radix UI 或 shadcn/ui。P1 新功能的發佈狀態見上一節。

版權及授權入口見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；建置產生的 `dist/THIRD_PARTY_NOTICES.txt` 保留正式環境依賴及其間接依賴的授權文字與相關歸屬聲明。

## 開發與驗證

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
```

GitHub Actions 會在推送至 `main`、以 `main` 為目標的 Pull Request，以及手動觸發時，使用 Node.js 22 執行上述檢查，並查詢所有正式環境依賴的 npm 公告，發現中等或以上級別漏洞時失敗。CI 毋須設定 Secret；E2E 失敗時只會上傳本機測試資料頁的 PNG 螢幕擷取畫面，保留 3 天，不會上傳 trace、原始碼或瀏覽器設定檔。

瀏覽器測試會將專案專用的 Chromium 下載至 `.cache/ms-playwright`，並以獨立測試設定載入實際建置的擴充功能。測試資料頁採用已登入官方網頁中觀察到的程式碼區塊結構，以及真正的 React 受控輸入框和頁面傳送控制項。測試會攔截官方網域的請求，不會傳送真實聊天；涵蓋既有及 P1 元件、串流補全、模式切換、還原原文、手動啟用、草稿保護、一般訊息按原文傳送、對話去重、新對話 ID 分配、歷史標記重新整理、排序、展開、深色及窄螢幕。函數圖像另外涵蓋滑桿的滑鼠、觸控及鍵盤操作，平移縮放、雙指手勢，以及串流完成後追加空白時保留本機狀態。P1 亦驗證多序列斷點、空資料、面板鍵盤操作、隱藏面板恢復及跨程式碼區塊的資源限制。螢幕擷取畫面輸出至 `test-results`。模擬測試與登入後的真實頁面檢查分開記錄。

function-plot 自動化驗證涵蓋 32 個初等函數案例、已知數學座標、定義域空洞與漸近線；詳細指令及結果見維護者本地保留的 function-plot 驗證記錄（不隨倉庫分發）。維護者已確認完成人工驗收；本文列出的自動化檢查使用本機測試資料頁，兩類驗證分開記錄。更新擴充功能後，請重新載入 `dist` 並重新整理 DeepSeek 頁面；開啟新對話並啟用 UI 可取得最新格式說明。

安裝依賴時停用生命週期指令碼。建置暫存檔案位於 `.cache/tmp`，不會更改系統環境。`dist`、快取及測試結果不會納入 Git。

程式碼入口：`src/protocol.ts`（驗證）、`src/prompt.ts`（協定提示）、`src/content/adapter.ts`（官方網頁選擇器）、`src/content/engine.ts`（觀察與生命週期）、`src/components`（檢視）、`src/popup`（設定）。[協定說明](docs/protocol.md) 包含完整格式與範例。

## 私隱與限制

- 只會在 `https://chat.deepseek.com/*` 自動執行，僅要求 `storage` 權限，只會持久儲存模式設定。
- 不讀取認證 Cookie、不取得登入憑證、不儲存聊天、不將聊天上傳至第三方，也不存取內部 API。
- 不攔截網絡請求；只在官方輸入框和頁面 DOM 上運作。
- 指令碼及樣式均隨擴充功能打包，不會載入遠端程式碼或執行模型提供的 HTML/JavaScript；一般文字經 React 跳脫處理，svg 欄位則獨立清洗及檢查後才掛載原生 SVG。
- 如資料無效、超出上限、版本不明，或元件呈現失敗，會保留原始 Markdown。未完成的串流 JSON 不會隱藏原文。
- 拒絕雙向／不可見格式控制字元（保留合法 ZWJ/ZWNJ 連接符及完整合法的英格蘭／蘇格蘭／威爾斯旗幟 tag 序列）及危險控制字元，標籤只接受單行文字；說明可保留換行。不會默默改寫模型資料，無效內容整段還原為原文。
- DeepSeek 網頁 DOM 並非公開且穩定的介面。官方改版後可能需要調整配接器，不能以模擬頁面測試代替真實相容性檢查。

## 授權

本專案採用 [MIT License](LICENSE)。

## 第三方授權

第三方版權及授權聲明見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

建置時會將該通知複製至 `dist/THIRD_PARTY_NOTICES.md`，並保留正式環境依賴的授權彙整 `dist/THIRD_PARTY_NOTICES.txt`。

`interval-arithmetic@1.1.3` 發佈套件的授權文字與原始碼標頭存在 BSL/MIT 來源差異，適用範圍尚未釐清；所有既有聲明均保留，結構化記錄見建置產物 `dist/THIRD_PARTY_COVERAGE.json` 的 `unresolved`。安全問題報告方式見 [SECURITY.md](SECURITY.md)。

連結中的協定及驗證記錄目前以簡體中文為主。
