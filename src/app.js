import { curatedProviders } from "./providers.js?v=20260705-provider-count";

const defaultHelperPort = "8787";
const languageLabel = document.querySelector("#languageLabel");
const languageSelect = document.querySelector("#languageSelect");
const providerSelect = document.querySelector("#providerSelect");
const providerCountSelect = document.querySelector("#providerCountSelect");
const providerCountLabel = document.querySelector("#providerCountLabel");
const providerLabel = document.querySelector("#providerLabel");
const providerHelp = document.querySelector("#providerHelp");
const statusRows = document.querySelector("#statusRows");
const helperStatus = document.querySelector("#helperStatus");
const modeNotice = document.querySelector("#modeNotice");
const toolbarSection = document.querySelector("#toolbarSection");
const statusPanel = document.querySelector("#statusPanel");
const openTerminalButton = document.querySelector("#openTerminalButton");
const selectTopButton = document.querySelector("#selectTopButton");
const clearButton = document.querySelector("#clearButton");
const refreshButton = document.querySelector("#refreshButton");
const providerHeader = document.querySelector("#providerHeader");
const envHeader = document.querySelector("#envHeader");
const statusHeader = document.querySelector("#statusHeader");
const valueHeader = document.querySelector("#valueHeader");
const actionHeader = document.querySelector("#actionHeader");

const state = {
  language: "zh",
  providers: curatedProviders,
  providerLimit: 12,
  catalogSource: "curated",
  catalogModelCount: 0,
  catalogUpdatedAt: new Date("2026-07-05T00:00:00+08:00"),
  helperConnected: false,
  helperBaseUrl: "",
  helperToken: "",
  scanResults: {},
  visibleKeys: new Set(),
  inputValues: {},
};

const messages = {
  zh: {
    documentTitle: "API Key Checker",
    languageLabel: "介面語言",
    toolbarAria: "供應商控制",
    providerLabel: "供應商",
    providerCountLabel: "供應商數量",
    providerHelp:
      "{count} 家資料來源：OpenRouter Models 提供公開模型清單與模型命中數；Artificial Analysis LLM Leaderboard 提供模型能力、價格、速度參考；LMArena / Arena Leaderboard 提供使用者偏好與對戰排名參考；依模型命中數並參考上述來源重新排序。",
    updatedAt: "更新日期：{updatedAt}",
    showUpdatedAt: true,
    selectTop: "選取目前 {count} 家",
    clear: "清除",
    refresh: "重新掃描",
    statusPanelAria: "已選供應商 API key 狀態",
    providerHeader: "供應商",
    envHeader: "環境變數",
    statusHeader: "狀態",
    valueHeader: "值",
    actionHeader: "操作",
    checkingHelper: "正在檢查 helper...",
    helperConnected: "本機 helper：已連線",
    helperDisconnected: "本機 helper：未連線",
    localMode:
      "本機 helper 模式已啟用。你可以掃描這台電腦是否已有 API key；新增 key 會產生終端指令，由你自行貼上執行。",
    pagesMode:
      "GitHub Pages 模式已啟用。瀏覽器安全限制會阻擋本機掃描，因此此模式會產生可複製的 shell 指令。",
    remoteHelperBlocked: "遠端頁可能無法直接連到本機 helper。",
    openLocalApp: "開啟本機版",
    catalogLabel: "Catalog",
    catalogCurated: "內建精選清單，不連接任何大模型",
    sentenceEnd: "。",
    doubleClickHint: "雙擊供應商可顯示或隱藏已找到的 API key",
    statusFound: "已找到",
    statusMissing: "缺少",
    statusHelperRequired: "需要 helper",
    statusUnknown: "未知",
    enterPlaceholder: "輸入",
    show: "顯示",
    hide: "隱藏",
    masked: "已遮蔽",
    openTerminal: "開啟終端",
    terminalUnavailable: "需要本機 helper 才能開啟終端。",
    terminalOpenFailed: "無法開啟終端。",
    terminalOpened: "已開啟終端。",
    macCommand: "macOS / zsh",
    windowsCommand: "Windows PowerShell",
    macDisplayCommand: "macOS 顯示",
    windowsDisplayCommand: "Windows 顯示",
    copyMacCommand: "複製 macOS",
    copyWindowsCommand: "複製 Windows",
    save: "複製指令",
    copyCommand: "複製指令",
    emptyState: "請至少選擇一個供應商來檢查 API key 環境變數。",
    enterValueFirst: "請先輸入",
    copiedSetupCommand: "已複製設定指令：",
    unableToScan: "無法掃描 API key。",
  },
  en: {
    documentTitle: "API Key Checker",
    languageLabel: "Language",
    toolbarAria: "Provider controls",
    providerLabel: "Providers",
    providerCountLabel: "Provider count",
    providerHelp:
      "{count} providers data source: OpenRouter Models provides the public model list and model match count; Artificial Analysis LLM Leaderboard provides model capability, pricing, and speed references; LMArena / Arena Leaderboard provides user preference and battle ranking references; providers are reordered by model match count with these sources as reference.",
    updatedAt: "Update date: {updatedAt}",
    showUpdatedAt: true,
    selectTop: "Select current {count}",
    clear: "Clear",
    refresh: "Refresh scan",
    statusPanelAria: "Selected provider API key status",
    providerHeader: "Provider",
    envHeader: "Environment variable",
    statusHeader: "Status",
    valueHeader: "Value",
    actionHeader: "Action",
    checkingHelper: "Checking helper...",
    helperConnected: "Local helper: Connected",
    helperDisconnected: "Local helper: Not connected",
    localMode:
      "Local helper mode is active. You can scan whether API keys exist; new keys are turned into terminal commands for you to paste manually.",
    pagesMode:
      "GitHub Pages mode is active. Browser security blocks local scanning, so the app will generate copyable shell commands instead.",
    remoteHelperBlocked: "The remote page may not be able to reach the local helper directly.",
    openLocalApp: "Open local app",
    catalogLabel: "Catalog",
    catalogCurated: "Built-in curated fallback",
    sentenceEnd: ".",
    doubleClickHint: "Double-click a provider to show or hide found API keys",
    statusFound: "found",
    statusMissing: "missing",
    statusHelperRequired: "helper required",
    statusUnknown: "unknown",
    enterPlaceholder: "Enter",
    show: "Show",
    hide: "Hide",
    masked: "masked",
    openTerminal: "Open terminal",
    terminalUnavailable: "Local helper is required to open a terminal.",
    terminalOpenFailed: "Unable to open terminal.",
    terminalOpened: "Terminal opened.",
    macCommand: "macOS / zsh",
    windowsCommand: "Windows PowerShell",
    macDisplayCommand: "macOS show",
    windowsDisplayCommand: "Windows show",
    copyMacCommand: "Copy macOS",
    copyWindowsCommand: "Copy Windows",
    save: "Copy command",
    copyCommand: "Copy command",
    emptyState: "Select at least one provider to inspect API key variables.",
    enterValueFirst: "Enter a value for",
    copiedSetupCommand: "Copied setup command for",
    unableToScan: "Unable to scan API keys.",
  },
};

function t(key) {
  return messages[state.language][key];
}

function formatMessage(key, values = {}) {
  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, value),
    t(key),
  );
}

function catalogText() {
  return t("catalogCurated");
}

function renderProviderHelp() {
  providerHelp.replaceChildren();
  providerHelp.append(
    formatMessage("providerHelp", {
      count: state.providerLimit,
    }),
  );

  if (t("showUpdatedAt")) {
    const updatedAt = document.createElement("strong");
    updatedAt.className = "updated-at";
    updatedAt.textContent = formatMessage("updatedAt", { updatedAt: formatUpdatedAt() });
    providerHelp.append(updatedAt, t("sentenceEnd"));
  }
}

function visibleProviders() {
  return state.providers
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, state.providerLimit);
}

function statusText(status) {
  if (status === "found") return t("statusFound");
  if (status === "missing") return t("statusMissing");
  return t("statusUnknown");
}

function maskKey(value) {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function shellExportValue(value) {
  return `"${String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`")}"`;
}

function buildExportCommand(envVar, value) {
  const exportLine = `export ${envVar}=${shellExportValue(value)}`;
  return exportLine;
}

function powerShellValue(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildWindowsCommand(envVar, value) {
  return `$env:${envVar} = ${powerShellValue(value)}`;
}

function buildMacDisplayCommand(envVar) {
  return `printf '%s\\n' "$${envVar}"`;
}

function buildWindowsDisplayCommand(envVar) {
  return `Write-Output $env:${envVar}`;
}

function commandForPlatform(platform, envVar) {
  const value = state.inputValues[envVar] || "";
  if (platform === "windows") {
    return buildWindowsCommand(envVar, value);
  }
  return buildExportCommand(envVar, value);
}

function displayCommandForPlatform(platform, envVar) {
  if (platform === "windows") {
    return buildWindowsDisplayCommand(envVar);
  }
  return buildMacDisplayCommand(envVar);
}

function preferredCommandPlatform() {
  const platform = `${navigator.userAgentData?.platform || ""} ${navigator.platform || ""}`;
  return /win/i.test(platform) ? "windows" : "mac";
}

function renderCommandGrid(envVar, commands) {
  const commandGrid = document.createElement("div");
  commandGrid.className = "command-grid";

  for (const command of commands) {
    const commandBox = document.createElement("div");
    commandBox.className = "command-box";
    const commandHeader = document.createElement("div");
    commandHeader.className = "command-header";
    const label = document.createElement("span");
    label.textContent = command.label;
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "secondary compact";
    copyButton.textContent = command.buttonText;
    if (command.kind === "display") {
      copyButton.dataset.copyDisplayPlatform = command.platform;
      copyButton.dataset.copyDisplayEnv = envVar;
    } else {
      copyButton.dataset.copyCommandPlatform = command.platform;
      copyButton.dataset.copyCommandEnv = envVar;
    }
    const code = document.createElement("code");
    code.className = "terminal-command";
    code.dataset.commandTextPlatform = command.platform;
    code.dataset.commandTextEnv = envVar;
    code.textContent = command.text;
    commandHeader.append(label, copyButton);
    commandBox.append(commandHeader, code);
    commandGrid.append(commandBox);
  }

  return commandGrid;
}

function helperPort() {
  const params = new URLSearchParams(window.location.search);
  const port = params.get("helperPort") || defaultHelperPort;
  return /^\d{2,5}$/.test(port) ? port : defaultHelperPort;
}

function helperToken() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  const token = params.get("helperToken") || "";
  return /^[A-Za-z0-9_-]{32,}$/.test(token) ? token : "";
}

function helperHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-Key-Checker-Token": state.helperToken,
  };
}

function helperCandidates() {
  const port = helperPort();
  const origins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
  return [...new Set(origins)];
}

function localAppUrl() {
  return `http://localhost:5173/?helperPort=${helperPort()}`;
}

function isRemotePage() {
  return window.location.protocol === "https:" && window.location.hostname.endsWith("github.io");
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const { timeoutMs = 1500, ...fetchOptions } = options;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function formatUpdatedAt() {
  return state.catalogUpdatedAt.toLocaleString(state.language === "zh" ? "zh-TW" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadPublicProviderCatalog() {
  state.providers = curatedProviders;
  state.catalogSource = "curated";
  state.catalogModelCount = 0;
  state.catalogUpdatedAt = new Date("2026-07-05T00:00:00+08:00");
}

function getSelectedProviders() {
  const selectedIds = Array.from(providerSelect.selectedOptions).map((option) => option.value);
  return visibleProviders().filter((provider) => selectedIds.includes(provider.id));
}

function getSelectedEnvVars() {
  return [...new Set(getSelectedProviders().flatMap((provider) => provider.envVars))];
}

function setHelperStatus(connected) {
  state.helperConnected = connected;
  helperStatus.classList.toggle("connected", connected);
  helperStatus.classList.toggle("disconnected", !connected);
  helperStatus.replaceChildren();

  const dot = document.createElement("span");
  dot.className = "status-dot";
  const label = document.createElement("span");
  label.textContent = connected ? t("helperConnected") : t("helperDisconnected");
  helperStatus.append(dot, label);

  renderModeNotice(connected);
}

function renderModeNotice(connected) {
  modeNotice.replaceChildren();
  const modeText = document.createElement("span");
  modeText.textContent = `${connected ? t("localMode") : t("pagesMode")} ${t(
    "catalogLabel",
  )}: ${catalogText()}${t("sentenceEnd")}`;
  modeNotice.append(modeText);

  if (!connected && isRemotePage()) {
    const remoteHint = document.createElement("span");
    remoteHint.textContent = ` ${t("remoteHelperBlocked")}`;
    const localLink = document.createElement("a");
    localLink.className = "notice-action";
    localLink.href = localAppUrl();
    localLink.textContent = t("openLocalApp");
    modeNotice.append(remoteHint, localLink);
  }
}

function renderStaticText() {
  document.documentElement.lang = state.language === "zh" ? "zh-Hant" : "en";
  document.title = t("documentTitle");
  languageLabel.textContent = t("languageLabel");
  languageSelect.setAttribute("aria-label", t("languageLabel"));
  toolbarSection.setAttribute("aria-label", t("toolbarAria"));
  statusPanel.setAttribute("aria-label", t("statusPanelAria"));
  providerCountLabel.textContent = t("providerCountLabel");
  providerCountSelect.setAttribute("aria-label", t("providerCountLabel"));
  providerLabel.textContent = t("providerLabel");
  renderProviderHelp();
  selectTopButton.textContent = formatMessage("selectTop", { count: state.providerLimit });
  clearButton.textContent = t("clear");
  refreshButton.textContent = t("refresh");
  openTerminalButton.textContent = t("openTerminal");
  openTerminalButton.disabled = !state.helperConnected;
  providerHeader.textContent = t("providerHeader");
  envHeader.textContent = t("envHeader");
  statusHeader.textContent = t("statusHeader");
  valueHeader.textContent = t("valueHeader");
  actionHeader.textContent = t("actionHeader");
  setHelperStatus(state.helperConnected);
}

function renderProviders() {
  providerSelect.replaceChildren();

  for (const provider of visibleProviders()) {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = `${provider.rank}. ${provider.name}`;
    option.selected = false;
    if (provider.isMainlandChinaTop) {
      option.className = "mainland-top-provider";
    }
    providerSelect.append(option);
  }
}

function clearProviderSelection() {
  Array.from(providerSelect.options).forEach((option) => {
    option.selected = false;
  });
  state.scanResults = {};
  state.visibleKeys.clear();
}

function renderRows() {
  const providers = getSelectedProviders();

  statusRows.replaceChildren();

  for (const provider of providers) {
    for (const envVar of provider.envVars) {
      const result = state.scanResults[envVar] || { status: "unknown", value: "" };
      const inputValue = state.inputValues[envVar] || "";
      const isFound = result.status === "found";
      const shownValue = isFound ? result.maskedValue || maskKey(result.value) : "";
      const statusLabel = state.helperConnected ? statusText(result.status) : t("statusHelperRequired");
      const statusClass = state.helperConnected ? result.status : "unknown";

      const row = document.createElement("tr");
      row.dataset.providerId = provider.id;
      const providerCell = document.createElement("td");
      providerCell.className = "provider-cell";
      if (provider.isMainlandChinaTop) {
        providerCell.classList.add("mainland-top-provider");
      }
      providerCell.title = t("doubleClickHint");
      const providerName = document.createElement("strong");
      providerName.textContent = provider.name;
      providerCell.append(providerName);

      const envCell = document.createElement("td");
      const envCode = document.createElement("code");
      envCode.textContent = envVar;
      envCell.append(envCode);

      const statusCell = document.createElement("td");
      const statusPill = document.createElement("span");
      statusPill.className = `pill ${statusClass}`;
      statusPill.textContent = statusLabel;
      statusCell.append(statusPill);

      const valueCell = document.createElement("td");
      if (isFound) {
        const valueText = document.createElement("span");
        valueText.className = "key-value";
        valueText.textContent = shownValue;
        const commandGrid = renderCommandGrid(envVar, [
          {
            kind: "display",
            platform: "mac",
            label: t("macDisplayCommand"),
            text: buildMacDisplayCommand(envVar),
            buttonText: t("copyMacCommand"),
          },
          {
            kind: "display",
            platform: "windows",
            label: t("windowsDisplayCommand"),
            text: buildWindowsDisplayCommand(envVar),
            buttonText: t("copyWindowsCommand"),
          },
        ]);
        valueCell.append(valueText, commandGrid);
      } else {
        const input = document.createElement("input");
        input.className = "key-input";
        input.dataset.envInput = envVar;
        input.type = "password";
        input.autocomplete = "off";
        input.placeholder = `${t("enterPlaceholder")} ${envVar}`;
        input.value = inputValue;
        const commandGrid = renderCommandGrid(envVar, [
          {
            kind: "set",
            platform: "mac",
            label: t("macCommand"),
            text: buildExportCommand(envVar, inputValue),
            buttonText: t("copyMacCommand"),
          },
          {
            kind: "set",
            platform: "windows",
            label: t("windowsCommand"),
            text: buildWindowsCommand(envVar, inputValue),
            buttonText: t("copyWindowsCommand"),
          },
        ]);

        valueCell.append(input, commandGrid);
      }

      const actionCell = document.createElement("td");
      const actionButton = document.createElement("button");
      actionButton.type = "button";
      if (isFound) {
        actionButton.className = "secondary hidden-action";
        actionButton.disabled = true;
        actionButton.setAttribute("aria-hidden", "true");
      } else {
        actionButton.dataset.copyKey = envVar;
        actionButton.textContent = state.helperConnected ? t("save") : t("copyCommand");
      }
      actionCell.append(actionButton);

      row.append(providerCell, envCell, statusCell, valueCell, actionCell);
      statusRows.append(row);
    }
  }

  if (providers.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty-state";
    cell.textContent = t("emptyState");
    row.append(cell);
    statusRows.append(row);
  }
}

function toggleProviderKeys(providerId) {
  const provider = state.providers.find((candidate) => candidate.id === providerId);
  if (!provider) {
    return;
  }

  const foundEnvVars = provider.envVars.filter(
    (envVar) => state.scanResults[envVar]?.status === "found",
  );
  if (foundEnvVars.length === 0) {
    return;
  }

  const shouldShow = foundEnvVars.some((envVar) => !state.visibleKeys.has(envVar));
  for (const envVar of foundEnvVars) {
    if (shouldShow) {
      state.visibleKeys.add(envVar);
    } else {
      state.visibleKeys.delete(envVar);
    }
  }
  renderRows();
}

async function checkHelper() {
  state.helperToken = helperToken();
  if (!state.helperToken) {
    state.helperBaseUrl = "";
    setHelperStatus(false);
    return;
  }

  for (const candidate of helperCandidates()) {
    try {
      const response = await fetchWithTimeout(`${candidate}/health`, {
        cache: "no-store",
        headers: helperHeaders(),
      });
      if (response.ok) {
        state.helperBaseUrl = candidate;
        setHelperStatus(true);
        return;
      }
    } catch {
      // Try the next loopback hostname before falling back to GitHub Pages mode.
    }
  }

  state.helperBaseUrl = "";
  setHelperStatus(false);
}

async function scanKeys() {
  if (!state.helperConnected) {
    state.scanResults = {};
    renderRows();
    return;
  }

  const envVars = getSelectedEnvVars();
  if (envVars.length === 0) {
    state.scanResults = {};
    renderRows();
    return;
  }

  const response = await fetchWithTimeout(`${state.helperBaseUrl}/api/check`, {
    method: "POST",
    headers: helperHeaders(),
    body: JSON.stringify({ envVars }),
  });

  if (!response.ok) {
    throw new Error(t("unableToScan"));
  }

  state.scanResults = await response.json();
  renderRows();
}

async function copySetupCommand(envVar) {
  const value = state.inputValues[envVar] || "";
  if (!value.trim()) {
    alert(`${t("enterValueFirst")} ${envVar}。`);
    return;
  }

  await navigator.clipboard.writeText(buildExportCommand(envVar, value));
  alert(`${t("copiedSetupCommand")} ${envVar}。`);
}

async function copyTerminalCommand(envVar, platform) {
  const value = state.inputValues[envVar] || "";
  if (!value.trim()) {
    alert(`${t("enterValueFirst")} ${envVar}。`);
    return;
  }

  await navigator.clipboard.writeText(commandForPlatform(platform, envVar));
  alert(`${t("copiedSetupCommand")} ${envVar}。`);
}

async function copyDisplayCommand(envVar, platform = preferredCommandPlatform()) {
  await navigator.clipboard.writeText(displayCommandForPlatform(platform, envVar));
  alert(`${t("copiedSetupCommand")} ${envVar}。`);
}

async function openTerminal() {
  if (!state.helperConnected) {
    alert(t("terminalUnavailable"));
    return;
  }

  const response = await fetchWithTimeout(`${state.helperBaseUrl}/api/open-terminal`, {
    method: "POST",
    headers: helperHeaders(),
  });

  if (!response.ok) {
    throw new Error(t("terminalOpenFailed"));
  }

  alert(t("terminalOpened"));
}

function bindEvents() {
  providerSelect.addEventListener("change", () => {
    scanKeys().catch((error) => alert(error.message));
    renderRows();
  });

  selectTopButton.addEventListener("click", () => {
    Array.from(providerSelect.options).forEach((option) => {
      option.selected = true;
    });
    scanKeys().catch((error) => alert(error.message));
    renderRows();
  });

  clearButton.addEventListener("click", () => {
    clearProviderSelection();
    renderRows();
  });

  refreshButton.addEventListener("click", async () => {
    await loadPublicProviderCatalog();
    clearProviderSelection();
    renderProviders();
    renderStaticText();
    await checkHelper();
    await scanKeys();
  });

  openTerminalButton.addEventListener("click", () => {
    openTerminal().catch((error) => alert(error.message));
  });

  languageSelect.addEventListener("change", () => {
    state.language = languageSelect.value;
    renderStaticText();
    renderRows();
  });

  providerCountSelect.addEventListener("change", () => {
    state.providerLimit = Number(providerCountSelect.value);
    clearProviderSelection();
    renderStaticText();
    renderProviders();
    renderRows();
  });

  statusRows.addEventListener("input", (event) => {
    const envVar = event.target.dataset.envInput;
    if (envVar) {
      state.inputValues[envVar] = event.target.value;
      const row = event.target.closest("tr");
      if (row) {
        for (const code of row.querySelectorAll(`[data-command-text-env="${envVar}"]`)) {
          code.textContent = commandForPlatform(code.dataset.commandTextPlatform, envVar);
        }
      }
    }
  });

  statusRows.addEventListener("click", (event) => {
    const toggleKey = event.target.dataset.toggleKey;
    const copyEnvVar = event.target.dataset.copyKey;
    const copyCommandEnv = event.target.dataset.copyCommandEnv;
    const copyCommandPlatform = event.target.dataset.copyCommandPlatform;
    const copyDisplayEnv = event.target.dataset.copyDisplayEnv;
    const copyDisplayPlatform = event.target.dataset.copyDisplayPlatform;

    if (toggleKey) {
      if (state.visibleKeys.has(toggleKey)) {
        state.visibleKeys.delete(toggleKey);
      } else {
        state.visibleKeys.add(toggleKey);
      }
      renderRows();
    }

    if (copyEnvVar) {
      copySetupCommand(copyEnvVar).catch((error) => alert(error.message));
    }

    if (copyCommandEnv && copyCommandPlatform) {
      copyTerminalCommand(copyCommandEnv, copyCommandPlatform).catch((error) =>
        alert(error.message),
      );
    }

    if (copyDisplayEnv && copyDisplayPlatform) {
      copyDisplayCommand(copyDisplayEnv, copyDisplayPlatform).catch((error) =>
        alert(error.message),
      );
    }
  });

  statusRows.addEventListener("dblclick", (event) => {
    const row = event.target.closest("tr[data-provider-id]");
    if (row) {
      toggleProviderKeys(row.dataset.providerId);
    }
  });
}

async function init() {
  state.providerLimit = Number(providerCountSelect.value);
  await loadPublicProviderCatalog();
  renderStaticText();
  renderProviders();
  clearProviderSelection();
  bindEvents();
  await checkHelper();
  await scanKeys();
  renderRows();
}

init();
