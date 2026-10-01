import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { InMemoryCredentialStore, InMemoryModelsStore, Type } from "@earendil-works/pi-ai";
import { createAgentSession, DefaultResourceLoader, defineTool, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { OPENAI_SEARCH_GUIDELINE, createOpenAIWebSearchExtension } from "../../extensions/openai-web-search/index.ts";
import { CITATIONS_ENTRY_TYPE } from "../../extensions/openai-web-search/citations.ts";
const root = resolve(".tmp/openai-web-sdk-offline");
mkdirSync(root, { recursive: true });
process.env.PI_OPENAI_WEB_SEARCH_STATE = resolve(root, "preference.json");
globalThis.fetch = async () => { throw new Error("OpenAI SDK suite forbids real network"); };
const key = "public-offline-fixture-key-not-a-credential";
const cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
function response(): Response {
  const item = { type: "message", id: "public_message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: "Public fixture response.", annotations: [{ type: "url_citation",
      url: "https://www.python.org/downloads/?version=3#stable", title: "Python releases", start_index: 0, end_index: 10 }] }] };
  const final = { id: "public_response", object: "response", status: "completed", output: [item],
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } };
  return new Response([
    { type: "response.created", response: { ...final, status: "in_progress", output: [] } },
    { type: "response.output_item.done", output_index: 0, item },
    { type: "response.completed", response: final },
  ].map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""),
  { headers: { "content-type": "text/event-stream" } });
}
for (const state of ["on", "off", "unsupported"] as const)
  test(`installed OpenAI SDK: ${state} controls hosted declaration and model-visible section, preserving custom prompt`, async () => {
    const enabled = state !== "off", supported = state !== "unsupported";
    writeFileSync(process.env.PI_OPENAI_WEB_SEARCH_STATE!, JSON.stringify({ version: 1, enabled }));
    const modelRuntime = await ModelRuntime.create({ modelsPath: null, modelsStore: new InMemoryModelsStore(),
      credentials: new InMemoryCredentialStore(), allowModelNetwork: false, refreshOnCreate: false });
    const id = supported ? "search-model-alpha" : "unrequested-gpt-fixture";
    modelRuntime.registerProvider("openai", { api: "openai-responses", baseUrl: "https://public-fixture.invalid/v1", apiKey: key,
      models: [{ id, name: "Public offline OpenAI fixture", reasoning: true, input: ["text"], contextWindow: 200000,
        maxTokens: 2048, cost }] });
    const model = modelRuntime.getModel("openai", id); assert(model);
    const cwd = resolve(root, "workspace"), agentDir = resolve(root, "agent");
    mkdirSync(cwd, { recursive: true }); mkdirSync(agentDir, { recursive: true });
    const settingsManager = SettingsManager.inMemory({ retry: { enabled: false, provider: { maxRetries: 0 } },
      compaction: { enabled: false }, cacheWarming: "off" });
    const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
      noPromptTemplates: true, noThemes: true, noContextFiles: true,
      additionalExtensionPaths: [],
      extensionFactories: [createOpenAIWebSearchExtension([{ provider: "openai", id: "search-model-alpha", api: "openai-responses", toolType: "web_search" }])],
      systemPromptOverride: () => "PUBLIC_CUSTOM_SYSTEM_PROMPT", appendSystemPromptOverride: () => ["PUBLIC_EXISTING_SAFETY"] });
    await loader.reload(); assert.deepEqual(loader.getExtensions().errors, []);
    const manager = SessionManager.inMemory(cwd);
    const { session } = await createAgentSession({ cwd, agentDir, resourceLoader: loader, modelRuntime, model,
      settingsManager, tools: ["public_echo"], sessionManager: manager, customTools: [defineTool({
        name: "public_echo", label: "Public echo", description: "Public offline fixture only", parameters: Type.Object({ text: Type.String() }),
        async execute() { return { content: [{ type: "text" as const, text: "PUBLIC_ECHO" }], details: undefined }; },
      })] });
    const blockedFetch = globalThis.fetch; let requests = 0;
    globalThis.fetch = async (input, init) => {
      requests++; const request = new Request(input, init); const wire = await request.clone().text(); const body = JSON.parse(wire);
      assert.equal(request.headers.get("authorization"), `Bearer ${key}`); assert(!wire.includes(key));
      assert(wire.includes("PUBLIC_CUSTOM_SYSTEM_PROMPT")); assert(wire.includes("PUBLIC_EXISTING_SAFETY"));
      assert.equal(wire.includes(OPENAI_SEARCH_GUIDELINE), enabled && supported);
      assert.equal(body.tools.filter((tool: any) => tool.type === "web_search").length, enabled && supported ? 1 : 0);
      assert(body.tools.some((tool: any) => tool.name === "public_echo"));
      return response();
    };
    try {
      await session.bindExtensions({ onError: error => { throw new Error(JSON.stringify(error)); } });
      await session.prompt("Public offline capability declaration fixture.");
      assert.equal(requests, 1); assert.equal(session.getLastAssistantText(), "Public fixture response.");
      const references = manager.getEntries().filter(entry => entry.type === "custom" && entry.customType === CITATIONS_ENTRY_TYPE);
      assert.equal(references.length, enabled && supported ? 1 : 0);
      if (references[0]?.type === "custom") {
        const data = references[0].data as any;
        assert.equal(manager.getEntry(data.assistantEntryId)?.type, "message");
        assert.equal(data.sources[0].url, "https://www.python.org/downloads/?version=3#stable");
      }
      assert(!JSON.stringify(manager.buildSessionContext().messages).includes(CITATIONS_ENTRY_TYPE));
      assert(!JSON.stringify(manager.buildSessionContext().messages).includes("python.org/downloads"));
      // Guidance is request-local: the outgoing body above is authoritative, not the idle base prompt.
      assert.equal(session.systemPrompt.includes(OPENAI_SEARCH_GUIDELINE), false);
    } finally { session.dispose(); globalThis.fetch = blockedFetch; }
  });
