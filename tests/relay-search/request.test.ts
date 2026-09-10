import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { appendHostedSearch, createRelaySearchExtension, evaluateSearch, searchTarget } from "../../extensions/relay-search/index.ts";
import type { SearchTarget } from "../../extensions/relay-search/config.ts";

const model = { provider: "example-provider", id: "search-model-alpha", api: "openai-responses" };
const secondModel = { ...model, id: "search-model-beta" };
const targets: readonly SearchTarget[] = [
  { ...model, api: "openai-responses", toolType: "web_search" },
  { ...secondModel, api: "openai-responses", toolType: "web_search" },
];
const configuredTarget = (value: any) => searchTarget(value, targets);
const configuredEvaluate = (value: unknown, valueModel: any) => evaluateSearch(value, valueModel, targets);
const configuredAppend = (value: unknown, valueModel: any) => appendHostedSearch(value, valueModel, targets);
const extension = createRelaySearchExtension(targets);

const payload = (modelId = model.id) => ({ model: modelId, input: [], tools: [{ type: "function", name: "read" }, { type: "function", name: "bash" }], include: ["reasoning.encrypted_content"], store: false, stream: true });

test("manual capability list is unique and does not infer other models", () => {
  assert.equal(new Set(targets.map(t => `${t.provider}/${t.id}/${t.api}`)).size, targets.length);
  assert.equal(configuredTarget(model)?.toolType, "web_search");
  assert.equal(configuredTarget(secondModel)?.toolType, "web_search");
  assert.equal(configuredTarget({ ...model, id: "unsupported-model" }), undefined);
  assert.ok(configuredAppend(payload(secondModel.id), secondModel));
});

test("diagnostics distinguish no-tools, malformed tools and existing search", () => {
  assert.equal(configuredEvaluate({ ...payload(), tools: [{ type: 7 }] }, model).reason, "missing or malformed tools");
  assert.equal(configuredEvaluate({ ...payload(), tools: [{ type: "file_search" }] }, model).reason, "no ordinary agent tools");
  assert.equal(configuredEvaluate({ ...payload(), tools: [{ type: "web_search" }] }, model).reason, "hosted search already declared");
});

test("append preserves tools, includes and input without mutating original; idempotent", () => {
  const original = payload();
  const snapshot = structuredClone(original);
  const result = configuredAppend(original, model)!;
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result.tools, [...original.tools, { type: "web_search" }]);
  assert.equal(result.include, original.include);
  assert.equal(result.input, original.input);
  assert.equal(result.store, false);
  assert.equal(result.tool_choice, undefined);
  assert.equal(configuredAppend(result, model), undefined);
});

test("wrong model/provider/API and mismatched payload are untouched", () => {
  for (const candidate of [undefined, { ...model, provider: "other" }, { ...model, api: "openai-completions" }, { ...model, id: "unsupported-model" }])
    assert.equal(configuredAppend(payload(), candidate), undefined);
  assert.equal(configuredAppend({ ...payload(), model: "unsupported-model" }, model), undefined);
});

test("malformed/tool-less requests and constrained tool choices are untouched", () => {
  for (const value of [null, [], {}, { ...payload(), input: null }, { ...payload(), tools: [] }, { ...payload(), tools: [null] }, { ...payload(), tools: "bad" }])
    assert.equal(configuredAppend(value, model), undefined);
  for (const choice of ["none", "required", { type: "function", name: "read" }])
    assert.equal(configuredAppend({ ...payload(), tool_choice: choice }, model), undefined);
  assert.equal(configuredAppend({ ...payload(), tool_choice: "auto" }, model)?.tool_choice, "auto");
});

test("legacy hosted search is not duplicated", () => {
  for (const type of ["web_search_preview", "web_search_preview_2025_03_11"])
    assert.equal(configuredAppend({ ...payload(), tools: [...payload().tools, { type }] }, model), undefined);
});

test("extension persists opt-in, publishes status and provides argument completions", async () => {
  mkdirSync(resolve(".tmp"), { recursive: true });
  const dir = mkdtempSync(resolve(".tmp/relay-state-"));
  const oldState = process.env.PI_RELAY_SEARCH_STATE;
  process.env.PI_RELAY_SEARCH_STATE = resolve(dir, "relay.json");
  try {
    const handlers = new Map<string, Function>();
    const busHandlers = new Map<string, Function[]>();
    const busEvents: Array<{ channel: string; data: any }> = [];
    let command: any;
    const notices: string[] = [];
    const ctx: any = { model, ui: { notify: (text: string) => notices.push(text) } };
    const events = {
      on: (channel: string, fn: Function) => busHandlers.set(channel, [...(busHandlers.get(channel) ?? []), fn]),
      emit: (channel: string, data: any) => {
        busEvents.push({ channel, data });
        busHandlers.get(channel)?.forEach(fn => fn(data));
      },
    };
    extension({ events, on: (event: string, fn: Function) => handlers.set(event, fn), registerCommand: (_: string, cmd: any) => { command = cmd; } } as any);
    const emit = (event: string) => handlers.get(event)!({ payload: payload(ctx.model.id) }, ctx);
    emit("session_start"); emit("agent_start");
    assert.equal(emit("before_provider_request"), undefined);
    assert.deepEqual(command.getArgumentCompletions("mo"), [{ value: "models", label: "models" }]);
    assert.equal(command.getArgumentCompletions("x"), null);
    await command.handler("on", ctx);
    assert.ok(busEvents.at(-1)?.data.active);
    assert.ok(emit("before_provider_request"));
    await command.handler("status", ctx);
    assert.ok(notices.at(-1)?.includes("web_search appended"));
    ctx.model = { ...model, id: "unsupported-model" };
    assert.equal(emit("before_provider_request"), undefined);
    await command.handler("models", ctx);
    assert.ok(notices.at(-1)?.includes("example-provider/search-model-beta"));
    ctx.model = secondModel;
    assert.ok(emit("before_provider_request"));
    emit("agent_settled");
    assert.equal(emit("before_provider_request"), undefined);
    emit("session_start"); emit("agent_start");
    assert.ok(emit("before_provider_request"), "saved on mode should survive session replacement");
    events.emit("auren:footer-status-request:v1", { version: 1 });
    assert.equal(busEvents.at(-1)?.data.id, "relay-search");
    assert.equal(busEvents.at(-1)?.data.active, true);
    await command.handler("off", ctx);
    assert.equal(emit("before_provider_request"), undefined);
    emit("session_shutdown");
    assert.equal(busEvents.at(-1)?.data.active, false);
  } finally {
    if (oldState === undefined) delete process.env.PI_RELAY_SEARCH_STATE;
    else process.env.PI_RELAY_SEARCH_STATE = oldState;
    rmSync(dir, { recursive: true });
  }
});
