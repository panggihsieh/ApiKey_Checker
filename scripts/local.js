#!/usr/bin/env node

const crypto = require("crypto");
const net = require("net");
const { spawn } = require("child_process");

const helperToken = process.env.API_KEY_CHECKER_HELPER_TOKEN || crypto.randomBytes(32).toString("base64url");
let openedWebapp = false;
let children = [];

function listenOnce(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(null));
    server.listen(Number(port), host, () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function availablePort(preferredPort) {
  const preferred = await listenOnce(preferredPort);
  if (preferred) {
    return preferred;
  }

  return listenOnce(0);
}

function openWebapp(webUrl) {
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

function spawnChild(name, script, env) {
  const child = spawn(process.execPath, [script], {
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });

  child.stdout.on("data", (chunk) => {
    const output = chunk.toString();
    process.stdout.write(`[${name}] ${output}`);
    if (name === "web" && output.includes("API Key Checker webapp listening")) {
      openWebapp(env.API_KEY_CHECKER_WEB_URL);
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
}

async function main() {
  const helperPort = await availablePort(process.env.API_KEY_CHECKER_HELPER_PORT || 8787);
  const webPort = await availablePort(process.env.API_KEY_CHECKER_WEB_PORT || 5173);
  const webUrl = `http://localhost:${webPort}/?helperPort=${helperPort}#helperToken=${helperToken}`;
  const allowedOrigins = [`http://localhost:${webPort}`, `http://127.0.0.1:${webPort}`].join(",");
  const env = {
    ...process.env,
    API_KEY_CHECKER_ALLOWED_ORIGINS: allowedOrigins,
    API_KEY_CHECKER_HELPER_TOKEN: helperToken,
    API_KEY_CHECKER_HELPER_PORT: String(helperPort),
    API_KEY_CHECKER_WEB_PORT: String(webPort),
    API_KEY_CHECKER_WEB_URL: webUrl,
  };

  console.log(`API Key Checker local URL: ${webUrl}`);
  children = [
    spawnChild("web", "server/static.js", env),
    spawnChild("helper", "server/helper.js", env),
  ];
}

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

main().catch((error) => {
  console.error(error);
  shutdown();
  process.exit(1);
});
