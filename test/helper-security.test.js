const assert = require("node:assert/strict");
const test = require("node:test");
const { createHelperServer } = require("../server/helper");

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

test("helper rejects requests without the session token", async () => {
  const server = createHelperServer({
    token: "test-token-123456789012345678901234",
    allowedOrigins: ["http://127.0.0.1:5173"],
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { Origin: "http://127.0.0.1:5173" },
    });

    assert.equal(response.status, 401);
  } finally {
    await close(server);
  }
});

test("helper rejects unapproved browser origins", async () => {
  const server = createHelperServer({
    token: "test-token-123456789012345678901234",
    allowedOrigins: ["http://127.0.0.1:5173"],
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: {
        Origin: "https://evil.example",
        "X-API-Key-Checker-Token": "test-token-123456789012345678901234",
      },
    });

    assert.equal(response.status, 403);
  } finally {
    await close(server);
  }
});

test("helper check masks API keys instead of returning full values", async () => {
  const server = createHelperServer({
    token: "test-token-123456789012345678901234",
    allowedOrigins: ["http://127.0.0.1:5173"],
  });
  const port = await listen(server);
  process.env.OPENAI_API_KEY = "sk-test-secret-value";

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/check`, {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1:5173",
        "Content-Type": "application/json",
        "X-API-Key-Checker-Token": "test-token-123456789012345678901234",
      },
      body: JSON.stringify({ envVars: ["OPENAI_API_KEY"] }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.OPENAI_API_KEY.status, "found");
    assert.equal(payload.OPENAI_API_KEY.maskedValue, "sk-t...alue");
    assert.equal(payload.OPENAI_API_KEY.value, undefined);
  } finally {
    delete process.env.OPENAI_API_KEY;
    await close(server);
  }
});

test("helper save endpoint is disabled", async () => {
  const server = createHelperServer({
    token: "test-token-123456789012345678901234",
    allowedOrigins: ["http://127.0.0.1:5173"],
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/save`, {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1:5173",
        "Content-Type": "application/json",
        "X-API-Key-Checker-Token": "test-token-123456789012345678901234",
      },
      body: JSON.stringify({ envVar: "OPENAI_API_KEY", value: "sk-test-secret-value" }),
    });

    assert.equal(response.status, 410);
  } finally {
    await close(server);
  }
});

test("helper opens terminal only after token and origin checks pass", async () => {
  let opened = false;
  const server = createHelperServer({
    token: "test-token-123456789012345678901234",
    allowedOrigins: ["http://127.0.0.1:5173"],
    openTerminal: () => {
      opened = true;
      return "Test Terminal";
    },
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/open-terminal`, {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1:5173",
        "X-API-Key-Checker-Token": "test-token-123456789012345678901234",
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.terminal, "Test Terminal");
    assert.equal(opened, true);
  } finally {
    await close(server);
  }
});
