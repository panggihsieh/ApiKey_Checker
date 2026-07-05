import { curatedProviders } from "./providers.js?v=20260705-provider-count";

const defaultHelperPort = "8787";
const eyebrowText = document.querySelector("#eyebrowText");
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
  catalogUpdatedAt: "2026-07-05",
  helperConnected: false,
  helperBaseUrl: "",
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
    providerCountLabel: "供應商數量",
    providerHelp:
      "{count} 家資料來源：即時公開來源 OpenRouter Models ＆ Artificial Analysis LLM Leaderboard ＆LMArena / Arena Leaderboard 依照模型命中數並重新排序。",
    liveSourceSummary:
      "即時公開來源 OpenRouter Models API（已載入 {modelCount} 個模型）；參考來源 Artificial Analysis LLM Leaderboard、LMArena / Arena Leaderboard；fallback 來源 src/providers.js",
    curatedSourceSummary:
      "即時公開來源載入失敗或不可用，使用 fallback 來源 src/providers.js；參考來源 Artificial Analysis LLM Leaderboard、LMArena / Arena Leaderboard",
    updatedAt: "更新時間：{updatedAt}",
    showUpdatedAt: false,
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
      "本機 helper 模式已啟用。你可以掃描並儲存這台電腦上的 API key。",
    pagesMode:
      "GitHub Pages 模式已啟用。瀏覽器安全限制會阻擋本機掃描，因此此模式會產生可複製的 shell 指令。",
    remoteHelperBlocked: "遠端頁可能無法直接連到本機 helper。",
    openLocalApp: "開啟本機版",
    catalogLabel: "Catalog",
    catalogOpenRouter: "OpenRouter 即時公開模型 catalog",
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
    providerCountLabel: "Provider count",
    providerHelp:
      "Source for the {count} providers: {sourceSummary}. Display logic: the public model catalog is used to score built-in providers by model matches, providers without matches keep their built-in rank, selected providers expand to env vars, only local environment variables are scanned, and no model inference endpoint is called.",
    liveSourceSummary:
      "live public source OpenRouter Models API ({modelCount} models loaded); reference sources Artificial Analysis LLM Leaderboard and LMArena / Arena Leaderboard; fallback source src/providers.js",
    curatedSourceSummary:
      "live public source failed or is unavailable, using fallback source src/providers.js; reference sources Artificial Analysis LLM Leaderboard and LMArena / Arena Leaderboard",
    updatedAt: "Updated: {updatedAt}",
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
    localMode: "Local helper mode is active. You can scan and save API keys on this machine.",
    pagesMode:
      "GitHub Pages mode is active. Browser security blocks local scanning, so the app will generate copyable shell commands instead.",
    remoteHelperBlocked: "The remote page may not be able to reach the local helper directly.",
    openLocalApp: "Open local app",
    catalogLabel: "Catalog",
    catalogOpenRouter: "OpenRouter live public model catalog",
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

function formatMessage(key, values = {}) {
  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, value),
    t(key),
  );
}

function catalogText() {
  return state.catalogSource === "openrouter" ? t("catalogOpenRouter") : t("catalogCurated");
}

function renderProviderHelp() {
  providerHelp.replaceChildren();
  const sourceSummaryKey =
    state.catalogSource === "openrouter" ? "liveSourceSummary" : "curatedSourceSummary";
  const sourceSummary = formatMessage(sourceSummaryKey, {
    modelCount: state.catalogModelCount,
  });
  providerHelp.append(
    formatMessage("providerHelp", {
      count: state.providerLimit,
      sourceSummary,
    }),
  );

  if (t("showUpdatedAt")) {
    const updatedAt = document.createElement("strong");
    updatedAt.className = "updated-at";
    updatedAt.textContent = formatMessage("updatedAt", { updatedAt: state.catalogUpdatedAt });
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

function helperPort() {
  const params = new URLSearchParams(window.location.search);
  const port = params.get("helperPort") || defaultHelperPort;
  return /^\d{2,5}$/.test(port) ? port : defaultHelperPort;
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

const providerMatchAliases = {
  openai: ["openai", "gpt"],
  anthropic: ["anthropic", "claude"],
  google: ["google", "gemini"],
  deepseek: ["deepseek"],
  xai: ["x-ai", "xai", "grok"],
  mistral: ["mistral"],
  cohere: ["cohere", "command"],
  meta: ["meta", "llama"],
  alibaba: ["alibaba", "qwen", "dashscope"],
  baidu: ["baidu", "ernie", "qianfan"],
  moonshot: ["moonshot", "kimi"],
  zhipu: ["zhipu", "glm"],
  openrouter: ["openrouter"],
  perplexity: ["perplexity", "sonar"],
  together: ["together"],
  groq: ["groq"],
  fireworks: ["fireworks"],
  replicate: ["replicate"],
  huggingface: ["huggingface", "hugging face"],
  "azure-openai": ["azure"],
  "vertex-ai": ["vertex"],
  nvidia: ["nvidia", "nim"],
  ai21: ["ai21", "jamba"],
  stability: ["stability"],
  runway: ["runway"],
  minimax: ["minimax"],
  bytedance: ["bytedance", "doubao", "volcengine"],
  tencent: ["tencent", "hunyuan"],
  baichuan: ["baichuan"],
};

function currentTimestamp() {
  return new Date().toLocaleString(state.language === "zh" ? "zh-TW" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreProvidersFromOpenRouterModels(models) {
  const scores = Object.fromEntries(curatedProviders.map((provider) => [provider.id, 0]));

  for (const model of models) {
    const searchable = `${model.id || ""} ${model.name || ""}`.toLowerCase();
    for (const [providerId, aliases] of Object.entries(providerMatchAliases)) {
      if (aliases.some((alias) => searchable.includes(alias))) {
        scores[providerId] += 1;
      }
    }
  }

  return [...curatedProviders]
    .map((provider) => ({
      ...provider,
      liveModelMatches: scores[provider.id] || 0,
    }))
    .sort((a, b) => b.liveModelMatches - a.liveModelMatches || a.rank - b.rank)
    .map((provider, index) => ({
      ...provider,
      rank: index + 1,
    }));
}

async function loadPublicProviderCatalog() {
  try {
    const response = await fetchWithTimeout("https://openrouter.ai/api/v1/models", {
      cache: "no-store",
      timeoutMs: 3500,
    });
    if (!response.ok) {
      throw new Error("OpenRouter catalog is unavailable.");
    }

    const payload = await response.json();
    const models = Array.isArray(payload.data) ? payload.data : [];
    if (models.length === 0) {
      throw new Error("OpenRouter catalog returned no models.");
    }

    state.providers = scoreProvidersFromOpenRouterModels(models);
    state.catalogSource = "openrouter";
    state.catalogModelCount = models.length;
    state.catalogUpdatedAt = currentTimestamp();
  } catch {
    state.providers = curatedProviders;
    state.catalogSource = "curated";
    state.catalogModelCount = 0;
    state.catalogUpdatedAt = "2026-07-05";
  }
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
  eyebrowText.textContent = t("eyebrow");
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
      const isVisible = state.visibleKeys.has(envVar);
      const shownValue = isFound ? (isVisible ? result.value : maskKey(result.value)) : "";
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
  for (const candidate of helperCandidates()) {
    try {
      const response = await fetchWithTimeout(`${candidate}/health`, { cache: "no-store" });
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

  const response = await fetchWithTimeout(`${state.helperBaseUrl}/api/save`, {
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
    await loadPublicProviderCatalog();
    clearProviderSelection();
    renderProviders();
    renderStaticText();
    await checkHelper();
    await scanKeys();
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
