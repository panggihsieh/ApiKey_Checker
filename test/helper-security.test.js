const assert = require("node:assert/strict");
const test = require("node:test");
const { createHelperServer, startHelperServer } = require("../server/helper");

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

test("helper health does not expose local shell profile paths", async () => {
  const server = createHelperServer({
    token: "test-token-123456789012345678901234",
    allowedOrigins: ["http://127.0.0.1:5173"],
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: {
        Origin: "http://127.0.0.1:5173",
        "X-API-Key-Checker-Token": "test-token-123456789012345678901234",
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { ok: true });
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

test("helper check reads fresh environment values through the injected reader", async () => {
  const reads = [];
  const server = createHelperServer({
    token: "test-token-123456789012345678901234",
    allowedOrigins: ["http://127.0.0.1:5173"],
    readEnv: async (envVar) => {
      reads.push(envVar);
      return envVar === "DEEPSEEK_API_KEY" ? "sk-deepseek-secret-value" : "";
    },
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/check`, {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1:5173",
        "Content-Type": "application/json",
        "X-API-Key-Checker-Token": "test-token-123456789012345678901234",
      },
      body: JSON.stringify({ envVars: ["DEEPSEEK_API_KEY"] }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(reads, ["DEEPSEEK_API_KEY"]);
    assert.equal(payload.DEEPSEEK_API_KEY.status, "found");
    assert.equal(payload.DEEPSEEK_API_KEY.maskedValue, "sk-d...alue");
  } finally {
    await close(server);
  }
});

test("helper save endpoint validates and saves API keys through the injected handler", async () => {
  const saved = [];
  const server = createHelperServer({
    token: "test-token-123456789012345678901234",
    allowedOrigins: ["http://127.0.0.1:5173"],
    saveEnv: async (envVar, value) => {
      saved.push({ envVar, value });
      return "test-target";
    },
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
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.envVar, "OPENAI_API_KEY");
    assert.equal(payload.maskedValue, "sk-t...alue");
    assert.equal(payload.target, "test-target");
    assert.deepEqual(saved, [{ envVar: "OPENAI_API_KEY", value: "sk-test-secret-value" }]);
  } finally {
    await close(server);
  }
});

test("helper save endpoint rejects invalid environment variable names", async () => {
  let saved = false;
  const server = createHelperServer({
    token: "test-token-123456789012345678901234",
    allowedOrigins: ["http://127.0.0.1:5173"],
    saveEnv: async () => {
      saved = true;
      return "test-target";
    },
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
      body: JSON.stringify({ envVar: "OPENAI_API_KEY; echo bad", value: "sk-test-secret-value" }),
    });

    assert.equal(response.status, 400);
    assert.equal(saved, false);
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

test("helper startup logs do not expose the session token", async () => {
  const token = "test-token-123456789012345678901234";
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(" "));
  };

  let server;
  try {
    const started = await startHelperServer({
      port: 0,
      token,
      allowedOrigins: ["http://127.0.0.1:5173"],
    });
    server = started.server;

    assert.equal(logs.some((line) => line.includes(token)), false);
  } finally {
    console.log = originalLog;
    if (server) {
      await close(server);
    }
  }
});
