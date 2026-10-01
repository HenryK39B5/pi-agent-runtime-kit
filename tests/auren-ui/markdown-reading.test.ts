import assert from "node:assert/strict";
import test from "node:test";
import { Markdown, stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { getMarkdownTheme, initTheme } from "@earendil-works/pi-coding-agent";
import { normalizeReadingMarkdown, registerReadingMarkdown } from "../../extensions/auren-ui/markdown-reading.ts";
import { readableCitationMarkers } from "../../extensions/openai-web-search/citations.ts";
initTheme("dark");
function plain(text: string, width = 80): string {
  return new Markdown(text, 1, 0, getMarkdownTheme()).render(width).map(stripTerminalSequences).join("\n");
}
test("installed native Markdown reproduces word-adjacent Chinese punctuation, then display-only spacing resolves it", () => {
  for (const source of ["这是**注意：**请继续", "这是**“重要”**内容", "**重要：**下一步", "**这是一条完整句子。**后文",
    "English**important:**next", "价格**$5**元"]) {
    assert(plain(source).includes("**"), source);
    const result = normalizeReadingMarkdown(source);
    assert.notEqual(result, source);
    assert(!plain(result).includes("**"), result);
    assert.equal(result.replaceAll(" ", ""), source.replaceAll(" ", ""));
    assert.equal(normalizeReadingMarkdown(result), result);
  }
});
test("valid nested Markdown, incomplete/whitespace delimiters and triple emphasis stay native", () => {
  for (const source of ["正常 **强调** 文字", "中文**强调**后文", "**注意：** 下一步", "***重要：***后文", "**嵌套 _强调_：**后文",
    "** 尚未规范 **后文", "**注意：", "before*italic*after", "**escaped\\**部分**文字"]) {
    assert.equal(normalizeReadingMarkdown(source), source);
  }
});
test("literal code fences, indented code, inline/multiline backticks, escaped stars and URL destinations are preserved", () => {
  for (const source of ["```md\n这是**注意：**请继续\n```", "> ```md\n> 这是**注意：**请继续\n> ```",
    "- ```md\n  这是**注意：**请继续\n  ```", "~~~\n**注意：**请继续\n~~~", "    **注意：**请继续",
    "`**注意：**请继续`", "``x`**注意：**请继续``", "`first\n**注意：**请继续\nlast`", "\\**注意：\\**请继续",
    "[literal](https://example.org/**注意：**值(a))", "<https://example.org/**注意：**值>", "https://example.org/**注意：**值",
    "[ref]: https://example.org/**注意：**值"]) {
    assert.equal(normalizeReadingMarkdown(source), source, source);
  }
});
test("lists, quotes, task items and GFM tables retain structure and native width-safe rendering", () => {
  const source = ["- **注意：**请继续", "  - 子项 **“重要”**内容", "> **提醒：**需要确认", "- [x] **完成：**后续",
    "", "| 项目 | 说明 |", "| --- | --- |", "| A | **注意：**后文 |", "", "```ts", "const literal = '**注意：**后文';", "```"].join("\n");
  const result = normalizeReadingMarkdown(source);
  assert(result.includes("- **注意：** 请继续")); assert(result.includes("| A | **注意：** 后文 |"));
  assert(result.includes("const literal = '**注意：**后文';"));
  for (const width of [24, 40, 80, 160]) {
    const lines = new Markdown(result, 1, 0, getMarkdownTheme()).render(width);
    assert(lines.every(line => visibleWidth(line) <= width), String(width));
  }
});
test("public transformer only adapts assistant display and composes in either search/Auren order", () => {
  let transform: any;
  registerReadingMarkdown({ registerMarkdownTransformer: (fn: any) => { transform = fn; } } as any);
  const source = "这是**注意：**请继续 \uE200cite\uE202turn0search0\uE201";
  assert.equal(transform(source, { messageType: "user" }), source);
  assert.equal(transform(source, { messageType: "assistant-thinking" }), source);
  assert.equal(normalizeReadingMarkdown(readableCitationMarkers(source)), readableCitationMarkers(normalizeReadingMarkdown(source)));
});
test("large documents and very long spans fail conservatively instead of extra unbounded repair work", () => {
  const source = "**注意：**后文" + "x".repeat(128 * 1024);
  assert.equal(normalizeReadingMarkdown(source), source);
  const longLine = "**注意：**后文" + "x".repeat(8193);
  assert.equal(normalizeReadingMarkdown(longLine), longLine);
});
