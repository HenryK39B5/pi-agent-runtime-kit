import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";
import { Markdown, visibleWidth, getCapabilities, setCapabilities } from "@earendil-works/pi-tui";
import { citationMarkdown, registerCitationDisplay } from "../../extensions/openai-web-search/citations.ts";
import { sourceMarkdown } from "../../extensions/kiro-web-search/links.ts";
const api = await import(pathToFileURL(`${process.env.PI_TEST_PACKAGE_ROOT}/dist/modes/interactive/theme/theme.js`).href);
api.setThemeInstance(api.loadThemeFromPath(fileURLToPath(new URL("../../themes/auren-dark.json", import.meta.url)), "truecolor"));
const source = { title: "中文 [来源] public fixture", url: "https://example.org/a(b)?version=3#stable" };
for (const hyperlinks of [true, false])
  test(`native Markdown sources are width-safe with OSC 8 ${hyperlinks ? "on" : "off"}`, () => {
    const before = getCapabilities(); setCapabilities({ ...before, hyperlinks });
    try {
      for (const markdown of [sourceMarkdown(source), citationMarkdown({ version: 1, assistantEntryId: "answer", sources: [source], missing: false })]) {
        for (const width of [24, 40, 80, 160]) {
          const lines = new Markdown(markdown, 1, 0, api.getMarkdownTheme()).render(width);
          assert(lines.every(line => visibleWidth(line) <= width));
          if (hyperlinks) assert(lines.join("\n").includes(`\u001b]8;;${source.url}\u001b\\`));
          else assert(!lines.join("\n").includes("\u001b]8;"));
        }
      }
    } finally { setCapabilities(before); }
  });
test("source renderer restores persisted entries independently of current search switch and sanitizes malformed state", () => {
  let renderer: any, transformer: any;
  registerCitationDisplay({ registerEntryRenderer: (_type: string, fn: any) => { renderer = fn; },
    registerMarkdownTransformer: (fn: any) => { transformer = fn; } } as any);
  const data = { version: 1, assistantEntryId: "answer", sources: [source], missing: false };
  assert(renderer({ data }).render(80).length > 0);
  assert.equal(renderer({ data: { ...data, sources: [{ ...source, url: "https://example.org/?sig=PUBLIC_FIXTURE" }] } }), undefined);
  const marker = "\uE200cite\uE202turn0search0\uE201";
  assert.equal(transformer(marker, { messageType: "user" }), marker);
  assert.equal(transformer(marker, { messageType: "assistant" }), "【网页引用】");
});
