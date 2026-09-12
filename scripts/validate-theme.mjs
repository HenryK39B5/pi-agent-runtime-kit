import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const schemaPath = resolve(root, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "modes", "interactive", "theme", "theme-schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const themePaths = globSync("themes/*.json", { cwd: root }).sort().map(path => resolve(root, path));
const hexColor = /^#[0-9a-f]{6}$/i;

function validateColor(value, vars, location) {
  if (Number.isInteger(value)) {
    assert.ok(value >= 0 && value <= 255, `${location}: palette index must be 0-255`);
    return;
  }
  assert.equal(typeof value, "string", `${location}: expected color string or palette index`);
  assert.ok(value === "" || hexColor.test(value) || value in vars, `${location}: unknown color or variable ${JSON.stringify(value)}`);
}

function validateTheme(themePath) {
  const theme = JSON.parse(readFileSync(themePath, "utf8"));
  assert.ok(theme && typeof theme === "object" && !Array.isArray(theme), `${themePath}: top-level JSON must be an object`);

  const allowedTop = new Set(Object.keys(schema.properties ?? {}));
  for (const key of Object.keys(theme)) assert.ok(allowedTop.has(key), `${themePath}: unknown top-level key ${key}`);
  for (const key of schema.required ?? []) assert.ok(key in theme, `${themePath}: missing top-level key ${key}`);
  assert.equal(theme.name, themePath.split(/[\\/]/).at(-1).replace(/\.json$/, ""), `${themePath}: name must match filename`);
  assert.ok(theme.vars && typeof theme.vars === "object" && !Array.isArray(theme.vars), `${themePath}: vars must be an object`);
  assert.ok(theme.colors && typeof theme.colors === "object" && !Array.isArray(theme.colors), `${themePath}: colors must be an object`);

  for (const [key, value] of Object.entries(theme.vars)) validateColor(value, theme.vars, `${theme.name}: vars.${key}`);

  const colorSchema = schema.properties?.colors ?? {};
  const allowedColors = new Set(Object.keys(colorSchema.properties ?? {}));
  for (const key of colorSchema.required ?? []) assert.ok(key in theme.colors, `${theme.name}: missing color ${key}`);
  for (const [key, value] of Object.entries(theme.colors)) {
    assert.ok(allowedColors.has(key), `${theme.name}: unknown color ${key}`);
    validateColor(value, theme.vars, `${theme.name}: colors.${key}`);
  }

  const exportColors = theme.export ?? {};
  const allowedExport = new Set(Object.keys(schema.properties?.export?.properties ?? {}));
  for (const [key, value] of Object.entries(exportColors)) {
    assert.ok(allowedExport.has(key), `${theme.name}: unknown export color ${key}`);
    validateColor(value, theme.vars, `${theme.name}: export.${key}`);
  }

  console.log(`OK: ${relative(root, themePath)} (${Object.keys(theme.colors).length} colors, ${Object.keys(theme.vars).length} variables)`);
  return theme.name;
}

assert.ok(themePaths.length > 0, "no themes found");
const names = themePaths.map(validateTheme);
assert.equal(new Set(names).size, names.length, "theme names must be unique");
