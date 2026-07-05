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

Local scanning checks the running app process first, then reads shell profile files on macOS/Linux:

```text
~/.zshrc
~/.zprofile
~/.bashrc
~/.bash_profile
~/.profile
```

This makes the installed desktop app more reliable when launched from Finder, Dock, or Start menu, where GUI apps may not inherit the same environment variables as a terminal shell.

If the helper is running on a custom port, add the same port to the webapp URL:

```text
http://localhost:5173/?helperPort=8788
```

## Desktop App / Installers

The desktop app is packaged with Electron. In desktop mode, the app starts both
the web UI and the local helper automatically on localhost, so users do not need
to run `npm run helper` separately.

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

如果 helper 使用自訂 port，請在 WebApp URL 加上相同 port：

```text
http://localhost:5173/?helperPort=8788
```

## 桌面 App / 安裝檔

桌面版使用 Electron 打包。桌面模式會自動在 localhost 啟動 Web UI 與本機
helper，因此使用者不需要另外執行 `npm run helper`。

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

目前 macOS build 是未簽章版本（`identity: null`），適合本機測試或內部使用。
若要公開發佈，請再設定 Apple Developer 簽章與 notarization。
