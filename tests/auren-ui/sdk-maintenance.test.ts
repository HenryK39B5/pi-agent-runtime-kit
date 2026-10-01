import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { InMemoryCredentialStore, InMemoryModelsStore, Type } from "@earendil-works/pi-ai";
import { createAgentSession, DefaultResourceLoader, defineTool, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { COMPLETION_ENTRY_TYPE } from "../../extensions/auren-ui/completion.ts";
import { estimateSessionActiveMs, RUN_TIMING_ENTRY_TYPE } from "../../extensions/auren-ui/runtime.ts";
import { createOpenAIWebSearchExtension } from "../../extensions/openai-web-search/index.ts";
import { CITATIONS_ENTRY_TYPE } from "../../extensions/openai-web-search/citations.ts";
const marker = "\uE200cite\uE202turn0search0\uE201";
const key = "public-offline-fixture-key-not-a-credential";
const cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
function response(id: string, url: string, annotated: boolean): Response {
  const item = { type: "message", id: "public_message_" + id, role: "assistant", status: "completed", content: [{ type: "output_text",
    text: "Public answer. " + marker, annotations: annotated ? [{ type: "url_citation", title: "Public " + id, url, start_index: 0, end_index: 5 }] : [] }] };
  const final = { id, status: "completed", object: "response", output: [item], usage: { input_tokens: 10, output_tokens: 5,
    total_tokens: 15, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } };
  return new Response([{ type: "response.created", response: { ...final, status: "in_progress", output: [] } },
    { type: "response.output_item.done", output_index: 0, item }, { type: "response.completed", response: final }]
    .map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
}

test("installed SDK: source sidecars + Auren failure/continue timing survive reconstruction without model-context mutation", async () => {
  const root = resolve(process.env.PI_CODING_AGENT_DIR!, "sdk-maintenance"), cwd = resolve(root, "workspace"), agentDir = resolve(root, "agent");
  mkdirSync(cwd, { recursive: true }); mkdirSync(agentDir, { recursive: true });
  writeFileSync(process.env.PI_OPENAI_WEB_SEARCH_STATE!, JSON.stringify({ version: 1, enabled: true }));
  const modelRuntime = await ModelRuntime.create({ modelsPath: null, modelsStore: new InMemoryModelsStore(),
    credentials: new InMemoryCredentialStore(), allowModelNetwork: false, refreshOnCreate: false });
  modelRuntime.registerProvider("openai", { api: "openai-responses", baseUrl: "https://public-fixture.invalid/v1", apiKey: key,
    models: [{ id: "search-model-alpha", name: "Public fixture", reasoning: false, input: ["text"], contextWindow: 200000, maxTokens: 2048, cost }] });
  const model = modelRuntime.getModel("openai", "search-model-alpha"); assert(model);
  const settingsManager = SettingsManager.inMemory({ retry: { enabled: false, provider: { maxRetries: 0 } }, compaction: { enabled: false }, cacheWarming: "off" });
  const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true, noSkills: true, noThemes: true,
    noPromptTemplates: true, noContextFiles: true, extensionFactories: [createOpenAIWebSearchExtension([{ provider: "openai", id: "search-model-alpha", api: "openai-responses", toolType: "web_search" }])],
    additionalExtensionPaths: [
      resolve("extensions/auren-ui/index.ts"), resolve("extensions/kiro-web-search/index.ts")],
    systemPromptOverride: () => "Public synthetic fixture only", appendSystemPromptOverride: () => [] });
  await loader.reload(); assert.deepEqual(loader.getExtensions().errors, []);
  const manager = SessionManager.inMemory(cwd);
  const { session } = await createAgentSession({ cwd, agentDir, resourceLoader: loader, modelRuntime, model, settingsManager,
    tools: ["public_echo", "kiro_web_search"], sessionManager: manager, customTools: [defineTool({ name: "public_echo", label: "Fixture",
      description: "Public fixture", parameters: Type.Object({ text: Type.String() }),
      async execute() { return { content: [{ type: "text" as const, text: "Fixture" }], details: undefined }; } })] });
  const beforeFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init); assert.equal(new URL(request.url).hostname, "public-fixture.invalid");
    const wire = await request.text(); assert(!wire.includes(CITATIONS_ENTRY_TYPE)); assert(!wire.includes(RUN_TIMING_ENTRY_TYPE));
    assert(!wire.includes("https://example.org/source")); calls++;
    if (calls === 2) return new Response("Public synthetic failure", { status: 503 });
    return response("public_response_" + calls, "https://example.org/source" + calls, calls !== 4);
  };
  try {
    await session.bindExtensions({ onError: error => { throw new Error(JSON.stringify(error)); } });
    await session.prompt("Public first synthetic answer.");
    await session.prompt("Public synthetic failure.");
    await session.prompt("请继续（公开合成测试，不执行真实工具）。");
    await session.prompt("Public cite marker without annotation.");
    assert.equal(calls, 4);
    const entries = manager.getEntries();
    const metadata = entries.filter(entry => entry.type === "custom" && [COMPLETION_ENTRY_TYPE, RUN_TIMING_ENTRY_TYPE].includes(entry.customType));
    assert.equal(metadata.length, 4);
    assert.equal(metadata.filter(entry => entry.type === "custom" && entry.customType === RUN_TIMING_ENTRY_TYPE).length, 1);
    const expected = metadata.reduce((sum, entry) => sum + (entry.type === "custom" ? (entry.data as any).durationMs : 0), 0);
    assert.equal(estimateSessionActiveMs(entries), expected);
    const references = entries.filter(entry => entry.type === "custom" && entry.customType === CITATIONS_ENTRY_TYPE);
    assert.equal(references.length, 3);
    for (const entry of references) {
      if (entry.type !== "custom") continue;
      const data = entry.data as any, answer = manager.getEntry(data.assistantEntryId);
      assert(answer?.type === "message" && answer.message.role === "assistant");
    }
    assert(references.at(-1)?.type === "custom" && (references.at(-1) as any).data.missing);
    const context = JSON.stringify(manager.buildSessionContext().messages);
    assert(context.includes(marker)); // Display transformer, not a rewrite of provider text.
    assert(!context.includes("https://example.org/source"));
    assert(!context.includes(CITATIONS_ENTRY_TYPE)); assert(!context.includes(COMPLETION_ENTRY_TYPE));
    assert(!session.getActiveToolNames().includes("kiro_web_search"));
  } finally { session.dispose(); globalThis.fetch = beforeFetch; }
});
