import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const self = relative(root, import.meta.filename).replaceAll("\\", "/");
const skippedDirectories = new Set([".git", "node_modules", ".tmp", "coverage", "dist"]);
const textExtensions = new Set([".ts", ".js", ".mjs", ".json", ".md", ".txt", ".yml", ".yaml", ".ps1", ".gitignore"]);
const suffix = path => path.includes(".") ? path.slice(path.lastIndexOf(".")) : path.startsWith(".") ? path : "";

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) return [];
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    const display = relative(root, path).replaceAll("\\", "/");
    return display === self || !textExtensions.has(suffix(entry.name)) ? [] : [{ path, display }];
  });
}

// This file is excluded because a scanner necessarily contains its own deny patterns.
const denied = [
  ["personal/runtime identifiers", new RegExp(["he", "nry|he", "rry|agent-hub|cctq|dida365|siyuan|gpt-5\\.6|auren-backups"].join(""), "i")],
  ["machine-specific user/desktop path", /[a-z]:[\\/]+(?:users|desktop)[\\/]+|\/mnt\/[a-z]\/(?:users|desktop)\//i],
  ["common API token", /(?:sk-|ghp_|github_pat_)[a-z0-9_-]{16,}/i],
  ["embedded bearer/token value", /(?:bearer|token)\s+[a-z0-9._~-]{16,}/i],
];

const failures = [];
for (const file of collect(root)) {
  const text = readFileSync(file.path, "utf8");
  for (const [label, pattern] of denied) {
    if (pattern.test(text)) failures.push(`${file.display}: ${label}`);
  }
}
if (failures.length) {
  console.error("Public-tree audit failed:\n" + failures.map(value => `- ${value}`).join("\n"));
  process.exit(1);
}
console.log(`OK: public-tree audit scanned ${collect(root).length} text files`);
