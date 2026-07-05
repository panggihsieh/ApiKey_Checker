import { curatedProviders } from "./providers.js";

const helperBaseUrl = "http://127.0.0.1:8787";
const eyebrowText = document.querySelector("#eyebrowText");
const languageLabel = document.querySelector("#languageLabel");
const languageSelect = document.querySelector("#languageSelect");
const providerSelect = document.querySelector("#providerSelect");
const providerLabel = document.querySelector("#providerLabel");
const providerHelp = document.querySelector("#providerHelp");
const statusRows = document.querySelector("#statusRows");
const helperStatus = document.querySelector("#helperStatus");
const modeNotice = document.querySelector("#modeNotice");
const toolbarSection = document.querySelector("#toolbarSection");
const statusPanel = document.querySelector("#statusPanel");
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
  catalogSource: "curated",
  helperConnected: false,
  scanResults: {},
  visibleKeys: new Set(),
  inputValues: {},
};

const messages = {
  zh: {
    documentTitle: "API Key Checker",
    eyebrow: "本機 + GitHub Pages 可用",
    languageLabel: "介面語言",
    toolbarAria: "供應商控制",
    providerLabel: "供應商",
    providerHelp:
      "12 家資料來源：依主流 LLM API 供應商（OpenAI、Anthropic Claude、Google Gemini）與常見環境變數命名整理，依內建 rank 排序；更新時間：2026-07-05。",
    selectTop: "選取精選 12 家",
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
      "本機 helper 模式已啟用。你可以掃描並儲存這台電腦上的 API key。",
    pagesMode:
      "GitHub Pages 模式已啟用。瀏覽器安全限制會阻擋本機掃描，因此此模式會產生可複製的 shell 指令。",
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
    save: "儲存",
    copyCommand: "複製指令",
    emptyState: "請至少選擇一個供應商來檢查 API key 環境變數。",
    enterValueFirst: "請先輸入",
    copiedSetupCommand: "已複製設定指令：",
    unableToScan: "無法掃描 API key。",
    unableToSave: "無法儲存",
  },
  en: {
    documentTitle: "API Key Checker",
    eyebrow: "Local + GitHub Pages ready",
    languageLabel: "Language",
    toolbarAria: "Provider controls",
    providerLabel: "Providers",
    providerHelp:
      "Source for the 12 providers: a built-in curated list in src/providers.js, mapped from mainstream LLM API providers to common environment variable names. Display logic: providers are sorted by built-in rank, selected providers expand to env vars, only local environment variables are scanned, and no model provider is contacted. Updated: 2026-07-05.",
    selectTop: "Select curated 12",
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
    localMode: "Local helper mode is active. You can scan and save API keys on this machine.",
    pagesMode:
      "GitHub Pages mode is active. Browser security blocks local scanning, so the app will generate copyable shell commands instead.",
    catalogLabel: "Catalog",
    catalogCurated: "Built-in curated list; no model providers are contacted",
    sentenceEnd: ".",
    doubleClickHint: "Double-click a provider to show or hide found API keys",
    statusFound: "found",
    statusMissing: "missing",
    statusHelperRequired: "helper required",
    statusUnknown: "unknown",
    enterPlaceholder: "Enter",
    show: "Show",
    hide: "Hide",
    save: "Save",
    copyCommand: "Copy command",
    emptyState: "Select at least one provider to inspect API key variables.",
    enterValueFirst: "Enter a value for",
    copiedSetupCommand: "Copied setup command for",
    unableToScan: "Unable to scan API keys.",
    unableToSave: "Unable to save",
  },
};

function t(key) {
  return messages[state.language][key];
}

function catalogText() {
  return t("catalogCurated");
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

function shellQuote(value) {
  return String(value).replace(/'/g, "'\\''");
}

function shellExportValue(value) {
  return `"${String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`")}"`;
}

function buildProfileAppendCommand(envVar, value) {
  const exportLine = `export ${envVar}=${shellExportValue(value)}`;
  return `printf '%s\\n' '${shellQuote(exportLine)}' >> ~/.zshrc`;
}

function getSelectedProviders() {
  const selectedIds = Array.from(providerSelect.selectedOptions).map((option) => option.value);
  return state.providers.filter((provider) => selectedIds.includes(provider.id));
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

  modeNotice.textContent = `${connected ? t("localMode") : t("pagesMode")} ${t(
    "catalogLabel",
  )}: ${catalogText()}${t("sentenceEnd")}`;
}

function renderStaticText() {
  document.documentElement.lang = state.language === "zh" ? "zh-Hant" : "en";
  document.title = t("documentTitle");
  eyebrowText.textContent = t("eyebrow");
  languageLabel.textContent = t("languageLabel");
  languageSelect.setAttribute("aria-label", t("languageLabel"));
  toolbarSection.setAttribute("aria-label", t("toolbarAria"));
  statusPanel.setAttribute("aria-label", t("statusPanelAria"));
  providerLabel.textContent = t("providerLabel");
  providerHelp.textContent = t("providerHelp");
  selectTopButton.textContent = t("selectTop");
  clearButton.textContent = t("clear");
  refreshButton.textContent = t("refresh");
  providerHeader.textContent = t("providerHeader");
  envHeader.textContent = t("envHeader");
  statusHeader.textContent = t("statusHeader");
  valueHeader.textContent = t("valueHeader");
  actionHeader.textContent = t("actionHeader");
  setHelperStatus(state.helperConnected);
}

function renderProviders() {
  providerSelect.replaceChildren();

  for (const provider of state.providers) {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = `${provider.rank}. ${provider.name}`;
    option.selected = false;
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
      const isVisible = state.visibleKeys.has(envVar);
      const shownValue = isFound ? (isVisible ? result.value : maskKey(result.value)) : "";
      const statusLabel = state.helperConnected ? statusText(result.status) : t("statusHelperRequired");
      const statusClass = state.helperConnected ? result.status : "unknown";

      const row = document.createElement("tr");
      row.dataset.providerId = provider.id;
      const providerCell = document.createElement("td");
      providerCell.className = "provider-cell";
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
        valueCell.append(valueText);
      } else {
        const input = document.createElement("input");
        input.className = "key-input";
        input.dataset.envInput = envVar;
        input.type = "password";
        input.autocomplete = "off";
        input.placeholder = `${t("enterPlaceholder")} ${envVar}`;
        input.value = inputValue;
        valueCell.append(input);
      }

      const actionCell = document.createElement("td");
      const actionButton = document.createElement("button");
      actionButton.type = "button";
      if (isFound) {
        actionButton.className = "secondary";
        actionButton.dataset.toggleKey = envVar;
        actionButton.textContent = isVisible ? t("hide") : t("show");
      } else {
        actionButton.dataset.saveKey = envVar;
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
  try {
    const response = await fetch(`${helperBaseUrl}/health`, { cache: "no-store" });
    setHelperStatus(response.ok);
  } catch {
    setHelperStatus(false);
  }
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

  const response = await fetch(`${helperBaseUrl}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envVars }),
  });

  if (!response.ok) {
    throw new Error(t("unableToScan"));
  }

  state.scanResults = await response.json();
  renderRows();
}

async function saveKey(envVar) {
  const value = state.inputValues[envVar] || "";
  if (!value.trim()) {
    alert(`${t("enterValueFirst")} ${envVar}。`);
    return;
  }

  if (!state.helperConnected) {
    const command = buildProfileAppendCommand(envVar, value);
    await navigator.clipboard.writeText(command);
    alert(`${t("copiedSetupCommand")} ${envVar}。`);
    return;
  }

  const response = await fetch(`${helperBaseUrl}/api/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envVar, value }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `${t("unableToSave")} ${envVar}.`);
  }

  state.inputValues[envVar] = "";
  await scanKeys();
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
    await checkHelper();
    await scanKeys();
  });

  languageSelect.addEventListener("change", () => {
    state.language = languageSelect.value;
    renderStaticText();
    renderRows();
  });

  statusRows.addEventListener("input", (event) => {
    const envVar = event.target.dataset.envInput;
    if (envVar) {
      state.inputValues[envVar] = event.target.value;
    }
  });

  statusRows.addEventListener("click", (event) => {
    const toggleKey = event.target.dataset.toggleKey;
    const saveEnvVar = event.target.dataset.saveKey;

    if (toggleKey) {
      if (state.visibleKeys.has(toggleKey)) {
        state.visibleKeys.delete(toggleKey);
      } else {
        state.visibleKeys.add(toggleKey);
      }
      renderRows();
    }

    if (saveEnvVar) {
      saveKey(saveEnvVar).catch((error) => alert(error.message));
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
  renderStaticText();
  renderProviders();
  clearProviderSelection();
  bindEvents();
  await checkHelper();
  await scanKeys();
  renderRows();
}

init();
