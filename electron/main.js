const crypto = require("crypto");
const { app, BrowserWindow, shell } = require("electron");
const { startHelperServer } = require("../server/helper");
const { startStaticServer } = require("../server/static");

let mainWindow;
let helperServer;
let staticServer;

function isAllowedExternalUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

async function closeServer(server) {
  if (!server) {
    return;
  }

  await new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function createWindow() {
  const web = await startStaticServer({ port: 0 });
  const token = crypto.randomBytes(32).toString("base64url");
  const allowedOrigins = [`http://${web.host}:${web.port}`];
  if (web.host === "127.0.0.1") {
    allowedOrigins.push(`http://localhost:${web.port}`);
  }
  const helper = await startHelperServer({ port: 0, token, allowedOrigins });
  helperServer = helper.server;
  staticServer = web.server;

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 920,
    minHeight: 680,
    title: "API Key Checker",
    backgroundColor: "#f7f4ee",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const appOrigin = `http://${web.host}:${web.port}`;

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${appOrigin}/`)) {
      event.preventDefault();
    }
  });

  await mainWindow.loadURL(
    `http://${web.host}:${web.port}/?helperPort=${helper.port}#helperToken=${token}`,
  );
}

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (!helperServer && !staticServer) {
    return;
  }

  event.preventDefault();
  const servers = [helperServer, staticServer];
  helperServer = null;
  staticServer = null;
  await Promise.all(servers.map(closeServer));
  app.quit();
});
