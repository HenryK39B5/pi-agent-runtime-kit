import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createExtension as rawCreateExtension, TOOL_NAME } from "../../extensions/kiro-web-search/index.ts";
const target = { provider: "gateway-fixture", id: "fixture-opus", api: "anthropic-messages", baseUrl: "https://gateway.example.invalid" };
const fixtureTargets = [{ ...target, api: "anthropic-messages" as const, requiredUserAgent: "runtime-kit-fixture", allowUnreferencedSingleResult: true }];
const createExtension: typeof rawCreateExtension = (run, preferences) => rawCreateExtension(run, preferences, fixtureTargets);

function harness(initial = false, warning?: string, saveWarning?: string) {
  let active = ["read", "codemode", "other-tool"], saved = initial, calls = 0;
  let tool: any;
  const commands = new Map<string, any>(), handlers = new Map<string, Function>(), snapshots: any[] = [], notices: string[] = [];
  const ctx: any = { model: target, modelRegistry: {}, ui: { notify: (message: string) => notices.push(message) } };
  const pi = {
    registerTool(value: any) { tool = value; },
    registerCommand(name: string, value: any) { commands.set(name, value); },
    on(name: string, fn: Function) { handlers.set(name, fn); },
    events: { on() {}, emit(_name: string, value: any) { snapshots.push(value); } },
    getActiveTools: () => active, setActiveTools: (names: string[]) => { active = names; },
  } as unknown as ExtensionAPI;
  createExtension(async (_registry, _model, _query, options) => {
    calls++;
    const signal = options!.signals!.at(-1)!;
    return await new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  }, {
    load: () => ({ enabled: warning ? false : saved, ...(warning ? { warning } : {}) }),
    save: (enabled: boolean) => { if (!saveWarning) saved = enabled; return saveWarning; },
  })(pi);
  const emit = (name: string) => handlers.get(name)!({ model: ctx.model }, ctx);
  const command = (args: string) => commands.get("kiro-web").handler(args, ctx);
  return { ctx, commands, snapshots, notices, emit, command, active: () => active,
    tool: () => tool, calls: () => calls, saved: () => saved };
}
test("Kiro defaults off; model gets the named query tool only after explicit on", async () => {
  const h = harness(); h.emit("session_start");
  assert.deepEqual([...h.commands.keys()], ["kiro-web"]);
  assert(!h.active().includes(TOOL_NAME)); assert.equal(h.snapshots.at(-1).label, "web:off");
  assert.equal(h.snapshots.at(-1).tone, "muted");
  assert(h.tool().description.includes("Search current public web information"));
  assert(h.tool().promptGuidelines.some((s: string) => s.includes("codemode")));
  assert(h.tool().parameters.properties.query);
  const denied = await h.tool().execute("forced-off-call", { query: "public" }, undefined, undefined, h.ctx);
  assert.equal(denied.details.code, "disabled"); assert.equal(h.calls(), 0);
  await h.command("on"); assert(h.active().includes(TOOL_NAME)); assert.equal(h.saved(), true);
  assert.equal(h.snapshots.at(-1).label, "web:kiro");
  h.emit("session_start"); assert(h.active().includes(TOOL_NAME));
  assert.deepEqual(h.commands.get("kiro-web").getArgumentCompletions("mo"), [{ value: "models", label: "models" }]);
  assert.equal(h.commands.get("kiro-web").getArgumentCompletions("bad"), null);
  await h.command("bogus"); assert(h.notices.at(-1)?.includes("Usage: /kiro-web"));
});
test("Kiro off cancels pending work and prevents stale/direct calls without changing other tools", async () => {
  const h = harness(true); h.emit("session_start");
  const pending = h.tool().execute("pending", { query: "public" }, undefined, undefined, h.ctx);
  await h.command("off");
  const cancelled = await pending; assert.equal(cancelled.isError, true); assert.equal(cancelled.details.code, "disabled");
  assert.deepEqual(h.active(), ["read", "codemode", "other-tool"]); assert.equal(h.saved(), false);
  assert.equal(h.snapshots.at(-1).label, "web:off");
  await h.tool().execute("stale", { query: "public" }, undefined, undefined, h.ctx); assert.equal(h.calls(), 1);
});
test("unsupported model saves mode but exposes no tool or badge; execution rechecks target", async () => {
  const h = harness(); h.ctx.model = { ...target, provider: "other" }; h.emit("session_start");
  await h.command("on"); assert.equal(h.saved(), true); assert.equal(h.snapshots.at(-1).active, false);
  assert(h.notices.at(-1)?.includes("unsupported; effective: off"));
  const result = await h.tool().execute("wrong-model", { query: "public" }, undefined, undefined, h.ctx);
  assert.equal(result.details.code, "unsupported_model"); assert.equal(h.calls(), 0);
  await h.command("models"); assert(h.notices.at(-1)?.includes("gateway-fixture/fixture-opus"));
  h.ctx.model = target; h.emit("model_select"); assert(h.active().includes(TOOL_NAME));
});
test("invalid preference fails off; failed save warns without reverting explicit session choice", async () => {
  const bad = harness(true, "Invalid saved state"); bad.emit("session_start");
  assert(!bad.active().includes(TOOL_NAME)); assert.deepEqual(bad.notices, ["Invalid saved state"]);
  const h = harness(false, undefined, "Save failed"); h.emit("session_start"); await h.command("on");
  assert(h.active().includes(TOOL_NAME)); assert.equal(h.saved(), false); assert(h.notices.includes("Save failed"));
  h.emit("session_start"); assert(!h.active().includes(TOOL_NAME));
});
