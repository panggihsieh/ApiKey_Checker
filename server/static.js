#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "connect-src 'self' http://127.0.0.1:* http://localhost:*",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
const publicFiles = new Set([
  "index.html",
  "src/app.js",
  "src/providers.js",
  "src/ranking.js",
  "src/styles.css",
]);

function send(response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const requestedPath = decodeURIComponent(url.pathname);
  const filePath = requestedPath === "/" ? "/index.html" : requestedPath;
  const resolved = path.resolve(root, `.${filePath}`);
  const relative = path.relative(root, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  const publicPath = relative.split(path.sep).join("/");
  const isPublicFlag = publicPath.startsWith("src/flags/") && path.extname(publicPath) === ".svg";
  const isPublicIcon = publicPath.startsWith("icon/") && path.extname(publicPath) === ".svg";
  if (!publicFiles.has(publicPath) && !isPublicFlag && !isPublicIcon) {
    return null;
  }

  return resolved;
}

function createStaticServer() {
  return http.createServer((request, response) => {
    const filePath = resolveRequestPath(request.url);

    if (!filePath) {
      send(response, 403, "text/plain; charset=utf-8", "Forbidden.");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        send(response, 404, "text/plain; charset=utf-8", "Not found.");
        return;
      }

      const ext = path.extname(filePath);
      send(response, 200, contentTypes[ext] || "application/octet-stream", data);
    });
  });
}

function startStaticServer(options = {}) {
  const port = Number(options.port ?? process.env.API_KEY_CHECKER_WEB_PORT ?? 5173);
  const host = options.host || "127.0.0.1";
  const server = createStaticServer();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      console.log(`API Key Checker webapp listening at http://${host}:${address.port}`);
      resolve({ server, port: address.port, host });
    });
  });
}

if (require.main === module) {
  startStaticServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  createStaticServer,
  startStaticServer,
};
