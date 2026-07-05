#!/usr/bin/env node

const crypto = require("crypto");
const { spawn } = require("child_process");

const helperPort = process.env.API_KEY_CHECKER_HELPER_PORT || 8787;
const webPort = process.env.API_KEY_CHECKER_WEB_PORT || 5173;
const helperToken = process.env.API_KEY_CHECKER_HELPER_TOKEN || crypto.randomBytes(32).toString("base64url");
const webUrl = `http://localhost:${webPort}/?helperPort=${helperPort}#helperToken=${helperToken}`;
const allowedOrigins = [`http://localhost:${webPort}`, `http://127.0.0.1:${webPort}`].join(",");
let openedWebapp = false;

function openWebapp() {
  if (openedWebapp) {
    return;
  }

  openedWebapp = true;
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", webUrl] : [webUrl];
  const opener = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  opener.unref();
}

const processes = [
  ["web", "server/static.js"],
  ["helper", "server/helper.js"],
];

const children = processes.map(([name, script]) => {
  const child = spawn(process.execPath, [script], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      API_KEY_CHECKER_ALLOWED_ORIGINS: allowedOrigins,
      API_KEY_CHECKER_HELPER_TOKEN: helperToken,
    },
  });

  child.stdout.on("data", (chunk) => {
    const output = chunk.toString();
    process.stdout.write(`[${name}] ${output}`);
    if (name === "web" && output.includes("API Key Checker webapp listening")) {
      openWebapp();
    }
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown();
    }
  });

  return child;
});

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
