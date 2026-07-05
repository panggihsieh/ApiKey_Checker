import { curatedProviders } from "./providers.js";

const helperBaseUrl = "http://localhost:8787";
const providerSelect = document.querySelector("#providerSelect");
const statusRows = document.querySelector("#statusRows");
const helperStatus = document.querySelector("#helperStatus");
const modeNotice = document.querySelector("#modeNotice");
const selectTopButton = document.querySelector("#selectTopButton");
const clearButton = document.querySelector("#clearButton");
const refreshButton = document.querySelector("#refreshButton");

const state = {
  providers: curatedProviders,
  catalogSource: "Curated fallback",
  helperConnected: false,
  scanResults: {},
  visibleKeys: new Set(),
  inputValues: {},
};

const providerSignals = {
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
};

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
  helperStatus.innerHTML = `<span class="status-dot"></span><span>Local helper: ${
    connected ? "Connected" : "Not connected"
  }</span>`;
  modeNotice.textContent = connected
    ? "Local helper mode is active. You can scan and save API keys on this machine."
    : "GitHub Pages mode is active. Browser security blocks local scanning, so the app will generate copyable shell commands instead.";
  modeNotice.textContent += ` Catalog: ${state.catalogSource}.`;
}

function renderProviders() {
  providerSelect.replaceChildren();

  for (const provider of state.providers) {
    const option = document.createElement("option");
    option.value = provider.id;
    option.selected = true;
    option.textContent = `${provider.rank}. ${provider.name}`;
    providerSelect.append(option);
  }
}

async function loadProviderCatalog() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("OpenRouter catalog is unavailable.");
    }

    const payload = await response.json();
    const models = Array.isArray(payload.data) ? payload.data : [];
    const scores = Object.fromEntries(curatedProviders.map((provider) => [provider.id, 0]));

    for (const model of models) {
      const searchable = `${model.id || ""} ${model.name || ""}`.toLowerCase();
      for (const [providerId, signals] of Object.entries(providerSignals)) {
        if (signals.some((signal) => searchable.includes(signal))) {
          scores[providerId] += 1;
        }
      }
    }

    state.providers = [...curatedProviders]
      .sort((a, b) => scores[b.id] - scores[a.id] || a.rank - b.rank)
      .map((provider, index) => ({
        ...provider,
        rank: index + 1,
      }));
    state.catalogSource = "OpenRouter live model catalog";
  } catch {
    state.providers = curatedProviders;
    state.catalogSource = "Curated fallback";
  } finally {
    window.clearTimeout(timeout);
  }
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
      const statusLabel = state.helperConnected ? result.status : "helper required";
      const statusClass = state.helperConnected ? result.status : "unknown";

      const row = document.createElement("tr");
      const providerCell = document.createElement("td");
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
        input.placeholder = `Enter ${envVar}`;
        input.value = inputValue;
        valueCell.append(input);
      }

      const actionCell = document.createElement("td");
      const actionButton = document.createElement("button");
      actionButton.type = "button";
      if (isFound) {
        actionButton.className = "secondary";
        actionButton.dataset.toggleKey = envVar;
        actionButton.textContent = isVisible ? "Hide" : "Show";
      } else {
        actionButton.dataset.saveKey = envVar;
        actionButton.textContent = state.helperConnected ? "Save" : "Copy command";
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
    cell.textContent = "Select at least one provider to inspect API key variables.";
    row.append(cell);
    statusRows.append(row);
  }
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
    throw new Error("Unable to scan API keys.");
  }

  state.scanResults = await response.json();
  renderRows();
}

async function saveKey(envVar) {
  const value = state.inputValues[envVar] || "";
  if (!value.trim()) {
    alert(`Enter a value for ${envVar} first.`);
    return;
  }

  if (!state.helperConnected) {
    const command = buildProfileAppendCommand(envVar, value);
    await navigator.clipboard.writeText(command);
    alert(`Copied setup command for ${envVar}.`);
    return;
  }

  const response = await fetch(`${helperBaseUrl}/api/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envVar, value }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Unable to save ${envVar}.`);
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
    Array.from(providerSelect.options).forEach((option) => {
      option.selected = false;
    });
    state.scanResults = {};
    renderRows();
  });

  refreshButton.addEventListener("click", async () => {
    await checkHelper();
    await scanKeys();
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
}

async function init() {
  await loadProviderCatalog();
  renderProviders();
  bindEvents();
  await checkHelper();
  await scanKeys();
  renderRows();
}

init();
