import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const themePath = resolve(root, "themes", "auren-dark.json");
const schemaPath = resolve(root, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "modes", "interactive", "theme", "theme-schema.json");
const theme = JSON.parse(readFileSync(themePath, "utf8"));
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

const allowedTop = new Set(Object.keys(schema.properties ?? {}));
for (const key of Object.keys(theme)) assert.ok(allowedTop.has(key), `unknown theme key: ${key}`);
for (const key of schema.required ?? []) assert.ok(key in theme, `missing theme key: ${key}`);
assert.equal(theme.name, "auren-dark");
assert.ok(theme.vars && typeof theme.vars === "object");
assert.ok(theme.colors && typeof theme.colors === "object");

const colorSchema = schema.properties?.colors ?? {};
const allowedColors = new Set(Object.keys(colorSchema.properties ?? {}));
for (const key of colorSchema.required ?? []) assert.ok(key in theme.colors, `missing color: ${key}`);
for (const [key, value] of Object.entries(theme.colors)) {
  assert.ok(allowedColors.has(key), `unknown color: ${key}`);
  assert.ok(typeof value === "string" || Number.isInteger(value), `invalid color type: ${key}`);
  if (typeof value === "string") {
    assert.ok(value === "" || /^#[0-9a-f]{6}$/i.test(value) || value in theme.vars, `invalid color value: ${key}`);
  }
}
console.log(`OK: themes/auren-dark.json (${Object.keys(theme.colors).length} colors)`);
