#!/usr/bin/env node

const http = require("http");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const envVarPattern = /^[A-Z][A-Z0-9_]*$/;
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
      if (body.length > 1024 * 128) {
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

function readProfileEnv() {
  const profileEnv = {};
  const profiles = configuredShellProfiles();

  for (const profile of profiles) {
    if (!fs.existsSync(profile)) {
      continue;
    }

    Object.assign(profileEnv, parseShellProfile(fs.readFileSync(profile, "utf8")));
  }

  return { profileEnv, profiles };
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
    childProcess.spawn("cmd.exe", ["/c", "start", "", "cmd.exe"], {
      detached: true,
      windowsHide: true,
      stdio: "ignore",
    }).unref();
    return "Command Prompt";
  }

  throw new Error("Opening a terminal is supported only on macOS and Windows.");
}

async function handleCheck(request, response, allowedOrigins) {
  const body = await readJson(request);
  const envVars = Array.isArray(body.envVars) ? body.envVars : [];
  const results = {};
  const { profileEnv } = readProfileEnv();

  for (const envVar of envVars) {
    if (!validateEnvVar(envVar)) {
      continue;
    }

    const value = process.env[envVar] || profileEnv[envVar] || "";
    results[envVar] = {
      status: value ? "found" : "missing",
      maskedValue: maskKey(value),
    };
  }

  sendJson(response, request, allowedOrigins, 200, results);
}

function createHelperServer(options = {}) {
  const defaults = defaultAllowedOrigins();
  const token = options.token || defaults.token;
  const allowedOrigins = options.allowedOrigins || defaults.allowedOrigins;
  const openTerminalHandler = options.openTerminal || openTerminal;

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
        sendJson(response, request, allowedOrigins, 200, { ok: true, shellProfiles: configuredShellProfiles() });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/check") {
        await handleCheck(request, response, allowedOrigins);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/save") {
        sendText(response, request, allowedOrigins, 410, "Saving API keys is disabled. Copy the command and paste it in your terminal.");
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
      console.log(`Helper token: ${token}`);
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
  startHelperServer,
};
