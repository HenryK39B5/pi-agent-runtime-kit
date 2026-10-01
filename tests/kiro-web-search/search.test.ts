import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Type, InMemoryCredentialStore, InMemoryModelsStore } from "@earendil-works/pi-ai";
import { defineTool, ModelRuntime, createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { LIMITS, SearchCollector, SearchFailure, matchesTarget as rawMatchesTarget, promptFor, helperPayload as rawHelperPayload, validateQuery, renderData } from "../../extensions/kiro-web-search/protocol.ts";
import { search as rawSearch } from "../../extensions/kiro-web-search/search.ts";
import { createExtension as rawCreateExtension, TOOL_NAME } from "../../extensions/kiro-web-search/index.ts";
const fixtureState = resolve(".tmp/gateway-kiro-search-offline/preference.json");
mkdirSync(resolve(".tmp/gateway-kiro-search-offline"), { recursive: true });
writeFileSync(fixtureState, JSON.stringify({ version: 1, enabled: true }));
process.env.PI_KIRO_WEB_SEARCH_STATE = fixtureState;
// An unexpected real HTTP request fails the test. All SDK/provider traffic uses synthetic fetch below.
globalThis.fetch = async () => { throw new Error("Offline suite forbids network"); };
const KEY = "public-offline-fixture-key-not-a-credential";
const target = { provider: "gateway-fixture", id: "fixture-opus", api: "anthropic-messages", baseUrl: "https://gateway.example.invalid" };
const fixtureTargets = [{ ...target, api: "anthropic-messages" as const, requiredUserAgent: "runtime-kit-fixture", allowUnreferencedSingleResult: true }];
const createExtension: typeof rawCreateExtension = (run, preferences) => rawCreateExtension(run, preferences, fixtureTargets);

const matchesTarget = (model: any) => rawMatchesTarget(model, fixtureTargets);
const helperPayload = (body: unknown, query: string) => rawHelperPayload(body, query, target.id);
const search: typeof rawSearch = (registry, model, query, options) => rawSearch(registry, model, query, { ...options, targets: fixtureTargets });

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
function collect(values = events()): SearchCollector {
  const collector = new SearchCollector([KEY]); for (const value of values) collector.observe(value); return collector;
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
const rejectsCode = (code: string) => (error: unknown) => error instanceof SearchFailure && error.code === code;

test("exact provider/model/API/base endpoint binding", () => {
  assert(matchesTarget(target)); assert(matchesTarget({ ...target, baseUrl: target.baseUrl + "/" }));
  for (const wrong of [{ provider: "gateway" }, { id: "claude-opus-other" }, { api: "openai-responses" },
    { baseUrl: "https://gateway.example.invalid.evil.example" }, { baseUrl: target.baseUrl + "/v1" }, { baseUrl: "http://gateway.example.invalid" }])
    assert.equal(matchesTarget({ ...target, ...wrong }), false);
});
test("query limits, control characters and obvious secrets fail closed", () => {
  assert.equal(validateQuery("  Python stable release  "), "Python stable release");
  for (const value of [undefined, "", " ", "a".repeat(801), "a\nb", "a\u001bb", "a\u202eb", "sk-" + "0".repeat(16), "password=fixture"])
    assert.throws(() => validateQuery(value), rejectsCode("invalid_query"));
});
test("isolated adaptive/low payload and single hosted declaration; no mutation of main tools", () => {
  const original = { model: target.id, stream: true, max_tokens: 1024, thinking: { type: "adaptive" },
    output_config: { effort: "low" }, messages: [{ role: "user", content: promptFor("public query") }], tools: [{ name: "ordinary" }] };
  const result = helperPayload(original, "public query"); assert.equal(original.tools[0].name, "ordinary");
  assert.deepEqual(result.tools, [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }]);
  for (const wrong of [{ system: "PRIVATE_CONTEXT" }, { thinking: { type: "disabled" } }, { output_config: { effort: "max" } },
    { messages: [...original.messages, { role: "user", content: "PRIVATE_HISTORY" }] }, { tool_choice: { type: "any" } }])
    assert.throws(() => helperPayload({ ...original, ...wrong }, "public query"), rejectsCode("request_shape"));
});
test("matched search execution and complete ending produce bounded public data only", () => {
  const data = collect().finish(`Summary ${KEY}\u001b ${"sk-" + "0".repeat(16)}`, "stop");
  assert.equal(data.status, "ok"); assert.equal(data.sources[0].url, source.url); assert.equal(data.webSearchRequests, 1);
  const result = renderData(data); assert(!result.includes(KEY)); assert(!result.includes("encrypted_content"));
  assert(!result.includes("DO_NOT_RETAIN_OPAQUE")); assert(!result.includes("\u001b")); assert(result.includes("Untrusted web data"));
});
test("executed empty search does not return unsupported prior knowledge", () => {
  const result = collect(events([])).finish("Invented answer from prior knowledge", "stop");
  assert.equal(result.status, "empty"); assert.equal(result.sources.length, 0); assert(!result.summary.includes("Invented"));
});
test("missing, mismatched, duplicate, client tool and incomplete search never succeed", () => {
  const normal = events();
  const wrongId = events(); (wrongId[3].content_block as Record<string, unknown>).tool_use_id = "unmatched";
  const client = events(); (client[1].content_block as Record<string, unknown>).type = "tool_use";
  for (const values of [[], normal.slice(0, -1), events([source], "max_tokens"), events([source], "pause_turn"), wrongId, client,
    [normal[0], ...normal.slice(3)], [...normal, normal[9]], [normal[0], normal[1], normal[1], ...normal.slice(2)]])
    assert.throws(() => collect(values).finish("Summary", "stop"), rejectsCode("protocol_error"));
});
test("Gateway missing-reference variant is opt-in, adjacent and explicitly reported", () => {
  const fixture = events(); delete (fixture[3].content_block as Record<string, unknown>).tool_use_id;
  assert.throws(() => collect(fixture).finish("", "stop"), rejectsCode("protocol_error"));
  const collector = new SearchCollector([], { allowUnreferencedSingleResult: true });
  for (const event of fixture) collector.observe(event);
  assert.equal(collector.finish("Public summary", "stop").resultAssociation, "single-search-adjacent");
});
test("Gateway association never repairs explicit IDs, ambiguity, open call or non-adjacent result", () => {
  for (const mode of ["mismatch", "null", "undefined-field", "extra-field", "non-adjacent", "call-open", "incomplete"]) {
    const fixture = events(); const block = fixture[3].content_block as Record<string, unknown>;
    delete block.tool_use_id;
    if (mode === "mismatch") block.tool_use_id = "explicitly_wrong";
    if (mode === "null") block.tool_use_id = null;
    if (mode === "undefined-field") block.tool_use_id = undefined;
    if (mode === "extra-field") block.id = "unexpected";
    if (mode === "non-adjacent") { fixture[3].index = 9; fixture[4].index = 9; }
    if (mode === "call-open") fixture.splice(2, 1);
    if (mode === "incomplete") fixture.pop();
    const collector = new SearchCollector([], { allowUnreferencedSingleResult: true });
    for (const event of fixture) collector.observe(event);
    assert.throws(() => collector.finish("Public summary", "stop"), rejectsCode("protocol_error"), mode);
  }
});
test("real installed SDK accepts only the narrow Gateway missing-reference variant in isolated helper", async () => {
  const { runtime: registry, model } = await runtime();
  const fixture = events(); delete (fixture[3].content_block as Record<string, unknown>).tool_use_id;
  const result = await search(registry, model, "Public query", { fetch: async () => sse(fixture) });
  assert.equal(result.data.status, "ok"); assert.equal(result.data.resultAssociation, "single-search-adjacent");
});
test("a reviewed helper target still rejects absent references unless its compatibility policy explicitly opts in", async () => {
  const { runtime: registry, model } = await runtime();
  const fixture = events(); delete (fixture[3].content_block as Record<string, unknown>).tool_use_id;
  await assert.rejects(rawSearch(registry, model, "Public query", {
    targets: [{ ...target, api: "anthropic-messages" }], fetch: async () => sse(fixture),
  }), rejectsCode("protocol_error"));
});
test("search errors and malformed result items are errors, not empty results", () => {
  assert.throws(() => collect(events({ type: "web_search_tool_result_error", error_code: "fixture" })).finish("", "stop"), rejectsCode("search_error"));
  assert.throws(() => collect(events([{ type: "unknown" }])).finish("", "stop"), rejectsCode("protocol_error"));
});
test("unsafe source URLs and credential-bearing URLs rejected; query/fragment preserved", () => {
  for (const url of ["file:///fixture", "https://localhost/x", "http://127.0.0.1/x", "http://[::1]/x", "https://user:pass@example.org/",
    "https://example.org/?token=secret", "https://example.org/?X-Amz-Signature=fixture", `https://example.org/${KEY}`, "not a URL"])
    assert.throws(() => collect(events([{ ...source, url }])).finish("", "stop"), rejectsCode("protocol_error"));
});
test("source count and UTF-8 summary caps are explicit", () => {
  const data = collect(events(Array.from({ length: 12 }, (_, i) => ({ ...source, url: `https://example.org/${i}` }))))
    .finish("中".repeat(9000), "stop");
  assert.equal(data.sources.length, LIMITS.sources); assert.equal(data.truncated, true);
  assert(Buffer.byteLength(data.summary) <= LIMITS.summaryBytes); assert(Buffer.byteLength(renderData(data)) <= LIMITS.outputBytes);
});
test("real installed SDK parses simulated SSE; one bounded request, ordinary tool result data", async () => {
  const { runtime: registry, model } = await runtime(); let requests = 0;
  const result = await search(registry, model, "Python public release", { fetch: async (input, init) => {
    requests++; const req = new Request(input, init); const body = await req.clone().text();
    assert.equal(init?.redirect, "error"); assert(init?.signal); assert(!body.includes(KEY)); assert(!body.includes("PRIVATE_HISTORY"));
    assert.equal(req.headers.get("authorization"), "Bearer " + KEY);
    return sse(events());
  } });
  assert.equal(requests, 1); assert.equal(result.data.status, "ok"); assert.equal(result.usage.output, 12);
  assert(!JSON.stringify(result).includes("DO_NOT_RETAIN_OPAQUE"));
});
test("non-target, invalid input and pre-cancellation make zero HTTP requests", async () => {
  const { runtime: registry, model } = await runtime(); let requests = 0;
  const fetch = async () => { requests++; return sse(events()); };
  await assert.rejects(search(registry, { ...model, provider: "other" }, "public", { fetch }), rejectsCode("unsupported_model"));
  await assert.rejects(search(registry, model, "", { fetch }), rejectsCode("invalid_query"));
  await assert.rejects(search(registry, model, "public", { fetch, signals: [AbortSignal.abort()] }), rejectsCode("cancelled"));
  assert.equal(requests, 0);
});
test("actual resolved credential accidentally in query is blocked before network", async () => {
  const { runtime: registry, model } = await runtime(); let requests = 0;
  await assert.rejects(search(registry, model, `find ${KEY}`, { fetch: async () => { requests++; return sse(events()); } }), rejectsCode("credential_in_query"));
  assert.equal(requests, 0);
});
test("HTTP failures and SDK transport exceptions sanitized; never retry", async () => {
  const { runtime: registry, model } = await runtime();
  for (const status of [400, 401, 403, 429, 500, 302]) {
    let requests = 0;
    await assert.rejects(search(registry, model, "public", { fetch: async () => {
      requests++; return new Response(`SECRET_SERVER_BODY ${KEY}`, { status });
    } }), (error: unknown) => { assert(error instanceof SearchFailure); assert.equal(error.code, "http_error");
      assert.equal(error.httpStatus, status); assert(!error.message.includes(KEY)); assert(!error.message.includes("SECRET_SERVER_BODY")); return true; });
    assert.equal(requests, 1);
  }
  await assert.rejects(search(registry, model, "public", { fetch: async () => { throw new Error(`PRIVATE_PATH ${KEY}`); } }),
    (error: unknown) => { assert(error instanceof SearchFailure); assert.equal(error.code, "transport_error"); assert(!error.message.includes(KEY)); return true; });
});
test("declared and streamed response byte caps cancel consumption", async () => {
  const { runtime: registry, model } = await runtime();
  for (const declared of [true, false]) {
    await assert.rejects(search(registry, model, "public", { fetch: async () => new Response("x".repeat(LIMITS.responseBytes + 1),
      { headers: { "content-type": "text/event-stream", ...(declared ? { "content-length": String(LIMITS.responseBytes + 1) } : {}) } }) }), rejectsCode("response_limit"));
  }
});
test("HTTP timeout and caller cancellation abort their request", async () => {
  const { runtime: registry, model } = await runtime(); const caller = new AbortController(); let started!: () => void;
  const start = new Promise<void>(resolve => { started = resolve; });
  const fetch: typeof globalThis.fetch = async (_req, init) => {
    started(); return await new Promise<Response>((_resolve, reject) => {
      const signal = init!.signal!; signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  };
  const pending = search(registry, model, "public", { fetch, signals: [caller.signal] });
  await start; caller.abort(); await assert.rejects(pending, rejectsCode("cancelled"));
  // Keep this fixture's process alive because production timers are intentionally unref'ed.
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(search(registry, model, "public", { fetch, timeoutMs: 10 }), rejectsCode("timeout")); }
  finally { clearTimeout(keepAlive); }
});
test("timeout also cancels a stalled response body and preserves available failure usage", async () => {
  const { runtime: registry, model } = await runtime(); let cancelled = false;
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(search(registry, model, "public", { timeoutMs: 30, fetch: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode(`event: message_start\ndata: ${JSON.stringify(events()[0])}\n\n`)); },
      cancel() { cancelled = true; },
    }), { headers: { "content-type": "text/event-stream" } }) }), (error: unknown) => {
      assert(error instanceof SearchFailure); assert.equal(error.code, "timeout"); return true;
    });
    assert.equal(cancelled, true);
    await assert.rejects(search(registry, model, "public", { fetch: async () => sse(events().slice(0, -1)) }), (error: unknown) => {
      assert(error instanceof SearchFailure); assert.equal(error.code, "protocol_error"); assert.equal(error.usage?.output, 12); return true;
    });
  } finally { clearTimeout(keepAlive); }
});
test("real SDK rejects incomplete stream and ordinary client tool use", async () => {
  const { runtime: registry, model } = await runtime();
  const client = events(); (client[1].content_block as Record<string, unknown>).type = "tool_use";
  for (const fixture of [events().slice(0, -1), client])
    await assert.rejects(search(registry, model, "public", { fetch: async () => sse(fixture) }), rejectsCode("protocol_error"));
});
test("tool lifecycle preserves other tools, cancels model switch/shutdown and sanitizes errors", async () => {
  let active = ["read", "codemode", "ordinary"];
  const handlers: Record<string, (...args: any[]) => any> = {}; let tool: any;
  const pi = { registerTool: (value: unknown) => { tool = value; }, on: (event: string, handler: any) => { handlers[event] = handler; },
    events: { on() {}, emit() {} }, registerCommand() {},
    getActiveTools: () => active, setActiveTools: (names: string[]) => { active = names; } } as unknown as ExtensionAPI;
  createExtension(async (_registry, _model, _query, options) => {
    const signal = options!.signals!.at(-1)!;
    return await new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(signal.reason), { once: true }); });
  })(pi);
  handlers.session_start({}, { model: target, ui: { notify() {} } }); assert.deepEqual(active, ["read", "codemode", "ordinary", TOOL_NAME]);
  const pending = tool.execute("fixture", { query: "public" }, undefined, undefined, { model: target, modelRegistry: {} });
  handlers.model_select({ model: { ...target, provider: "other" } });
  const result = await pending; assert.equal(result.isError, true); assert.equal(result.details.code, "unsupported_model");
  assert.deepEqual(active, ["read", "codemode", "ordinary"]);
  handlers.model_select({ model: target });
  const shutdown = tool.execute("fixture2", { query: "public" }, undefined, undefined, { model: target, modelRegistry: {} });
  handlers.session_shutdown(); assert.equal((await shutdown).details.code, "cancelled");
  createExtension(async () => { throw new Error(KEY); })(pi);
  handlers.session_start({}, { model: target, ui: { notify() {} } });
  const error = await tool.execute("fixture3", { query: "public" }, undefined, undefined, { model: target, modelRegistry: {} });
  assert.equal(error.isError, true); assert(!JSON.stringify(error).includes(KEY));
  createExtension(async () => ({ data: { status: "ok", summary: '"'.repeat(LIMITS.outputBytes), sources: [], truncated: false }, usage }))(pi);
  handlers.session_start({}, { model: target, ui: { notify() {} } });
  const oversized = await tool.execute("fixture4", { query: "public" }, undefined, undefined, { model: target, modelRegistry: {} });
  assert.equal(oversized.isError, true); assert.equal(oversized.details.code, "response_limit"); assert.equal(oversized.usage.output, 12);
});
test("SDK factory binds an explicitly reviewed fixture tool with no global resources or network", async () => {
  const { runtime: modelRuntime, model } = await runtime();
  const cwd = resolve(".tmp/gateway-search-offline/workspace"), agentDir = resolve(".tmp/gateway-search-offline/agent");
  mkdirSync(cwd, { recursive: true }); mkdirSync(agentDir, { recursive: true });
  const settingsManager = SettingsManager.inMemory({ retry: { enabled: false }, compaction: { enabled: false }, cacheWarming: "off" });
  const resourceLoader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noThemes: true, noContextFiles: true, additionalExtensionPaths: [], extensionFactories: [createExtension()],
    systemPromptOverride: () => "Synthetic public offline fixture only.", appendSystemPromptOverride: () => [] });
  await resourceLoader.reload(); assert.deepEqual(resourceLoader.getExtensions().errors, []);
  assert.equal(resourceLoader.getExtensions().extensions.length, 1);
  const { session } = await createAgentSession({ cwd, agentDir, resourceLoader, modelRuntime, model, thinkingLevel: "max",
    settingsManager, tools: [TOOL_NAME], sessionManager: SessionManager.inMemory(cwd) });
  try {
    await session.bindExtensions({ onError: error => { throw new Error(JSON.stringify(error)); } });
    assert(session.getActiveToolNames().includes(TOOL_NAME), JSON.stringify(session.getAllTools())); assert.equal(session.thinkingLevel, "max");
    assert(!session.systemPrompt.includes("PRIVATE_HISTORY"));
    modelRuntime.registerProvider("unsupported-fixture", { api: "anthropic-messages", baseUrl: target.baseUrl, apiKey: KEY,
      models: [{ id: "other", name: "Other offline fixture", reasoning: true, input: ["text"], contextWindow: 200000,
        maxTokens: 2048, cost: usage.cost }] });
    const other = modelRuntime.getModel("unsupported-fixture", "other"); assert(other);
    await session.setModel(other);
    assert(!session.getActiveToolNames().includes(TOOL_NAME));
    await session.setModel(model); assert(session.getActiveToolNames().includes(TOOL_NAME));
  } finally { session.dispose(); }
});
test("loaded extension completes a synthetic max-effort Agent loop alongside an ordinary tool", async () => {
  const { runtime: modelRuntime, model } = await runtime();
  const cwd = resolve(".tmp/gateway-search-offline/workspace"), agentDir = resolve(".tmp/gateway-search-offline/agent");
  mkdirSync(cwd, { recursive: true }); mkdirSync(agentDir, { recursive: true });
  const settingsManager = SettingsManager.inMemory({ retry: { enabled: false, provider: { maxRetries: 0 } },
    compaction: { enabled: false }, cacheWarming: "off" });
  const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noThemes: true, noContextFiles: true, additionalExtensionPaths: [], extensionFactories: [createExtension()],
    systemPromptOverride: () => "Synthetic public offline fixture only.", appendSystemPromptOverride: () => [] });
  await loader.reload(); assert.deepEqual(loader.getExtensions().errors, []);
  let echoed = 0;
  const { session } = await createAgentSession({ cwd, agentDir, resourceLoader: loader, modelRuntime, model,
    thinkingLevel: "max", settingsManager, tools: [TOOL_NAME, "diagnostic_echo"], sessionManager: SessionManager.inMemory(cwd),
    customTools: [defineTool({ name: "diagnostic_echo", label: "Offline echo", description: "Echo a public fixture", parameters: Type.Object({ text: Type.String() }),
      async execute(_id, params) { echoed++; return { content: [{ type: "text", text: params.text }], details: undefined }; } })] });
  const deniedFetch = globalThis.fetch; let requests = 0;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init); const wire = await request.clone().text(); const body = JSON.parse(wire);
    assert(!wire.includes(KEY)); assert(!wire.includes("DO_NOT_RETAIN_OPAQUE")); assert(!wire.includes("PRIVATE_HISTORY"));
    assert.equal(request.headers.get("authorization"), "Bearer " + KEY); requests++;
    if (requests === 1) {
      assert.equal(body.output_config.effort, "max"); assert.equal(body.thinking.type, "adaptive");
      assert(body.tools.some((tool: any) => tool.name === TOOL_NAME)); assert(body.tools.some((tool: any) => tool.name === "diagnostic_echo"));
      assert(!body.tools.some((tool: any) => tool.type === "web_search_20250305"));
      const start = events()[0];
      return sse([start,
        { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "client_search", name: TOOL_NAME, input: {} } },
        { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ query: "Python public release" }) } },
        { type: "content_block_stop", index: 0 },
        { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "client_echo", name: "diagnostic_echo", input: {} } },
        { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: JSON.stringify({ text: "PUBLIC_ECHO" }) } },
        { type: "content_block_stop", index: 1 },
        { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 12 } },
        { type: "message_stop" }]);
    }
    if (requests === 2) {
      assert.equal(body.messages.length, 1); assert.equal(body.output_config.effort, "low"); assert.equal(body.tools.length, 1);
      assert.equal(body.tools[0].type, "web_search_20250305"); assert.equal(init?.redirect, "error"); return sse(events());
    }
    assert.equal(requests, 3); assert.equal(body.output_config.effort, "max");
    assert(wire.includes("Untrusted web data")); assert(wire.includes("PUBLIC_ECHO")); assert(wire.includes("python.org/downloads/"));
    const final = events().filter(value => ![0, 1].includes(value.index as number));
    return sse(final);
  };
  try {
    await session.bindExtensions({ onError: error => { throw new Error(JSON.stringify(error)); } });
    await session.prompt("Use the public search and ordinary echo fixtures, then summarize their results.");
    assert.equal(requests, 3); assert.equal(echoed, 1); assert.equal(session.thinkingLevel, "max");
    assert.equal(session.getLastAssistantText(), "Public search summary.");
    const results = session.messages.filter(message => message.role === "toolResult"); assert.equal(results.length, 2);
    assert(!JSON.stringify(results).includes("DO_NOT_RETAIN_OPAQUE"));
    assert.equal(results.find(message => message.role === "toolResult" && message.toolName === TOOL_NAME)?.usage?.output, 12);
  } finally { session.dispose(); globalThis.fetch = deniedFetch; }
});
