import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

const root = process.env.PI_TEST_PACKAGE_ROOT;
if (!root) throw new Error("PI_TEST_PACKAGE_ROOT required");
const { processResponsesStream, convertResponsesTools } = await import(pathToFileURL(`${root}/node_modules/@earendil-works/pi-ai/dist/api/openai-responses-shared.js`).href);

test("Pi 0.85.1 hosted search events and URL annotations are not retained", async () => {
  const search = { type: "web_search_call", id: "ws_fixture", status: "completed", action: { type: "search", query: "fixture" } };
  const message = { type: "message", id: "msg_fixture", role: "assistant", status: "completed", content: [{ type: "output_text", text: "Public result", annotations: [{ type: "url_citation", start_index: 0, end_index: 13, url: "https://example.com/source", title: "Fixture source" }] }] };
  async function* events() {
    yield { type: "response.output_item.added", output_index: 0, item: search };
    yield { type: "response.web_search_call.completed", output_index: 0, item_id: search.id };
    yield { type: "response.output_item.done", output_index: 0, item: search };
    yield { type: "response.output_item.added", output_index: 1, item: message };
    yield { type: "response.output_item.done", output_index: 1, item: message };
    yield { type: "response.completed", response: { id: "resp_fixture", status: "completed", output: [search, message] } };
  }
  const output: any = { content: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: {} }, stopReason: "pending" };
  const emitted: any[] = [];
  await processResponsesStream(events(), output, { push: (event: any) => emitted.push(event) }, { cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } });
  assert.equal(output.stopReason, "stop");
  assert.equal(output.content.length, 1);
  assert.equal(output.content[0].text, "Public result");
  assert.equal(output.content[0].annotations, undefined);
  assert.ok(!JSON.stringify(output).includes("https://example.com/source"));
  assert.ok(!emitted.some(event => event.type.startsWith("toolcall")));
});

test("ordinary Pi tools convert to function tools, not hosted web search", () => {
  const tools = convertResponsesTools([{ name: "read", description: "fixture", parameters: { type: "object", properties: {} } }]);
  assert.equal(tools[0].type, "function");
  assert.equal(tools[0].name, "read");
});
