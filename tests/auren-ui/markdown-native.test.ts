import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import "./installed-tui.ts";

const { Markdown, visibleWidth, stripTerminalSequences } = await import("@earendil-works/pi-tui");
const root = process.env.PI_TEST_PACKAGE_ROOT!;
const themeApi = await import(pathToFileURL(`${root}/dist/modes/interactive/theme/theme.js`).href);
themeApi.setThemeInstance(themeApi.loadThemeFromPath(fileURLToPath(new URL("../../themes/auren-dark.json", import.meta.url)), "truecolor"));
const theme = themeApi.getMarkdownTheme();
const render = (text: string, width: number) => new Markdown(text, 1, 0, theme).render(width);
const plain = (text: string, width = 80) => render(text, width).map(stripTerminalSequences).join("\n");

test("native Markdown renders the existing reading fixture within 24-160 columns", () => {
  const sample = readFileSync(new URL("../fixtures/auren-theme-showcase.md", import.meta.url), "utf8");
  for (const width of [24, 40, 60, 80, 120, 160]) {
    const lines = render(sample, width);
    assert.ok(lines.length > 20);
    for (const line of lines) assert.ok(visibleWidth(line) <= width, `overflow at ${width}: ${visibleWidth(line)}`);
  }
});

test("native headings retain hashes only at H3-H6; explicit callouts are plain quotes", () => {
  const result = plain("# One\n\n## Two\n\n### Three\n\n> [!NOTE]\n> 中文引用");
  assert.ok(result.includes("One") && !result.includes("# One"));
  assert.ok(result.includes("Two") && !result.includes("## Two"));
  assert.ok(result.includes("### Three"));
  assert.ok(result.includes("│ [!NOTE]"));
});

test("native tables wrap, and HTML remains literal instead of becoming a styled panel", () => {
  const table = "| 中文 | Path |\n|---|---|\n| 中英文说明 | C:/workspace/very-long-workspace/path/file.ts |";
  assert.ok(plain(table, 40).includes("┌"));
  assert.ok(!plain(table, 8).includes("┌"));
  assert.ok(plain('<div class="card">hello</div>').includes('<div class="card">'));
});

test("native renderer handles incremental code fences and resize without changing the source", () => {
  const source = "中文段落\n\n```typescript\nconst value = 123;\n```";
  const component = new Markdown("", 1, 0, theme);
  for (let length = 1; length <= source.length; length++) {
    component.setText(source.slice(0, length));
    for (const width of [24, 80]) {
      for (const line of component.render(width)) assert.ok(visibleWidth(line) <= width);
    }
  }
  assert.ok(component.render(80).map(stripTerminalSequences).join("\n").includes("const value = 123;"));
});
