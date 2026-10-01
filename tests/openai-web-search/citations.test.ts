import assert from "node:assert/strict";
import test from "node:test";
import { CitationCollector, CITATION_LIMITS, citationMarkdown, isCitationEntry, readableCitationMarkers, safeCitationUrl } from "../../extensions/openai-web-search/citations.ts";
const annotation = { type: "url_citation", url: "https://example.org/public?version=3#stable", title: "Public [fixture]" };
const item = (annotations: unknown[]) => ({ type: "message", role: "assistant", content: [{ type: "output_text", annotations }] });
const completed = (id: string, annotations: unknown[]) => ({ type: "response.completed", response: { id, status: "completed", output: [item(annotations)] } });
const marker = "\uE200cite\uE202turn0search0\uE201";
test("citation cleanup preserves quote/list fences, indented code and multiline/exact backtick runs", () => {
  for (const source of [`> \`\`\`md\n> ${marker}\n> \`\`\``, `- \`\`\`md\n  ${marker}\n  \`\`\``, `    ${marker}`,
    `\`first\n${marker}\nlast\``, `\`\`literal \` ${marker}\`\``]) assert.equal(readableCitationMarkers(source), source);
});

test("incremental annotations associate by item ID even if an auxiliary response arrives", () => {
  const collector = new CitationCollector();
  collector.observe({ type: "response.created", response: { id: "main" } });
  collector.observe({ type: "response.output_item.added", item: { type: "message", role: "assistant", id: "main_item" } });
  collector.observe({ type: "response.created", response: { id: "auxiliary" } });
  collector.observe({ type: "response.output_text.annotation.added", item_id: "main_item", annotation });
  collector.observe(completed("main", []));
  collector.observe(completed("auxiliary", []));
  assert.deepEqual(collector.take("auxiliary"), []);
  assert.equal(collector.take("main")[0].url, annotation.url);
});


test("OpenAI collector binds only completed response IDs, never search hits or guessed IDs", () => {
  const collector = new CitationCollector();
  collector.observe({ type: "response.created", response: { id: "response_public" } });
  collector.observe({ type: "response.output_item.done", item: item([annotation]) });
  assert.deepEqual(collector.take("another_response"), []);
  collector.observe(completed("response_public", [annotation]));
  const sources = collector.take("response_public");
  assert.equal(sources.length, 1); assert.equal(sources[0].url, annotation.url);
  assert.deepEqual(collector.take("response_public"), []);
  collector.observe({ type: "response.created", response: { id: "incomplete" } });
  collector.observe({ type: "response.output_item.done", item: item([annotation]) });
  assert.deepEqual(collector.take("incomplete"), []);
});
test("OpenAI citation safety rejects signed, credential, local, bidi and malformed URLs", () => {
  for (const url of ["https://user:pass@example.org/", "https://example.org/?X-Amz-Signature=PUBLIC_FIXTURE",
    "https://example.org/#access_token=PUBLIC_FIXTURE", "http://127.0.0.1/a", "https://example.org/a\u202e", "file:///a", "not a URL"])
    assert.equal(safeCitationUrl(url), false, url);
  assert(safeCitationUrl(annotation.url));
  const collector = new CitationCollector();
  collector.observe(completed("public", [{ ...annotation, url: "https://example.org/?sig=PUBLIC_FIXTURE" },
    { ...annotation, title: "a\u001b title https://example.org/?X-Goog-Signature=PUBLIC_FIXTURE" }]));
  const result = collector.take("public");
  assert.equal(result.length, 1); assert(!JSON.stringify(result).includes("PUBLIC_FIXTURE")); assert(!result[0].title.includes("\u001b"));
});
test("OpenAI citation state is bounded and clear/failure does not retain earlier sources", () => {
  const collector = new CitationCollector();
  for (let i = 0; i < 20; i++) collector.observe(completed("response" + i, Array.from({ length: 20 }, (_, n) => ({ ...annotation, url: "https://example.org/" + n }))));
  assert.deepEqual(collector.take("response0"), []);
  assert.equal(collector.take("response19").length, CITATION_LIMITS.sources);
  collector.observe(completed("failed", [annotation]));
  collector.observe({ type: "response.failed", response: { id: "failed" } });
  assert.deepEqual(collector.take("failed"), []);
  collector.clear(); assert.deepEqual(collector.take("response18"), []);
});
test("display-only cite marker cleanup preserves code, unrelated message syntax and cannot invent URLs", () => {
  assert.equal(readableCitationMarkers("Public " + marker), "Public 【网页引用】");
  for (const code of ["`" + marker + "`", "```text\n" + marker + "\n```", "~~~\n" + marker + "\n~~~"])
    assert.equal(readableCitationMarkers(code), code);
  assert.equal(readableCitationMarkers("citation and cite123"), "citation and cite123");
  const data = { version: 1 as const, assistantEntryId: "answer", sources: [], missing: true };
  assert(isCitationEntry(data)); assert(citationMarkdown(data).includes("无法从内部 cite 标识还原"));
});
test("citation entry validation and Markdown escape labels and retain exact returned URLs", () => {
  const data = { version: 1 as const, assistantEntryId: "answer", sources: [annotation], missing: false };
  assert(isCitationEntry(data)); const markdown = citationMarkdown(data);
  assert(markdown.includes(annotation.url)); assert(markdown.includes("\\[fixture\\]"));
  assert(!isCitationEntry({ ...data, sources: [{ ...annotation, url: "javascript:alert(1)" }] }));
  assert(!isCitationEntry({ ...data, sources: Array(9).fill(annotation) }));
});
