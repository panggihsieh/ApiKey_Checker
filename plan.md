# API Key Checker WebApp Plan

## Goal

Build a frontend webapp that can be deployed to GitHub Pages. Users can manually select multiple LLM providers, view the expected API key environment variables, and prepare API key setup instructions.

For full local scanning and environment-variable injection, the app will also support an optional local helper server because GitHub Pages cannot read or write local machine environment variables.

## Confirmed Product Requirements

- Deployable as a frontend webapp on GitHub Pages.
- User can manually select multiple LLM providers.
- The app lists each selected provider's API key environment variables.
- The app shows whether local API key scanning is available.
- If local helper is connected, the app can scan local API key status.
- If a key is missing, the app shows an input field for that environment variable.
- If local helper is connected, the app can save the input key into a local shell profile.
- If local helper is not connected, the app generates copyable shell commands instead.

## Browser Security Constraint

GitHub Pages is a static frontend environment. It cannot directly:

- Read `process.env`.
- Read local files like `~/.zshrc`.
- Write local shell profile files.
- Scan existing API keys on a user's machine.

Therefore, the app needs two operating modes.

## Operating Modes

### 1. GitHub Pages Mode

Available features:

- Load provider catalog.
- Let the user multi-select providers.
- Show provider name, env var names, and setup status as "Local helper required".
- Show API key input fields.
- Generate copyable shell commands, such as:

```bash
export OPENAI_API_KEY="..."
```

or:

```bash
echo 'export OPENAI_API_KEY="..."' >> ~/.zshrc
```

Unavailable features:

- Directly scan local API keys.
- Directly display existing local API key values.
- Directly write local environment variables.

### 2. Local Helper Mode

Available features:

- Scan local environment variables.
- Display found or missing status.
- Display masked API key values by default.
- Toggle full key display with Show / Hide.
- Save missing keys into the local shell profile.
- Refresh scan results after saving.

Local helper endpoint:

```text
http://localhost:8787
```

## Suggested Tech Stack

- Vite
- React
- Plain CSS
- Node.js local helper
- No database
- GitHub Pages mode does not need authentication.

## Provider Catalog Strategy

Use a fallback-based provider catalog:

1. Try live provider/model source, such as OpenRouter models API.
2. If live fetch fails or is blocked, use a generated static provider catalog JSON.
3. If no catalog is available, use built-in curated providers.

## Initial Curated Provider List

| Provider | Env Vars |
| --- | --- |
| OpenAI / Codex | `OPENAI_API_KEY` |
| Anthropic Claude | `ANTHROPIC_API_KEY` |
| Google Gemini | `GEMINI_API_KEY`, `GOOGLE_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| xAI Grok | `XAI_API_KEY` |
| Mistral AI | `MISTRAL_API_KEY` |
| Cohere | `COHERE_API_KEY` |
| Meta Llama | `META_API_KEY`, `LLAMA_API_KEY` |
| Alibaba Qwen / DashScope | `DASHSCOPE_API_KEY` |
| Baidu ERNIE / Qianfan | `QIANFAN_ACCESS_KEY`, `QIANFAN_SECRET_KEY` |
| Moonshot / Kimi | `MOONSHOT_API_KEY` |
| Zhipu AI / GLM | `ZHIPUAI_API_KEY` |

## UI Plan

The first screen is the actual tool, not a landing page.

Main areas:

- Header with app title and helper connection status.
- Provider multi-select control.
- Selected provider status table.
- Per-env-var key input for missing values.
- Show / Hide control for found keys.
- Refresh button.
- Save button when local helper is connected.
- Copy command button when local helper is not connected.

## Local Helper API

```text
GET /health
GET /api/providers
POST /api/check
POST /api/save
```

### `GET /health`

Returns whether the local helper is running.

### `POST /api/check`

Input:

```json
{
  "envVars": ["OPENAI_API_KEY", "GEMINI_API_KEY"]
}
```

Output:

```json
{
  "OPENAI_API_KEY": {
    "status": "found",
    "value": "sk-..."
  },
  "GEMINI_API_KEY": {
    "status": "missing",
    "value": ""
  }
}
```

### `POST /api/save`

Input:

```json
{
  "envVar": "OPENAI_API_KEY",
  "value": "..."
}
```

Behavior:

- Write to `~/.zshrc` by default.
- Update existing `export NAME="..."` line if present.
- Append a new export line if missing.

## Security Design

- Mask API keys by default.
- Do not store API keys in `localStorage`.
- Do not send API keys to third-party services.
- Only send API keys to the local helper when saving.
- Show a clear local helper connection state.
- GitHub Pages mode only generates commands; it does not claim to scan local files.

## Verification Criteria

1. GitHub Pages mode loads without local helper.
2. User can multi-select providers.
3. Selected providers render the correct env vars.
4. Without local helper, the app generates copyable export commands.
5. With local helper, the app detects found and missing env vars.
6. Found keys are masked by default.
7. Missing keys can be entered and saved.
8. Saving updates or appends env vars without duplicate export lines.
9. Refresh shows updated status after saving.

## Open Decisions

- Confirm whether `~/.zshrc` is the only target shell profile or whether `.bashrc` / `.bash_profile` should be supported.
- Confirm whether full API key display should be allowed with a Show button.
- Confirm whether the live provider catalog should depend on OpenRouter only or include a GitHub Actions scheduled catalog update.

---

# API Key Checker 網頁應用規劃

## 目標

建立一個可部署到 GitHub Pages 的前端 WebApp。使用者可以手動多選 LLM 供應商，查看對應的 API key 環境變數，並準備 API key 設定指令。

若要完整支援本機掃描與環境變數注入，WebApp 需要搭配選用的本機 helper server，因為 GitHub Pages 不能讀取或寫入使用者電腦上的環境變數。

## 已確認產品需求

- 可部署為 GitHub Pages 前端 WebApp。
- 使用者可以手動多選 LLM 供應商。
- WebApp 會列出每個已選供應商的 API key 環境變數。
- WebApp 會顯示目前是否可使用本機 API key 掃描。
- 若本機 helper 已連線，WebApp 可以掃描本機 API key 狀態。
- 若 key 缺少，WebApp 會顯示對應環境變數的輸入欄位。
- 若本機 helper 已連線，WebApp 可以將輸入的 key 儲存到本機 shell profile。
- 若本機 helper 未連線，WebApp 會改為產生可複製的 shell 指令。

## 瀏覽器安全限制

GitHub Pages 是靜態前端環境，不能直接：

- 讀取 `process.env`。
- 讀取 `~/.zshrc` 這類本機檔案。
- 寫入本機 shell profile 檔案。
- 掃描使用者電腦上既有的 API key。

因此 WebApp 需要兩種運作模式。

## 運作模式

### 1. GitHub Pages 模式

可用功能：

- 載入供應商 catalog。
- 讓使用者多選供應商。
- 顯示供應商名稱、環境變數名稱，以及「需要本機 helper」狀態。
- 顯示 API key 輸入欄位。
- 產生可複製的 shell 指令，例如：

```bash
export OPENAI_API_KEY="..."
```

或：

```bash
echo 'export OPENAI_API_KEY="..."' >> ~/.zshrc
```

不可用功能：

- 直接掃描本機 API key。
- 直接顯示本機既有 API key。
- 直接寫入本機環境變數。

### 2. 本機 Helper 模式

可用功能：

- 掃描本機環境變數。
- 顯示 found / missing 狀態。
- 預設以遮罩方式顯示 API key。
- 使用 Show / Hide 切換完整 key 顯示。
- 將缺少的 key 儲存到本機 shell profile。
- 儲存後重新整理掃描結果。

本機 helper endpoint：

```text
http://localhost:8787
```

## 建議技術架構

- Vite
- React
- Plain CSS
- Node.js local helper
- 不使用資料庫
- GitHub Pages 模式不需要登入驗證

## 供應商 Catalog 策略

使用 fallback 機制建立 provider catalog：

1. 優先嘗試即時 provider/model 來源，例如 OpenRouter models API。
2. 若即時抓取失敗或被阻擋，改用預先產生的靜態 provider catalog JSON。
3. 若沒有可用 catalog，使用內建 curated providers。

## 初始精選供應商清單

| 供應商 | 環境變數 |
| --- | --- |
| OpenAI / Codex | `OPENAI_API_KEY` |
| Anthropic Claude | `ANTHROPIC_API_KEY` |
| Google Gemini | `GEMINI_API_KEY`, `GOOGLE_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| xAI Grok | `XAI_API_KEY` |
| Mistral AI | `MISTRAL_API_KEY` |
| Cohere | `COHERE_API_KEY` |
| Meta Llama | `META_API_KEY`, `LLAMA_API_KEY` |
| Alibaba Qwen / DashScope | `DASHSCOPE_API_KEY` |
| Baidu ERNIE / Qianfan | `QIANFAN_ACCESS_KEY`, `QIANFAN_SECRET_KEY` |
| Moonshot / Kimi | `MOONSHOT_API_KEY` |
| Zhipu AI / GLM | `ZHIPUAI_API_KEY` |

## 介面規劃

第一畫面就是工具本體，不做 landing page。

主要區塊：

- 頁首：App 標題與 helper 連線狀態。
- 供應商多選控制元件。
- 已選供應商狀態表格。
- 每個缺少的環境變數都有對應 key 輸入欄位。
- 已找到的 key 可使用 Show / Hide 控制顯示。
- 重新掃描按鈕。
- helper 已連線時顯示儲存按鈕。
- helper 未連線時顯示複製指令按鈕。

## 本機 Helper API

```text
GET /health
GET /api/providers
POST /api/check
POST /api/save
```

### `GET /health`

回傳本機 helper 是否正在執行。

### `POST /api/check`

輸入：

```json
{
  "envVars": ["OPENAI_API_KEY", "GEMINI_API_KEY"]
}
```

輸出：

```json
{
  "OPENAI_API_KEY": {
    "status": "found",
    "value": "sk-..."
  },
  "GEMINI_API_KEY": {
    "status": "missing",
    "value": ""
  }
}
```

### `POST /api/save`

輸入：

```json
{
  "envVar": "OPENAI_API_KEY",
  "value": "..."
}
```

行為：

- 預設寫入 `~/.zshrc`。
- 若已有 `export NAME="..."`，更新既有行。
- 若不存在，追加新的 export 行。

## 安全設計

- 預設遮罩 API key。
- 不將 API key 存入 `localStorage`。
- 不將 API key 傳送到第三方服務。
- 只有儲存時才將 API key 傳給本機 helper。
- 清楚顯示本機 helper 連線狀態。
- GitHub Pages 模式只產生指令，不宣稱能掃描本機檔案。

## 驗證標準

1. GitHub Pages 模式可在沒有本機 helper 時正常載入。
2. 使用者可以多選供應商。
3. 已選供應商會顯示正確環境變數。
4. 沒有本機 helper 時，WebApp 會產生可複製的 export 指令。
5. 有本機 helper 時，WebApp 可以偵測 found / missing 環境變數。
6. 找到的 key 預設遮罩。
7. 缺少的 key 可以輸入並儲存。
8. 儲存時會更新或追加環境變數，不產生重複 export 行。
9. 儲存後重新整理會顯示更新後狀態。

## 待確認事項

- 確認是否只支援 `~/.zshrc`，或也要支援 `.bashrc` / `.bash_profile`。
- 確認是否允許用 Show 按鈕顯示完整 API key。
- 確認即時 provider catalog 是否只依賴 OpenRouter，或也要加入 GitHub Actions 排程更新。
