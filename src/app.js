import { curatedProviders } from "./providers.js?v=20260705-provider-count";
import { rankProviders } from "./ranking.js?v=20260706-provider-score";

const defaultHelperPort = "8787";
const languageLabel = document.querySelector("#languageLabel");
const languageSelect = document.querySelector("#languageSelect");
const providerSelect = document.querySelector("#providerSelect");
const providerCountSelect = document.querySelector("#providerCountSelect");
const providerCountLabel = document.querySelector("#providerCountLabel");
const providerCountControl = document.querySelector(".header-provider-count");
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
const alphaSelect = document.querySelector("#alphaSelect");
const testMethodSelect = document.querySelector("#testMethodSelect");
const dataUpload = document.querySelector("#dataUpload");
const soundToggle = document.querySelector("#soundToggle");
const selectedMetric = document.querySelector("#selectedMetric");
const envMetric = document.querySelector("#envMetric");
const rateMetric = document.querySelector("#rateMetric");
const alphaMetric = document.querySelector("#alphaMetric");
const statusChart = document.querySelector("#statusChart");
const residualChart = document.querySelector("#residualChart");
const formulaBlock = document.querySelector("#formulaBlock code");
const exportSvgButton = document.querySelector("#exportSvgButton");
const exportCsvButton = document.querySelector("#exportCsvButton");
const countryPieChart = document.querySelector("#countryPieChart");
const countryPieLegend = document.querySelector("#countryPieLegend");
const countryPieTotal = document.querySelector("#countryPieTotal");

const state = {
  language: "zh",
  providers: curatedProviders,
  providerLimit: 12,
  catalogSource: "curated",
  catalogModelCount: 0,
  catalogUpdatedAt: new Date(),
  helperConnected: false,
  helperBaseUrl: "",
  helperToken: "",
  scanResults: {},
  visibleKeys: new Set(),
  inputValues: {},
  alpha: 0.05,
  testMethod: "binomial",
  uploadedDatasetName: "",
  soundEnabled: true,
};

const messages = {
  zh: {
    documentTitle: "API Key Checker",
    languageLabel: "介面語言",
    toolbarAria: "供應商控制",
    providerLabel: "供應商",
    providerCountLabel: "供應商數量",
    providerHelp:
      "{count} 家依 ProviderScore 排名：先用 Chatbot Arena / Elo 評估模型勝率，再用多維 benchmark 幾何平均補足能力面，最後取每家供應商 Top 3 模型平均分排序；資料不足時沿用內建基準排序。",
    updatedAt: "更新時間：{updatedAt}",
    showUpdatedAt: true,
    selectTop: "選取目前 {count} 家",
    clear: "清除",
    refresh: "重新掃描",
    statusPanelAria: "已選供應商 API key 狀態",
    providerHeader: "供應商",
    envHeader: "環境變數",
    statusHeader: "狀態",
    valueHeader: "值",
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
    statusMissingDetail: "本地無APIKEY 環境變數設定",
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
    saveApiKey: "儲存",
    savedApiKey: "已儲存環境變數：",
    saveApiKeyFailed: "無法儲存環境變數。",
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
      "{count} providers are ranked by ProviderScore: model strength is scored from Chatbot Arena / Elo plus the geometric mean of benchmark dimensions, then each provider is sorted by the average of its top 3 model scores; built-in rank is used when model data is incomplete.",
    updatedAt: "Updated at: {updatedAt}",
    showUpdatedAt: true,
    selectTop: "Select current {count}",
    clear: "Clear",
    refresh: "Refresh scan",
    statusPanelAria: "Selected provider API key status",
    providerHeader: "Provider",
    envHeader: "Environment variable",
    statusHeader: "Status",
    valueHeader: "Value",
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
    statusMissingDetail: "No local API key environment variable is set",
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
    saveApiKey: "Save",
    savedApiKey: "Saved environment variable:",
    saveApiKeyFailed: "Unable to save environment variable.",
    emptyState: "Select at least one provider to inspect API key variables.",
    enterValueFirst: "Enter a value for",
    copiedSetupCommand: "Copied setup command for",
    unableToScan: "Unable to scan API keys.",
  },
};

messages.zh = {
  documentTitle: "API Key Checker",
  languageLabel: "語言",
  toolbarAria: "Provider 控制項",
  providerLabel: "Providers",
  providerCountLabel: "Provider 數量",
  providerHelp:
    "依 ProviderScore 排名：先用 Chatbot Arena / Elo 評估模型勝率，再用多維 benchmark 幾何平均補足能力面，最後取每家供應商 Top 3 模型平均分排序；資料不足時沿用內建基準排序。",
  updatedAt: "更新時間：{updatedAt}",
  showUpdatedAt: true,
  selectTop: "選取目前 {count} 個",
  clear: "清除",
  refresh: "重新掃描",
  statusPanelAria: "已選 provider 的 API key 狀態",
  providerHeader: "Provider",
  envHeader: "環境變數",
  statusHeader: "狀態",
  valueHeader: "值",
  checkingHelper: "Checking helper...",
  helperConnected: "Local helper: 已連線",
  helperDisconnected: "Local helper: 未連線",
  localMode:
    "Local helper 模式啟用。系統可掃描 API key 是否存在，也可將新 key 儲存或轉成終端機指令。",
  pagesMode:
    "GitHub Pages 模式啟用。瀏覽器安全限制會阻擋本機掃描，因此系統會產生可複製的 shell 指令。",
  remoteHelperBlocked: "遠端頁面可能無法直接連到本機 helper。",
  openLocalApp: "開啟本機 App",
  catalogLabel: "Catalog",
  catalogCurated: "內建策展清單",
  sentenceEnd: "。",
  doubleClickHint: "雙擊 provider 可顯示或隱藏已找到的 API key",
  statusFound: "found",
  statusMissing: "missing",
  statusMissingDetail: "本地無APIKEY 環境變數設定",
  statusHelperRequired: "需要 helper",
  statusUnknown: "unknown",
  enterPlaceholder: "輸入",
  show: "顯示",
  hide: "隱藏",
  masked: "已遮蔽",
  openTerminal: "開啟終端機",
  terminalUnavailable: "需要 local helper 才能開啟終端機。",
  terminalOpenFailed: "無法開啟終端機。",
  terminalOpened: "終端機已開啟。",
  macCommand: "macOS / zsh",
  windowsCommand: "Windows PowerShell",
  macDisplayCommand: "macOS 顯示",
  windowsDisplayCommand: "Windows 顯示",
  copyMacCommand: "複製 macOS",
  copyWindowsCommand: "複製 Windows",
  saveApiKey: "儲存",
  savedApiKey: "已儲存環境變數：",
  saveApiKeyFailed: "無法儲存環境變數。",
  emptyState: "請至少選取一個 provider，以檢視 API key 環境變數。",
  enterValueFirst: "請先輸入",
  copiedSetupCommand: "已複製設定指令：",
  unableToScan: "無法掃描 API key。",
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
  return rankProviders(state.providers).slice(0, state.providerLimit);
}

const providerCountryById = {
  "ai21": "israel",
  "alibaba": "china",
  "aleph-alpha": "germany",
  "aws-bedrock": "usa",
  "baichuan": "china",
  "baidu": "china",
  "bytedance": "china",
  "cohere": "canada",
  "deepseek": "china",
  "huggingface": "usa",
  "iflytek": "china",
  "jina": "germany",
  "mistral": "france",
  "minimax": "china",
  "moonshot": "china",
  "qdrant": "germany",
  "stability": "uk",
  "tencent": "china",
  "weaviate": "netherlands",
  "zhipu": "china",
};

const countryDefinitions = {
  usa: { code: "US", flagClass: "flag-us", className: "provider-country-usa", zh: "美國", en: "United States" },
  china: { code: "CN", flagClass: "flag-cn", className: "provider-country-china", zh: "中國", en: "China" },
  japan: { code: "JP", flagClass: "flag-jp", className: "provider-country-japan", zh: "日本", en: "Japan" },
  france: { code: "FR", flagClass: "flag-fr", className: "provider-country-france", zh: "法國", en: "France" },
  germany: { code: "DE", flagClass: "flag-de", className: "provider-country-germany", zh: "德國", en: "Germany" },
  canada: { code: "CA", flagClass: "flag-ca", className: "provider-country-canada", zh: "加拿大", en: "Canada" },
  uk: { code: "UK", flagClass: "flag-gb", className: "provider-country-uk", zh: "英國", en: "United Kingdom" },
  israel: { code: "IL", flagClass: "flag-il", className: "provider-country-israel", zh: "以色列", en: "Israel" },
  netherlands: { code: "NL", flagClass: "flag-nl", className: "provider-country-netherlands", zh: "荷蘭", en: "Netherlands" },
  singapore: { code: "SG", flagClass: "flag-sg", className: "provider-country-singapore", zh: "新加坡", en: "Singapore" },
  korea: { code: "KR", flagClass: "flag-kr", className: "provider-country-korea", zh: "韓國", en: "Korea" },
  other: { code: "OTHER", flagClass: "flag-other", className: "provider-country-other", zh: "其他", en: "Other" },
};

function providerCountryKey(provider) {
  if (providerCountryById[provider.id]) {
    return providerCountryById[provider.id];
  }

  if (provider.isMainlandChinaTop) {
    return "china";
  }

  return "usa";
}

function providerCountryClass(provider) {
  return countryDefinitions[providerCountryKey(provider)]?.className || countryDefinitions.usa.className;
}

function providerCountry(provider) {
  const country = countryDefinitions[providerCountryKey(provider)] || countryDefinitions.usa;
  return {
    code: country.code,
    flagClass: country.flagClass,
    name: state.language === "zh" ? country.zh : country.en,
  };
}
function statusText(status) {
  if (status === "found") return t("statusFound");
  if (status === "missing") return `${t("statusMissing")}：${t("statusMissingDetail")}`;
  return t("statusUnknown");
}

function analysisRows() {
  return getSelectedProviders().flatMap((provider) =>
    provider.envVars.map((envVar) => {
      const result = state.scanResults[envVar] || { status: "unknown", value: "" };
      return {
        provider: provider.name,
        country: providerCountry(provider).code,
        envVar,
        status: state.helperConnected ? result.status : "helper-required",
        value: result.value || "",
      };
    }),
  );
}

function analysisCounts() {
  const rows = analysisRows();
  const selectedProviders = getSelectedProviders().length;
  const found = rows.filter((row) => row.status === "found").length;
  const missing = rows.filter((row) => row.status === "missing").length;
  const unknown = Math.max(0, rows.length - found - missing);
  const denominator = rows.length || 1;

  return {
    selectedProviders,
    envVars: rows.length,
    found,
    missing,
    unknown,
    keyRate: found / denominator,
  };
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function countryDistribution() {
  const providers = visibleProviders();
  const counts = new Map();

  for (const provider of providers) {
    const key = providerCountryKey(provider);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const total = providers.length || 1;
  const sorted = [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || countryDefinitions[a.key].code.localeCompare(countryDefinitions[b.key].code));
  const primary = sorted.slice(0, 10);
  const restCount = sorted.slice(10).reduce((sum, item) => sum + item.count, 0);

  if (restCount > 0) {
    primary.push({ key: "other", count: restCount });
  }

  return primary.map((item) => {
    const country = countryDefinitions[item.key] || countryDefinitions.other;
    return {
      ...item,
      code: country.code,
      flagClass: country.flagClass,
      label: state.language === "zh" ? country.zh : country.en,
      percent: item.count / total,
    };
  });
}

function pieSlicePath(cx, cy, radius, startAngle, endAngle) {
  const start = {
    x: cx + radius * Math.cos(startAngle),
    y: cy + radius * Math.sin(startAngle),
  };
  const end = {
    x: cx + radius * Math.cos(endAngle),
    y: cy + radius * Math.sin(endAngle),
  };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function renderCountryPie() {
  if (!countryPieChart || !countryPieLegend || !countryPieTotal) return;

  const distribution = countryDistribution();
  const total = visibleProviders().length;
  const colors = ["#2f6f73", "#9f3838", "#27548a", "#8a6212", "#276749", "#6b7280", "#7c6f56", "#4a6670", "#8b5e70", "#4f6f52", "#9ca3af"];
  let angle = -Math.PI / 2;

  countryPieChart.replaceChildren();
  countryPieLegend.replaceChildren();
  countryPieTotal.textContent = `${total} providers`;

  const centerCircle = svgElement("circle", {
    cx: 110,
    cy: 110,
    r: 42,
    class: "country-pie-hole",
  });

  distribution.forEach((item, index) => {
    const nextAngle = angle + item.percent * Math.PI * 2;
    const path = svgElement("path", {
      d: pieSlicePath(110, 110, 92, angle, nextAngle),
      fill: colors[index % colors.length],
      class: "country-pie-slice",
    });
    const title = svgElement("title");
    title.textContent = `${item.label} ${Math.round(item.percent * 100)}%`;
    path.append(title);
    countryPieChart.append(path);
    angle = nextAngle;
  });

  countryPieChart.append(centerCircle);

  const totalText = svgElement("text", { x: 110, y: 106, class: "country-pie-center-value" });
  totalText.textContent = String(total);
  const totalLabel = svgElement("text", { x: 110, y: 128, class: "country-pie-center-label" });
  totalLabel.textContent = "providers";
  countryPieChart.append(totalText, totalLabel);

  distribution.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "country-pie-item";
    const color = document.createElement("span");
    color.className = "country-pie-color";
    color.style.background = colors[index % colors.length];
    const flag = document.createElement("span");
    flag.className = `country-flag ${item.flagClass}`;
    flag.setAttribute("role", "img");
    flag.setAttribute("aria-label", item.label);
    const label = document.createElement("span");
    label.className = "country-pie-label";
    label.textContent = item.code;
    const percent = document.createElement("strong");
    percent.textContent = `${Math.round(item.percent * 100)}%`;
    row.append(color, flag, label, percent);
    countryPieLegend.append(row);
  });
}

function drawStatusChart(counts) {
  if (!statusChart) return;
  statusChart.replaceChildren();
  const series = [
    { label: "Found", value: counts.found, color: "#276749" },
    { label: "Missing", value: counts.missing, color: "#b7791f" },
    { label: "Unknown", value: counts.unknown, color: "#718096" },
  ];
  const maxValue = Math.max(1, ...series.map((item) => item.value));
  const chartWidth = 540;
  const barHeight = 34;

  statusChart.append(
    svgElement("line", { x1: 132, y1: 218, x2: 672, y2: 218, class: "axis-line" }),
    svgElement("text", { x: 132, y: 238, class: "chart-note" }),
  );
  statusChart.lastChild.textContent = "Environment variable count";

  series.forEach((item, index) => {
    const y = 48 + index * 58;
    const width = Math.max(2, (item.value / maxValue) * chartWidth);
    const label = svgElement("text", { x: 28, y: y + 23, class: "chart-label" });
    label.textContent = item.label;
    const bar = svgElement("rect", {
      x: 132,
      y,
      width,
      height: barHeight,
      rx: 2,
      class: "chart-bar",
      fill: item.color,
    });
    const value = svgElement("text", { x: 146 + width, y: y + 23, class: "chart-value" });
    value.textContent = String(item.value);
    statusChart.append(label, bar, value);
  });
}

function drawResidualChart(counts) {
  if (!residualChart) return;
  residualChart.replaceChildren();
  const rows = analysisRows();
  const expected = rows.length ? rows.length * Math.max(counts.keyRate, 0.001) : 1;
  const residuals = rows.slice(0, 24).map((row, index) => {
    const observed = row.status === "found" ? 1 : 0;
    const residual = (observed - counts.keyRate) / Math.sqrt(Math.max(counts.keyRate, 0.05));
    return { index, residual };
  });
  const baselineY = 130;

  residualChart.append(
    svgElement("line", { x1: 44, y1: baselineY, x2: 690, y2: baselineY, class: "axis-line" }),
    svgElement("line", { x1: 44, y1: 34, x2: 44, y2: 226, class: "axis-line" }),
  );

  const title = svgElement("text", { x: 52, y: 244, class: "chart-note" });
  title.textContent = `${state.testMethod}; expected positives = ${expected.toFixed(2)}`;
  residualChart.append(title);

  if (residuals.length === 0) {
    const empty = svgElement("text", { x: 250, y: 134, class: "chart-empty" });
    empty.textContent = "Select providers to plot residuals";
    residualChart.append(empty);
    return;
  }

  residuals.forEach((item) => {
    const x = 70 + item.index * (600 / Math.max(1, residuals.length - 1));
    const y = baselineY - Math.max(-2.4, Math.min(2.4, item.residual)) * 34;
    residualChart.append(
      svgElement("circle", {
        cx: x,
        cy: y,
        r: 4,
        class: item.residual >= 0 ? "residual-positive" : "residual-negative",
      }),
    );
  });
}

function renderAnalysis() {
  if (!selectedMetric || !envMetric || !rateMetric || !alphaMetric || !formulaBlock) return;
  const counts = analysisCounts();
  selectedMetric.textContent = String(counts.selectedProviders);
  envMetric.textContent = String(counts.envVars);
  rateMetric.textContent = `${Math.round(counts.keyRate * 100)}%`;
  alphaMetric.textContent = state.alpha.toFixed(2);
  formulaBlock.textContent = `\\hat{p} = \\frac{k}{n} = \\frac{${counts.found}}{${Math.max(
    counts.envVars,
    1,
  )}}, \\quad H_0: p = 0.5, \\quad \\alpha = ${state.alpha.toFixed(2)}, \\quad test = \\text{${state.testMethod}}`;
  drawStatusChart(counts);
  drawResidualChart(counts);
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const rows = analysisRows();
  const header = ["provider", "country", "environment_variable", "status", "masked_value"];
  const csvRows = rows.map((row) =>
    [row.provider, row.country, row.envVar, row.status, row.value ? maskKey(row.value) : ""]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  downloadTextFile("api-key-checker-analysis.csv", [header.join(","), ...csvRows].join("\n"), "text/csv");
  playTone("success");
}

function exportSvg() {
  if (!statusChart) return;
  const clone = statusChart.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  downloadTextFile(
    "api-key-checker-status-distribution.svg",
    new XMLSerializer().serializeToString(clone),
    "image/svg+xml",
  );
  playTone("success");
}

let audioContext;

function playTone(kind = "click") {
  if (!state.soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = kind === "success" ? 740 : 420;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.11);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.12);
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
  state.catalogUpdatedAt = new Date();
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
  openTerminalButton.disabled = !connected;
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
  setHelperStatus(state.helperConnected);
  renderCountryPie();
}

function renderProviders() {
  providerSelect.replaceChildren();

  for (const [index, provider] of visibleProviders().entries()) {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = `${index + 1}. ${provider.name}`;
    option.selected = false;
    option.className = providerCountryClass(provider);
    providerSelect.append(option);
  }

  renderCountryPie();
}

function animateProviderCountControl() {
  if (!providerCountControl) return;
  providerCountControl.classList.remove("is-updated");
  void providerCountControl.offsetWidth;
  providerCountControl.classList.add("is-updated");
  window.setTimeout(() => {
    providerCountControl.classList.remove("is-updated");
  }, 700);
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
      providerCell.className = `provider-cell ${providerCountryClass(provider)}`;
      providerCell.title = t("doubleClickHint");
      const providerName = document.createElement("strong");
      providerName.textContent = provider.name;
      const country = providerCountry(provider);
      const countryBadge = document.createElement("span");
      countryBadge.className = `provider-country-badge ${providerCountryClass(provider)}`;
      countryBadge.title = country.name;
      countryBadge.setAttribute("aria-label", country.name);
      const countryFlag = document.createElement("span");
      countryFlag.className = `country-flag ${country.flagClass}`;
      countryFlag.setAttribute("role", "img");
      countryFlag.setAttribute("aria-label", country.name);
      const countryName = document.createElement("span");
      countryName.textContent = country.name;
      countryBadge.append(countryFlag, countryName);
      providerCell.append(providerName, countryBadge);

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
        const keyEntry = document.createElement("div");
        keyEntry.className = "key-entry";
        const input = document.createElement("input");
        input.className = "key-input";
        input.dataset.envInput = envVar;
        input.type = "password";
        input.autocomplete = "off";
        input.placeholder = `${t("enterPlaceholder")} ${envVar}`;
        input.value = inputValue;
        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.className = "save-key-button";
        saveButton.dataset.saveKey = envVar;
        saveButton.disabled = !state.helperConnected;
        saveButton.textContent = t("saveApiKey");
        keyEntry.append(input, saveButton);
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

        valueCell.append(keyEntry, commandGrid);
      }

      row.append(providerCell, envCell, statusCell, valueCell);
      statusRows.append(row);
    }
  }

  if (providers.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "empty-state";
    cell.textContent = t("emptyState");
    row.append(cell);
    statusRows.append(row);
  }

  renderAnalysis();
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

async function saveApiKey(envVar) {
  if (!state.helperConnected) {
    alert(t("saveApiKeyFailed"));
    return;
  }

  const value = state.inputValues[envVar] || "";
  if (!value.trim()) {
    alert(`${t("enterValueFirst")} ${envVar}。`);
    return;
  }

  const response = await fetchWithTimeout(`${state.helperBaseUrl}/api/save`, {
    method: "POST",
    headers: helperHeaders(),
    body: JSON.stringify({ envVar, value }),
    timeoutMs: 5000,
  });

  if (!response.ok) {
    throw new Error(t("saveApiKeyFailed"));
  }

  alert(`${t("savedApiKey")} ${envVar}。`);
  await scanKeys();
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
  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, select, input[type='checkbox']")) {
      playTone();
    }
  });

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

  soundToggle.addEventListener("change", () => {
    state.soundEnabled = soundToggle.checked;
  });

  alphaSelect?.addEventListener("change", () => {
    state.alpha = Number(alphaSelect.value);
    renderAnalysis();
  });

  testMethodSelect?.addEventListener("change", () => {
    state.testMethod = testMethodSelect.value;
    renderAnalysis();
  });

  dataUpload?.addEventListener("change", () => {
    state.uploadedDatasetName = dataUpload.files[0]?.name || "";
    renderAnalysis();
    playTone("success");
  });

  exportSvgButton?.addEventListener("click", exportSvg);

  exportCsvButton?.addEventListener("click", exportCsv);

  providerCountSelect.addEventListener("change", () => {
    state.providerLimit = Number(providerCountSelect.value);
    animateProviderCountControl();
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
    const copyCommandEnv = event.target.dataset.copyCommandEnv;
    const copyCommandPlatform = event.target.dataset.copyCommandPlatform;
    const copyDisplayEnv = event.target.dataset.copyDisplayEnv;
    const copyDisplayPlatform = event.target.dataset.copyDisplayPlatform;
    const saveKey = event.target.dataset.saveKey;

    if (toggleKey) {
      if (state.visibleKeys.has(toggleKey)) {
        state.visibleKeys.delete(toggleKey);
      } else {
        state.visibleKeys.add(toggleKey);
      }
      renderRows();
    }

    if (copyCommandEnv && copyCommandPlatform) {
      copyTerminalCommand(copyCommandEnv, copyCommandPlatform).catch((error) =>
        alert(error.message),
      );
    }

    if (saveKey) {
      saveApiKey(saveKey).catch((error) => alert(error.message));
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
