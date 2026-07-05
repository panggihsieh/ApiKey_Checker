#!/usr/bin/env node

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const packageJson = require(path.join(projectRoot, "package.json"));
const sourceDir = path.join(projectRoot, "dist", "win-unpacked");
const outputDir = path.join(projectRoot, "dist");
const msiPath = path.join(
  outputDir,
  `${packageJson.productName}-${packageJson.version}-win-x64.msi`,
);
const upgradeCode = "AFD3BC75-3CBD-5FC9-AB3B-7F6F0FAE23B9";

function assertTool(name) {
  const command = process.platform === "win32" ? "where" : "which";

  try {
    childProcess.execFileSync(command, [name], { stdio: "ignore" });
  } catch {
    throw new Error(`${name} is required. Install msitools first, for example: brew install msitools`);
  }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath);
    }

    if (entry.isFile()) {
      return [fullPath];
    }

    return [];
  });
}

function stableId(prefix, value) {
  return `${prefix}_${crypto.createHash("sha1").update(value).digest("hex").slice(0, 16)}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function indent(level) {
  return "  ".repeat(level);
}

function renderWxs(files) {
  const byDir = new Map();

  for (const file of files) {
    const dir = path.posix.dirname(file);
    const key = dir === "." ? "" : dir;
    if (!byDir.has(key)) {
      byDir.set(key, []);
    }
    byDir.get(key).push(file);
  }

  const dirs = [
    ...new Set(files.map((file) => path.posix.dirname(file)).filter((dir) => dir !== ".")),
  ].sort();
  const children = new Map();
  for (const dir of dirs) {
    const parent = path.posix.dirname(dir) === "." ? "" : path.posix.dirname(dir);
    if (!children.has(parent)) {
      children.set(parent, []);
    }
    children.get(parent).push(dir);
  }

  const dirIds = new Map([["", "INSTALLFOLDER"]]);
  for (const dir of dirs) {
    dirIds.set(dir, stableId("dir", dir));
  }

  const componentIds = [];

  function renderFilesForDir(dir, level) {
    let text = "";
    for (const file of byDir.get(dir) || []) {
      const componentId = stableId("cmp", file);
      const fileId = stableId("fil", file);
      const name = path.posix.basename(file);
      componentIds.push(componentId);
      text += `${indent(level)}<Component Id="${componentId}" Guid="*" Win64="yes">\n`;
      text += `${indent(level + 1)}<File Id="${fileId}" Name="${escapeXml(name)}" Source="$(var.SourceDir)/${escapeXml(file)}" KeyPath="yes" />\n`;
      text += `${indent(level)}</Component>\n`;
    }
    return text;
  }

  function renderDirectory(dir, level) {
    let text = renderFilesForDir(dir, level + 1);
    for (const child of children.get(dir) || []) {
      text += `${indent(level + 1)}<Directory Id="${dirIds.get(child)}" Name="${escapeXml(path.posix.basename(child))}">\n`;
      text += renderDirectory(child, level + 1);
      text += `${indent(level + 1)}</Directory>\n`;
    }
    return text;
  }

  const version = `${packageJson.version}.0`.split(".").slice(0, 4).join(".");
  let wxs = `<?xml version="1.0" encoding="utf-8"?>\n`;
  wxs += `<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">\n`;
  wxs += `  <Product Id="*" Name="${escapeXml(packageJson.productName)}" UpgradeCode="${upgradeCode}" Version="${version}" Language="1033" Manufacturer="${escapeXml(packageJson.author)}">\n`;
  wxs += `    <Package InstallerVersion="500" Compressed="yes" InstallScope="perUser" />\n`;
  wxs += `    <MediaTemplate EmbedCab="yes" />\n`;
  wxs += `    <Directory Id="TARGETDIR" Name="SourceDir">\n`;
  wxs += `      <Directory Id="LocalAppDataFolder">\n`;
  wxs += `        <Directory Id="INSTALLFOLDER" Name="${escapeXml(packageJson.productName)}">\n`;
  wxs += renderDirectory("", 4);
  wxs += `        </Directory>\n`;
  wxs += `      </Directory>\n`;
  wxs += `    </Directory>\n`;
  wxs += `    <Feature Id="DefaultFeature" Title="${escapeXml(packageJson.productName)}" Level="1">\n`;
  for (const componentId of componentIds) {
    wxs += `      <ComponentRef Id="${componentId}" />\n`;
  }
  wxs += `    </Feature>\n`;
  wxs += `  </Product>\n`;
  wxs += `</Wix>\n`;
  return wxs;
}

function main() {
  assertTool("wixl");

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing ${sourceDir}. Run "npx electron-builder --win dir --x64" first.`);
  }

  const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "api-key-checker-wixl-"));
  const buildSourceDir = path.join(buildDir, "win-unpacked");
  const buildWxsPath = path.join(buildDir, "wixl-project.wxs");
  const buildMsiPath = path.join(buildDir, path.basename(msiPath));

  fs.cpSync(sourceDir, buildSourceDir, { recursive: true });

  const files = walk(buildSourceDir)
    .map((filePath) => path.relative(buildSourceDir, filePath).split(path.sep).join("/"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No files found in ${buildSourceDir}.`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(buildWxsPath, renderWxs(files));
  childProcess.execFileSync(
    "wixl",
    ["-a", "x64", "-D", `SourceDir=${buildSourceDir}`, "-o", buildMsiPath, buildWxsPath],
    { stdio: "inherit" },
  );

  fs.copyFileSync(buildMsiPath, msiPath);
  fs.copyFileSync(buildWxsPath, path.join(outputDir, "wixl-project.wxs"));
  fs.rmSync(buildDir, { recursive: true, force: true });
  console.log(`Built ${msiPath}`);
}

main();
