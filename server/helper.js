#!/usr/bin/env node

const http = require("http");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const envVarPattern = /^[A-Z][A-Z0-9_]*$/;
const maxRequestBodyBytes = 1024 * 128;
const maxProfileBytes = 1024 * 256;
const maxEnvValueBytes = 1024 * 8;
const defaultShellProfiles = [
  ".zshrc",
  ".zprofile",
  ".bashrc",
  ".bash_profile",
  ".profile",
].map((fileName) => path.join(os.homedir(), fileName));

function configuredShellProfiles() {
  if (process.env.API_KEY_CHECKER_PROFILE) {
    return [process.env.API_KEY_CHECKER_PROFILE];
  }

  if (process.platform === "win32") {
    return [];
  }

  return defaultShellProfiles;
}

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function originAllowed(origin, allowedOrigins) {
  return !origin || allowedOrigins.includes(origin);
}

function corsHeaders(contentType, request, allowedOrigins) {
  const origin = request.headers.origin || "";
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key-Checker-Token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Private-Network": "true",
    "Vary": "Origin",
    "Content-Type": contentType,
  };

  if (originAllowed(origin, allowedOrigins)) {
    headers["Access-Control-Allow-Origin"] = origin || "null";
  }

  return headers;
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function tokenValid(request, token) {
  const supplied = request.headers["x-api-key-checker-token"];
  return typeof supplied === "string" && timingSafeEqual(supplied, token);
}

function maskKey(value) {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function sendJson(response, request, allowedOrigins, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    ...corsHeaders("application/json; charset=utf-8", request, allowedOrigins),
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendText(response, request, allowedOrigins, statusCode, message) {
  response.writeHead(statusCode, {
    ...corsHeaders("text/plain; charset=utf-8", request, allowedOrigins),
  });
  response.end(message);
}

function defaultAllowedOrigins() {
  const webPort = process.env.API_KEY_CHECKER_WEB_PORT || 5173;
  return {
    token: process.env.API_KEY_CHECKER_HELPER_TOKEN || crypto.randomBytes(32).toString("base64url"),
    allowedOrigins:
      parseAllowedOrigins(process.env.API_KEY_CHECKER_ALLOWED_ORIGINS).length > 0
        ? parseAllowedOrigins(process.env.API_KEY_CHECKER_ALLOWED_ORIGINS)
        : [`http://127.0.0.1:${webPort}`, `http://localhost:${webPort}`],
  };
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxRequestBodyBytes) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

function validateEnvVar(envVar) {
  return typeof envVar === "string" && envVarPattern.test(envVar);
}

function unquoteShellValue(value) {
  const trimmed = String(value).trim();

  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\(["\\$`])/g, "$1")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t");
  }

  return trimmed.replace(/\s+#.*$/, "").trim();
}

function parseShellProfile(content) {
  const env = {};

  for (const line of String(content).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) {
      env[match[1]] = unquoteShellValue(match[2]);
    }
  }

  return env;
}

function shellExportValue(value) {
  return `"${String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`")}"`;
}

function profileForSave() {
  const profiles = configuredShellProfiles();
  if (profiles.length > 0) {
    return profiles[0];
  }

  return path.join(os.homedir(), ".profile");
}

function saveEnvToShellProfile(envVar, value) {
  const profile = profileForSave();
  let content = "";

  try {
    const stat = fs.statSync(profile);
    if (!stat.isFile() || stat.size > maxProfileBytes) {
      throw new Error("Shell profile is not writable by API Key Checker.");
    }
    content = fs.readFileSync(profile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const exportLine = `export ${envVar}=${shellExportValue(value)}`;
  const linePattern = new RegExp(`^(?:export\\s+)?${envVar}=.*$`, "m");
  const nextContent = linePattern.test(content)
    ? content.replace(linePattern, exportLine)
    : `${content}${content.endsWith("\n") || content.length === 0 ? "" : "\n"}${exportLine}\n`;

  fs.mkdirSync(path.dirname(profile), { recursive: true });
  fs.writeFileSync(profile, nextContent, { encoding: "utf8", mode: 0o600 });
  return "shell-profile";
}

function saveEnvToWindowsUser(envVar, value) {
  return new Promise((resolve, reject) => {
    const child = childProcess.execFile("setx", [envVar, value], {
      timeout: 10000,
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve("windows-user");
      } else {
        reject(new Error("Unable to save Windows user environment variable."));
      }
    });
  });
}

async function saveEnv(envVar, value) {
  const target =
    process.platform === "win32"
      ? await saveEnvToWindowsUser(envVar, value)
      : saveEnvToShellProfile(envVar, value);
  process.env[envVar] = value;
  return target;
}

function readProfileEnv() {
  const profileEnv = {};
  const profiles = configuredShellProfiles();

  for (const profile of profiles) {
    let stat;
    try {
      stat = fs.statSync(profile);
    } catch {
      continue;
    }

    if (!stat.isFile() || stat.size > maxProfileBytes) {
      continue;
    }

    try {
      Object.assign(profileEnv, parseShellProfile(fs.readFileSync(profile, "utf8")));
    } catch {
      // Ignore unreadable profiles; environment scanning should fail closed per file.
    }
  }

  return { profileEnv, profiles };
}

function execFileText(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(
      file,
      args,
      {
        timeout: 2000,
        windowsHide: true,
        ...options,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(stdout);
      },
    );
  });
}

function parseWindowsEnv(output, envVar) {
  const escapedName = envVar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linePattern = new RegExp(`^\\s*${escapedName}\\s+REG_\\w+\\s+(.+)$`, "im");
  const match = String(output).match(linePattern);
  return match ? match[1].trim() : "";
}

async function readWindowsRegistryEnv(hivePath, envVar) {
  if (process.platform !== "win32") {
    return "";
  }

  try {
    const output = await execFileText("reg", ["query", hivePath, "/v", envVar]);
    return parseWindowsEnv(output, envVar);
  } catch {
    return "";
  }
}

function resolveEnvValue(envVar, sources) {
  return (
    sources.profileEnv?.[envVar] ||
    sources.windowsUserEnv ||
    sources.windowsSystemEnv ||
    sources.processEnv?.[envVar] ||
    ""
  );
}

async function readEnvValue(envVar, profileEnv) {
  const windowsUserEnv = await readWindowsRegistryEnv("HKCU\\Environment", envVar);
  const windowsSystemEnv = await readWindowsRegistryEnv(
    "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",
    envVar,
  );

  // Persistent sources are read fresh on each scan. process.env is only the
  // helper's launch-time snapshot, so it can be stale after a key is changed.
  return (
    resolveEnvValue(envVar, {
      profileEnv,
      windowsUserEnv,
      windowsSystemEnv,
      processEnv: process.env,
    })
  );
}

function openTerminal() {
  if (process.platform === "darwin") {
    childProcess.spawn("open", ["-a", "Terminal"], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return "Terminal";
  }

  if (process.platform === "win32") {
    childProcess.spawn("powershell.exe", ["-NoExit"], {
      detached: true,
      windowsHide: true,
      stdio: "ignore",
    }).unref();
    return "PowerShell";
  }

  throw new Error("Opening a terminal is supported only on macOS and Windows.");
}

async function handleCheck(request, response, allowedOrigins, readEnvHandler = readEnvValue) {
  const body = await readJson(request);
  const envVars = Array.isArray(body.envVars) ? body.envVars : [];
  const results = {};
  const { profileEnv } = readProfileEnv();

  for (const envVar of envVars) {
    if (!validateEnvVar(envVar)) {
      continue;
    }

    const value = await readEnvHandler(envVar, profileEnv);
    results[envVar] = {
      status: value ? "found" : "missing",
      maskedValue: maskKey(value),
    };
  }

  sendJson(response, request, allowedOrigins, 200, results);
}

async function handleSave(request, response, allowedOrigins, saveEnvHandler) {
  const body = await readJson(request);
  const envVar = body.envVar;
  const value = typeof body.value === "string" ? body.value : "";

  if (!validateEnvVar(envVar)) {
    sendText(response, request, allowedOrigins, 400, "Invalid environment variable name.");
    return;
  }

  if (!value.trim() || value.includes("\0") || Buffer.byteLength(value) > maxEnvValueBytes) {
    sendText(response, request, allowedOrigins, 400, "Invalid environment variable value.");
    return;
  }

  const target = await saveEnvHandler(envVar, value);
  sendJson(response, request, allowedOrigins, 200, {
    ok: true,
    envVar,
    maskedValue: maskKey(value),
    target,
  });
}

function createHelperServer(options = {}) {
  const defaults = defaultAllowedOrigins();
  const token = options.token || defaults.token;
  const allowedOrigins = options.allowedOrigins || defaults.allowedOrigins;
  const openTerminalHandler = options.openTerminal || openTerminal;
  const saveEnvHandler = options.saveEnv || saveEnv;
  const readEnvHandler = options.readEnv || readEnvValue;

  return http.createServer(async (request, response) => {
    try {
      if (!originAllowed(request.headers.origin || "", allowedOrigins)) {
        sendText(response, request, allowedOrigins, 403, "Forbidden origin.");
        return;
      }

      if (request.method === "OPTIONS") {
        sendText(response, request, allowedOrigins, 204, "");
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host}`);

      if (!tokenValid(request, token)) {
        sendText(response, request, allowedOrigins, 401, "Unauthorized.");
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, request, allowedOrigins, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/check") {
        await handleCheck(request, response, allowedOrigins, readEnvHandler);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/save") {
        await handleSave(request, response, allowedOrigins, saveEnvHandler);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/open-terminal") {
        const terminal = openTerminalHandler();
        sendJson(response, request, allowedOrigins, 200, { ok: true, terminal });
        return;
      }

      sendText(response, request, allowedOrigins, 404, "Not found.");
    } catch (error) {
      sendText(response, request, allowedOrigins, 500, error.message || "Internal server error.");
    }
  });
}

function startHelperServer(options = {}) {
  const port = Number(options.port ?? process.env.API_KEY_CHECKER_HELPER_PORT ?? 8787);
  const host = options.host || "127.0.0.1";
  const defaults = defaultAllowedOrigins();
  const token = options.token || defaults.token;
  const allowedOrigins = options.allowedOrigins || defaults.allowedOrigins;
  const server = createHelperServer({ token, allowedOrigins });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      console.log(`API Key Checker helper listening at http://${host}:${address.port}`);
      console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
      console.log(`Shell profiles: ${configuredShellProfiles().join(", ") || "process environment only"}`);
      resolve({ server, port: address.port, host, token, allowedOrigins, shellProfiles: configuredShellProfiles() });
    });
  });
}

if (require.main === module) {
  startHelperServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  createHelperServer,
  maskKey,
  parseShellProfile,
  resolveEnvValue,
  startHelperServer,
};
