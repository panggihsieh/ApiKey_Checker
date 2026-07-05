#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.API_KEY_CHECKER_WEB_PORT || 5173);
const root = path.resolve(__dirname, "..");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function send(response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
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

  if (!resolved.startsWith(root)) {
    return null;
  }

  return resolved;
}

const server = http.createServer((request, response) => {
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

server.listen(port, "127.0.0.1", () => {
  console.log(`API Key Checker webapp listening at http://localhost:${port}`);
});
