# API Key Checker

API Key Checker is a GitHub Pages friendly webapp for checking which LLM API key environment variables should exist for selected providers.

The app has two modes:

- GitHub Pages mode: select providers, view environment variable names, enter keys, and copy shell setup commands.
- Local helper mode: scan local environment variables and save missing keys to a shell profile.

## Run Locally

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

The local helper runs at:

```text
http://localhost:8787
```

By default, saved keys are written to:

```text
~/.zshrc
```

Use a custom shell profile for testing:

```bash
API_KEY_CHECKER_PROFILE=/tmp/api-key-checker.zshrc npm run helper
```

If the helper is running on a custom port, add the same port to the webapp URL:

```text
http://localhost:5173/?helperPort=8788
```

## GitHub Pages Mode

GitHub Pages can host the frontend files directly:

- `index.html`
- `src/app.js`
- `src/providers.js`
- `src/styles.css`

Browser security prevents GitHub Pages from reading local environment variables or writing `~/.zshrc`. Without the local helper, the app generates copyable shell commands instead.

Some browsers also block a remote HTTPS GitHub Pages page from calling a local helper over loopback HTTP, even when the helper is running. For reliable local scanning, run `npm run dev` and use the local app at `http://localhost:5173`.

## Providers

The initial curated provider list includes:

- OpenAI / Codex
- Anthropic Claude
- Google Gemini
- DeepSeek
- xAI Grok
- Mistral AI
- Cohere
- Meta Llama
- Alibaba Qwen / DashScope
- Baidu ERNIE / Qianfan
- Moonshot / Kimi
- Zhipu AI / GLM

## Safety

- API keys are masked by default.
- API keys are not stored in `localStorage`.
- API keys are not sent to third-party services.
- Keys are sent only to the local helper when saving.

---

# API Key Checker 中文說明

API Key Checker 是一個可部署到 GitHub Pages 的 WebApp，用來檢查所選 LLM 供應商應該設定哪些 API key 環境變數。

此 App 有兩種模式：

- GitHub Pages 模式：選擇供應商、查看環境變數名稱、輸入 key，並複製 shell 設定指令。
- 本機 helper 模式：掃描本機環境變數，並將缺少的 key 儲存到 shell profile。

## 本機執行

```bash
npm run dev
```

開啟：

```text
http://localhost:5173
```

本機 helper 會執行於：

```text
http://localhost:8787
```

預設會將儲存的 key 寫入：

```text
~/.zshrc
```

測試時可指定自訂 shell profile：

```bash
API_KEY_CHECKER_PROFILE=/tmp/api-key-checker.zshrc npm run helper
```

部分瀏覽器會阻擋遠端 HTTPS GitHub Pages 頁面呼叫本機 loopback HTTP helper，即使 helper 已啟動也可能顯示未連線。若要穩定掃描本機 API key，請執行 `npm run dev` 並使用 `http://localhost:5173` 本機版。

如果 helper 使用自訂 port，請在 WebApp URL 加上相同 port：

```text
http://localhost:5173/?helperPort=8788
```
