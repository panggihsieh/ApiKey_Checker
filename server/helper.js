#!/usr/bin/env node

const http = require("http");
const childProcess = require("child_process");
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

function writableShellProfile() {
  return configuredShellProfiles()[0] || path.join(os.homedir(), ".zshrc");
}

function corsHeaders(contentType) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Private-Network": "true",
    "Content-Type": contentType,
  };
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    ...corsHeaders("application/json; charset=utf-8"),
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    ...corsHeaders("text/plain; charset=utf-8"),
  });
  response.end(message);
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

function quoteForShell(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`")}"`;
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

function upsertEnvVar(envVar, value) {
  if (process.platform === "win32" && !process.env.API_KEY_CHECKER_PROFILE) {
    childProcess.execFileSync("setx", [envVar, value], { windowsHide: true });
    process.env[envVar] = value;
    return;
  }

  const shellProfile = writableShellProfile();
  const exportLine = `export ${envVar}=${quoteForShell(value)}`;
  let content = "";

  if (fs.existsSync(shellProfile)) {
    content = fs.readFileSync(shellProfile, "utf8");
  }

  const linePattern = new RegExp(`^\\s*export\\s+${envVar}=.*$`, "m");
  const assignmentPattern = new RegExp(`^\\s*${envVar}=.*$`, "m");

  if (linePattern.test(content)) {
    content = content.replace(linePattern, exportLine);
  } else if (assignmentPattern.test(content)) {
    content = content.replace(assignmentPattern, exportLine);
  } else {
    const separator = content && !content.endsWith("\n") ? "\n" : "";
    content = `${content}${separator}${exportLine}\n`;
  }

  fs.writeFileSync(shellProfile, content, { mode: 0o600 });
  process.env[envVar] = value;
}

async function handleCheck(request, response) {
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
      value,
    };
  }

  sendJson(response, 200, results);
}

async function handleSave(request, response) {
  const body = await readJson(request);
  const { envVar, value } = body;

  if (!validateEnvVar(envVar)) {
    sendText(response, 400, "Invalid environment variable name.");
    return;
  }

  if (typeof value !== "string" || value.trim() === "") {
    sendText(response, 400, "API key value is required.");
    return;
  }

  upsertEnvVar(envVar, value);
  sendJson(response, 200, { ok: true, envVar, shellProfile: writableShellProfile() });
}

function createHelperServer() {
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        sendText(response, 204, "");
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host}`);

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, { ok: true, shellProfiles: configuredShellProfiles() });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/check") {
        await handleCheck(request, response);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/save") {
        await handleSave(request, response);
        return;
      }

      sendText(response, 404, "Not found.");
    } catch (error) {
      sendText(response, 500, error.message || "Internal server error.");
    }
  });
}

function startHelperServer(options = {}) {
  const port = Number(options.port ?? process.env.API_KEY_CHECKER_HELPER_PORT ?? 8787);
  const host = options.host || "127.0.0.1";
  const server = createHelperServer();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      console.log(`API Key Checker helper listening at http://${host}:${address.port}`);
      console.log(`Shell profiles: ${configuredShellProfiles().join(", ") || "process environment only"}`);
      resolve({ server, port: address.port, host, shellProfiles: configuredShellProfiles() });
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
  parseShellProfile,
  startHelperServer,
};
