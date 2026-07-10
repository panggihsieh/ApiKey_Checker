#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, "..", ".."));
const output = path.resolve(process.argv[3] || path.join(__dirname, "..", "generated", "assets.hpp"));

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const files = [
  path.join(root, "index.html"),
  ...walk(path.join(root, "src")),
  ...walk(path.join(root, "icon")),
]
  .filter((file) => /\.(html|js|css|json|svg)$/i.test(file))
  .sort((a, b) => a.localeCompare(b));

function bytesLiteral(buffer) {
  const chunks = [];
  for (let index = 0; index < buffer.length; index += 16) {
    const slice = [...buffer.subarray(index, index + 16)]
      .map((byte) => `0x${byte.toString(16).padStart(2, "0")}`)
      .join(", ");
    chunks.push(`  ${slice}`);
  }
  return chunks.join(",\n");
}

const lines = [
  "#pragma once",
  "",
  "#include <cstddef>",
  "#include <string_view>",
  "",
  "namespace embedded_assets {",
  "",
  "struct Asset {",
  "  const char* path;",
  "  const unsigned char* data;",
  "  std::size_t size;",
  "};",
  "",
];

files.forEach((file, index) => {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const data = fs.readFileSync(file);
  lines.push(`static const unsigned char asset_${index}[] = {`);
  lines.push(bytesLiteral(data));
  lines.push("};");
  lines.push(`static constexpr Asset asset_entry_${index} = {"${relative}", asset_${index}, ${data.length}};`);
  lines.push("");
});

lines.push("static constexpr Asset assets[] = {");
files.forEach((_, index) => {
  lines.push(`  asset_entry_${index},`);
});
lines.push("};");
lines.push("");
lines.push("inline const Asset* find_asset(std::string_view path) {");
lines.push("  for (const auto& asset : assets) {");
lines.push("    if (path == asset.path) {");
lines.push("      return &asset;");
lines.push("    }");
lines.push("  }");
lines.push("  return nullptr;");
lines.push("}");
lines.push("");
lines.push("}  // namespace embedded_assets");
lines.push("");

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, lines.join("\n"));

