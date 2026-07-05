const assert = require("node:assert/strict");
const test = require("node:test");
const { createStaticServer } = require("../server/static");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

test("static server sends browser security headers", async () => {
  const server = createStaticServer();
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  } finally {
    await close(server);
  }
});

test("static server rejects path traversal outside the app root", async () => {
  const server = createStaticServer();
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/..%2Fpackage.json`);

    assert.equal(response.status, 403);
  } finally {
    await close(server);
  }
});

test("static server does not expose non-frontend repository files", async () => {
  const server = createStaticServer();
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/package.json`);

    assert.equal(response.status, 403);
  } finally {
    await close(server);
  }
});
