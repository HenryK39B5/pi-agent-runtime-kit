import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { InMemoryCredentialStore, InMemoryModelsStore } from "@earendil-works/pi-ai";
import { ModelRuntime, createAgentSession, createCodemodeExtension, DefaultResourceLoader, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createExtension as rawCreateExtension, TOOL_NAME } from "../../extensions/kiro-web-search/index.ts";
globalThis.fetch = async () => { throw new Error("Codemode suite forbids real network"); };
const fixtureRoot = resolve(".tmp/gateway-kiro-codemode-offline");
mkdirSync(fixtureRoot, { recursive: true });
const fixtureState = resolve(fixtureRoot, "preference.json");
process.env.PI_KIRO_WEB_SEARCH_STATE = fixtureState;
const KEY = "public-offline-fixture-key-not-a-credential";
const target = { provider: "gateway-fixture", id: "fixture-opus", api: "anthropic-messages", baseUrl: "https://gateway.example.invalid" };
const fixtureTargets = [{ ...target, api: "anthropic-messages" as const, requiredUserAgent: "runtime-kit-fixture", allowUnreferencedSingleResult: true }];
const createExtension: typeof rawCreateExtension = (run, preferences) => rawCreateExtension(run, preferences, fixtureTargets);

const source = { type: "web_search_result", title: "Python Releases", url: "https://www.python.org/downloads/?version=3#stable", encrypted_content: "DO_NOT_RETAIN_OPAQUE" };
const usage = { input: 10, output: 12, cacheRead: 0, cacheWrite: 0, totalTokens: 22,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
function events(content: unknown = [source], stop = "end_turn"): Record<string, unknown>[] {
  return [
    { type: "message_start", message: { id: "public_fixture", type: "message", role: "assistant", model: target.id,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } },
    { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", id: "search_fixture", name: "web_search", input: {} } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "web_search_tool_result", tool_use_id: "search_fixture", content } },
    { type: "content_block_stop", index: 1 },
    { type: "content_block_start", index: 2, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 2, delta: { type: "text_delta", text: "Public search summary." } },
    { type: "content_block_stop", index: 2 },
    { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 12, server_tool_use: { web_search_requests: 1 } } },
    { type: "message_stop" },
  ];
}
function sse(values: Record<string, unknown>[]): Response {
  return new Response(values.map(value => `event: ${value.type}\ndata: ${JSON.stringify(value)}\n\n`).join(""),
    { headers: { "content-type": "text/event-stream" } });
}
async function runtime() {
  const runtime = await ModelRuntime.create({ modelsPath: null, modelsStore: new InMemoryModelsStore(),
    credentials: new InMemoryCredentialStore(), allowModelNetwork: false, refreshOnCreate: false });
  runtime.registerProvider("gateway-fixture", { api: "anthropic-messages", baseUrl: target.baseUrl, apiKey: KEY, authHeader: true,
    headers: { "User-Agent": "runtime-kit-fixture" }, models: [{ id: target.id, name: "Offline Opus fixture",
      reasoning: true, input: ["text", "image"], contextWindow: 1000000, maxTokens: 128000,
      cost: usage.cost, compat: { forceAdaptiveThinking: true, supportsTemperature: false },
      thinkingLevelMap: { off: null, minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" } }] });
  const model = runtime.getModel(target.provider, target.id); assert(model); return { runtime, model };
}

for (const mode of ["on", "only"] as const) for (const enabled of [true, false])
  test(`installed codemode ${mode}: search ${enabled ? "visible and callable" : "off and unreachable"} with max main`, async () => {
    writeFileSync(fixtureState, JSON.stringify({ version: 1, enabled }));
    const { runtime: modelRuntime, model } = await runtime();
    const cwd = resolve(fixtureRoot, "workspace"), agentDir = resolve(fixtureRoot, "agent");
    mkdirSync(cwd, { recursive: true }); mkdirSync(agentDir, { recursive: true });
    const settingsManager = SettingsManager.inMemory({ retry: { enabled: false, provider: { maxRetries: 0 } },
      compaction: { enabled: false }, cacheWarming: "off" });
    const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
      noPromptTemplates: true, noThemes: true, noContextFiles: true,
      additionalExtensionPaths: [],
      extensionFactories: [createExtension(), createCodemodeExtension({ mode, models: false })],
      systemPromptOverride: () => "Synthetic public offline fixture only.", appendSystemPromptOverride: () => [] });
    await loader.reload(); assert.deepEqual(loader.getExtensions().errors, []);
    const { session } = await createAgentSession({ cwd, agentDir, resourceLoader: loader, modelRuntime, model,
      thinkingLevel: "max", settingsManager, tools: ["codemode", TOOL_NAME], sessionManager: SessionManager.inMemory(cwd) });
    const deniedFetch = globalThis.fetch; let requests = 0, helpers = 0;
    globalThis.fetch = async (input, init) => {
      const body = JSON.parse(await new Request(input, init).text()); requests++;
      if (requests === 1) {
        assert.equal(body.output_config.effort, "max");
        assert.equal(body.tools.some((tool: any) => tool.name === TOOL_NAME), enabled && mode === "on");
        const description = body.tools.find((tool: any) => tool.name === "codemode").description;
        if (mode === "only") assert.equal(description.includes(TOOL_NAME), enabled);
        const code = `text(await tools.${TOOL_NAME}({query:"Python public release"}));`;
        return sse([events()[0],
          { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "public_codemode", name: "codemode", input: {} } },
          { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ code }) } },
          { type: "content_block_stop", index: 0 },
          { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 12 } },
          { type: "message_stop" }]);
      }
      if (body.tools?.[0]?.type === "web_search_20250305") {
        assert(enabled); helpers++; assert.equal(body.messages.length, 1); assert.equal(body.output_config.effort, "low");
        return sse(events());
      }
      assert.equal(body.output_config.effort, "max");
      if (enabled) assert(JSON.stringify(body).includes("Untrusted web data"));
      return sse(events().filter(value => ![0, 1].includes(value.index as number)));
    };
    try {
      await session.bindExtensions({ onError: error => { throw new Error(JSON.stringify(error)); } });
      assert.equal(session.getActiveToolNames().includes(TOOL_NAME), enabled);
      await session.prompt("Use the synthetic public codemode search fixture.");
      assert.equal(helpers, enabled ? 1 : 0); assert.equal(requests, enabled ? 3 : 2);
      assert.equal(session.thinkingLevel, "max");
      const result = session.messages.find(message => message.role === "toolResult" && message.toolName === "codemode");
      assert(result && result.role === "toolResult");
      assert.equal(result.isError, !enabled);
      if (enabled) {
        assert.equal(result.usage?.output, 12, "helper usage must be counted once through codemode");
        assert(result.content.some(block => block.type === "text" && block.text.includes("python.org")));
      }
    } finally { session.dispose(); globalThis.fetch = deniedFetch; }
  });
