#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const port = Number(process.env.API_KEY_CHECKER_HELPER_PORT || 8787);
const shellProfile = process.env.API_KEY_CHECKER_PROFILE || path.join(os.homedir(), ".zshrc");
const envVarPattern = /^[A-Z][A-Z0-9_]*$/;

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "text/plain; charset=utf-8",
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

function upsertEnvVar(envVar, value) {
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

  for (const envVar of envVars) {
    if (!validateEnvVar(envVar)) {
      continue;
    }

    const value = process.env[envVar] || "";
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
  sendJson(response, 200, { ok: true, envVar, shellProfile });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      sendText(response, 204, "");
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true, shellProfile });
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

server.listen(port, "127.0.0.1", () => {
  console.log(`API Key Checker helper listening at http://localhost:${port}`);
  console.log(`Shell profile: ${shellProfile}`);
});
