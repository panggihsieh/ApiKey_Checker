# API Key Checker 中文說明

API Key Checker 是一個可部署到 GitHub Pages 的 WebApp，用來檢查所選 LLM 供應商應該設定哪些 API key 環境變數。

此 App 有兩種模式：

- GitHub Pages 模式：選擇供應商、查看環境變數名稱、輸入 key，並複製終端設定指令。
- 本機 helper 模式：掃描本機環境變數是否存在，並為缺少的 key 產生可貼到終端的
  macOS / Windows 指令。

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

缺少的 key 會顯示兩種可複製指令：

```bash
export OPENAI_API_KEY="..."
```

```powershell
$env:OPENAI_API_KEY = '...'
```

本機 helper 連線時，介面會顯示「開啟終端」按鈕；此按鈕只會開啟空白終端，
不會執行任何 API key 指令。

測試時可指定自訂 shell profile 讀取來源：

```bash
API_KEY_CHECKER_PROFILE=/tmp/api-key-checker.zshrc npm run helper
```

本機掃描會先檢查 App 進程環境變數，再讀取 macOS/Linux 常見 shell profile：

```text
~/.zshrc
~/.zprofile
~/.bashrc
~/.bash_profile
~/.profile
```

因此從 Finder、Dock 或開始選單啟動桌面版時，即使 GUI App 沒有繼承 terminal 的環境變數，也比較能準確掃到已寫入 profile 的 API key。

部分瀏覽器會阻擋遠端 HTTPS GitHub Pages 頁面呼叫本機 loopback HTTP helper，即使 helper 已啟動也可能顯示未連線。若要穩定掃描本機 API key，請執行 `npm run dev` 並使用 `http://localhost:5173` 本機版。

如果 helper 使用自訂 port，請在 WebApp URL 加上相同 port。helper 也需要一次性
token；建議使用 `npm run dev` 或桌面版自動產生 token，不要手動公開 helper：

```text
http://localhost:5173/?helperPort=8788#helperToken=...
```

## 桌面 App / 安裝檔

桌面版使用 Electron 打包。桌面模式會自動在 localhost 啟動 Web UI 與本機
helper，因此使用者不需要另外執行 `npm run helper`。

### 下載並在 macOS 執行

1. 前往 [GitHub Releases](https://github.com/panggihsieh/ApiKey_Checker/releases)。
2. 下載最新版 release 裡的 `API.Key.Checker-*-mac-arm64.dmg`。
3. 開啟下載的 `.dmg` 檔。
4. 將 `API Key Checker` 拖曳到 `Applications`。
5. 第一次開啟時，如果 macOS 顯示未簽章或無法驗證開發者，請在 Finder 的
   `Applications` 裡對 `API Key Checker` 按右鍵，選擇「打開」，再確認開啟。

目前 macOS DMG 是 Apple Silicon arm64 版本，適用於 M 系列 Mac。

若下載後 macOS 顯示「App 已損毀，無法打開」，代表未 notarized 的測試版被
Gatekeeper quarantine 擋下。確認檔案來源可信後，可移除隔離屬性再開啟：

```bash
xattr -dr com.apple.quarantine "/Applications/API Key Checker.app"
open "/Applications/API Key Checker.app"
```

開發時啟動桌面版：

```bash
npm start
```

產生 macOS DMG：

```bash
npm run dist:mac
```

在 Windows 或 Windows CI runner 產生 Windows x64 安裝檔：

```bash
npm run dist:win
```

Windows build 已設定同時產生 NSIS `.exe` 安裝檔與 MSI `.msi` 安裝檔。MSI
會使用 WiX 工具鏈，因此最可靠的方式是在 Windows 上建置；從 macOS 跨平台建置
可能會因 Wine/WiX 環境不完整而失敗。

Apple Silicon macOS 可在安裝 `msitools` 後使用本機 MSI fallback：

```bash
brew install msitools
npm run dist:win:msi-local
```

這會先用 Electron Builder 建立 Windows unpacked app，再用 native `wixl`
從 `dist/win-unpacked` 建立 per-user MSI。

目前 macOS build 未使用 Apple Developer ID 簽章（`identity: null`），適合本機
測試或內部使用。建置流程會對 `.app` 做本機 ad-hoc 簽章，避免 bundle 資源簽章
不完整造成 macOS 誤判為損毀。若要公開發佈，請再設定 Apple Developer 簽章與
notarization。

## 供應商

目前內建供應商清單共 50 家：

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
- OpenRouter
- Perplexity
- Together AI
- Groq
- Fireworks AI
- Replicate
- Hugging Face
- Azure OpenAI
- AWS Bedrock
- Google Vertex AI
- IBM watsonx.ai
- NVIDIA AI
- Cerebras
- SambaNova
- AI21 Labs
- Voyage AI
- Jina AI
- Aleph Alpha
- Anyscale
- OctoAI
- Baseten
- Modal
- fal.ai
- Stability AI
- Runway
- ElevenLabs
- AssemblyAI
- Deepgram
- Rev AI
- Pinecone
- Weaviate
- Qdrant
- Zilliz / Milvus
- Tencent Hunyuan
- ByteDance Doubao / Volcano Engine
- iFlytek Spark
- MiniMax
- Baichuan AI

## 安全性

- 本機 helper 只監聽 loopback host，不對區網或網際網路開放。
- 本機 helper 要求一次性 session token；沒有 token 的網頁不能呼叫 `/health`、
  `/api/check` 或 `/api/open-terminal`；`/api/save` 已停用。
- CORS 只允許啟動時指定的本機 WebApp origin，不使用 `Access-Control-Allow-Origin: *`。
- `/api/check` 只回傳 found/missing 與遮蔽後的 key，不回傳完整既有 API key。
- API key 不寫入 `localStorage` 或 `sessionStorage`。
- 新輸入的 API key 不送到 helper，只在瀏覽器端產生 macOS / Windows 終端指令，
  由使用者自行複製並貼到終端執行。
---

# API Key Checker

API Key Checker is a GitHub Pages friendly webapp for checking which LLM API key environment variables should exist for selected providers.

The app has two modes:

- GitHub Pages mode: select providers, view environment variable names, enter keys, and copy terminal setup commands.
- Local helper mode: scan whether local environment variables exist and generate
  pasteable macOS / Windows terminal commands for missing keys.

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

Missing keys show two copyable command formats:

```bash
export OPENAI_API_KEY="..."
```

```powershell
$env:OPENAI_API_KEY = '...'
```

When the local helper is connected, the UI shows an "Open terminal" button. It opens
a blank terminal only; it never executes API key commands.

Use a custom shell profile read source for testing:

```bash
API_KEY_CHECKER_PROFILE=/tmp/api-key-checker.zshrc npm run helper
```

Local scanning checks the running app process first, then reads shell profile files on macOS/Linux:

```text
~/.zshrc
~/.zprofile
~/.bashrc
~/.bash_profile
~/.profile
```

This makes the installed desktop app more reliable when launched from Finder, Dock, or Start menu, where GUI apps may not inherit the same environment variables as a terminal shell.

If the helper is running on a custom port, add the same port to the webapp URL. The
helper also requires a one-time token; prefer `npm run dev` or the desktop app so
the token is generated automatically, and do not expose the helper manually:

```text
http://localhost:5173/?helperPort=8788#helperToken=...
```

## Desktop App / Installers

The desktop app is packaged with Electron. In desktop mode, the app starts both
the web UI and the local helper automatically on localhost, so users do not need
to run `npm run helper` separately.

### Download and Run on macOS

1. Go to [GitHub Releases](https://github.com/panggihsieh/ApiKey_Checker/releases).
2. Download `API.Key.Checker-*-mac-arm64.dmg` from the latest release.
3. Open the downloaded `.dmg` file.
4. Drag `API Key Checker` into `Applications`.
5. On first launch, if macOS says the app is unsigned or the developer cannot be
   verified, right-click `API Key Checker` in Finder under `Applications`, choose
   `Open`, then confirm.

The current macOS DMG is an Apple Silicon arm64 build for M-series Macs.

Run the desktop app during development:

```bash
npm start
```

Build a macOS DMG:

```bash
npm run dist:mac
```

Build Windows x64 installers on Windows or a Windows CI runner:

```bash
npm run dist:win
```

The Windows build is configured to produce both an NSIS `.exe` installer and an
MSI `.msi` installer. MSI generation uses WiX tooling, so it is most reliable on
Windows. Cross-building MSI from macOS can fail if Wine/WiX is unavailable or
misconfigured.

On Apple Silicon macOS, a local MSI fallback is available after `msitools` is
installed:

```bash
brew install msitools
npm run dist:win:msi-local
```

This builds the Windows unpacked app with Electron Builder, then creates a
per-user MSI from `dist/win-unpacked` using native `wixl`.

The macOS build is currently unsigned (`identity: null`) for local distribution.
For public distribution, configure Apple Developer code signing and notarization.

## GitHub Pages Mode

GitHub Pages can host the frontend files directly:

- `index.html`
- `src/app.js`
- `src/providers.js`
- `src/styles.css`

Browser security prevents GitHub Pages from reading local environment variables or writing `~/.zshrc`. Without the local helper, the app generates copyable shell commands instead.

Some browsers also block a remote HTTPS GitHub Pages page from calling a local helper over loopback HTTP, even when the helper is running. For reliable local scanning, run `npm run dev` and use the local app at `http://localhost:5173`.

## Providers

The built-in provider list currently includes 50 providers:

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
- OpenRouter
- Perplexity
- Together AI
- Groq
- Fireworks AI
- Replicate
- Hugging Face
- Azure OpenAI
- AWS Bedrock
- Google Vertex AI
- IBM watsonx.ai
- NVIDIA AI
- Cerebras
- SambaNova
- AI21 Labs
- Voyage AI
- Jina AI
- Aleph Alpha
- Anyscale
- OctoAI
- Baseten
- Modal
- fal.ai
- Stability AI
- Runway
- ElevenLabs
- AssemblyAI
- Deepgram
- Rev AI
- Pinecone
- Weaviate
- Qdrant
- Zilliz / Milvus
- Tencent Hunyuan
- ByteDance Doubao / Volcano Engine
- iFlytek Spark
- MiniMax
- Baichuan AI

## Safety

- The local helper listens only on a loopback host, not on the LAN or internet.
- The local helper requires a one-time session token; pages without the token cannot
  call `/health`, `/api/check`, or `/api/open-terminal`; `/api/save` is disabled.
- CORS allows only the locally launched WebApp origin, not `Access-Control-Allow-Origin: *`.
- `/api/check` returns only found/missing status and masked key text, never full
  existing API key values.
- API keys are not stored in `localStorage`.
- Newly entered keys are not sent to the helper; the browser only generates macOS /
  Windows terminal commands for the user to copy and paste manually.
