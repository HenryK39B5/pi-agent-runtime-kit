import assert from "node:assert/strict";
import test from "node:test";
import { publicUrl, redactSensitiveUrls, sourceMarkdown } from "../../extensions/kiro-web-search/links.ts";
import { renderData, SearchCollector } from "../../extensions/kiro-web-search/protocol.ts";

test("Kiro summaries/titles redact signed and credential URLs, preserving ordinary public query/fragment", () => {
  for (const url of ["https://assets.example.org/a?X-Amz-Signature=PUBLIC_FIXTURE", "https://assets.example.org/a?X-Goog-Credential=PUBLIC_FIXTURE",
    "https://example.org/?sig=PUBLIC_FIXTURE", "https://user:PUBLIC_FIXTURE@example.org/a", "https://example.org/#access_token=PUBLIC_FIXTURE",
    "https://example.org/?%74oken=PUBLIC_FIXTURE"]) {
    assert.equal(publicUrl(url), false);
    assert(!redactSensitiveUrls("Download " + url).includes("PUBLIC_FIXTURE"));
  }
  const url = "https://www.python.org/downloads/?version=3#stable";
  assert(publicUrl(url)); assert.equal(redactSensitiveUrls(url), url);
  assert(!publicUrl("https://example.org/a\u202eb")); assert(!publicUrl("https://example.org/a>"));
});
test("Kiro sources render escaped labels as actual Markdown URLs without inventing sources", () => {
  const source = { title: "Public [fixture]", url: "https://example.org/a(b)?version=3#stable" };
  assert(sourceMarkdown(source).includes(source.url));
  assert(sourceMarkdown(source).includes("\\[fixture\\]"));
  const output = renderData({ status: "ok", summary: "Public", sources: [source], truncated: false });
  assert(output.includes("Sources (cite these exact returned URLs)"));
  assert(!renderData({ status: "empty", summary: "No results", sources: [], truncated: false }).includes("Sources ("));
});
test("full collector cleans a sensitive URL in title and summary but preserves the verified public source", () => {
  const collector = new SearchCollector();
  const sensitive = "https://assets.example.org/a?X-Amz-Signature=PUBLIC_FIXTURE";
  for (const event of [
    { type: "message_start", message: { role: "assistant" } },
    { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", id: "public_call", name: "web_search" } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "web_search_tool_result", tool_use_id: "public_call",
      content: [{ type: "web_search_result", title: "Download " + sensitive, url: "https://example.org/public" }] } },
    { type: "content_block_stop", index: 1 },
    { type: "message_delta", delta: { stop_reason: "end_turn" } }, { type: "message_stop" },
  ]) collector.observe(event);
  const data = collector.finish("Download " + sensitive, "stop");
  assert.equal(data.status, "ok"); assert(!JSON.stringify(data).includes("PUBLIC_FIXTURE"));
  assert.equal(data.sources[0].url, "https://example.org/public");
});
