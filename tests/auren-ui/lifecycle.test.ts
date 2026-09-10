import assert from "node:assert/strict";
import test from "node:test";

import "./installed-tui.ts";
const { default: extension } = await import("../../extensions/auren-ui/index.ts");

function harness(t: any, mode = "tui") {
  const handlers = new Map<string, Function[]>();
  const busHandlers = new Map<string, Function[]>();
  const timers = new Set<Function>();
  const output: string[] = [];
  const entries: any[] = [];
  const titles: string[] = [];
  const footers: any[] = [];
  let failAppend = false;
  let renders = 0;
  t.mock.method(globalThis, "setInterval", (fn: Function) => { timers.add(fn); return fn; });
  t.mock.method(globalThis, "clearInterval", (fn: Function) => timers.delete(fn));
  t.mock.method(process.stdout, "write", (s: string) => { output.push(s); return true; });
  const events = {
    on: (channel: string, handler: Function) => busHandlers.set(channel, [...(busHandlers.get(channel) ?? []), handler]),
    emit: (channel: string, data: unknown) => busHandlers.get(channel)?.forEach(handler => handler(data)),
  };
  const pi: any = {
    events, registerFlag() {}, registerCommand() {}, registerEntryRenderer() {}, getFlag: () => true,
    getSessionName: () => "test", on: (event: string, handler: Function) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
    appendEntry: (customType: string, data: any) => {
      if (failAppend) throw new Error("synthetic write failure");
      entries.push({ id: `meta-${entries.length}`, type: "custom", customType, data });
    },
  };
  const ctx: any = {
    mode, cwd: "C:/fixture", getContextUsage: () => undefined,
    sessionManager: { getEntries: () => entries, getBranch: () => entries, getLeafId: () => entries.at(-1)?.id ?? null },
    ui: {
      notify() {}, setTitle: (s: string) => titles.push(s),
      setFooter: (factory: any) => {
        if (factory) footers.push(factory({ requestRender: () => renders++ }, { fg: (_: string, s: string) => s }));
      },
    },
  };
  extension(pi);
  const emit = (name: string, event = {}) => handlers.get(name)?.forEach(handler => handler(event, ctx));
  const answer = (stopReason = "stop") => {
    const message = { role: "assistant", stopReason, content: [{ type: "text", text: "answer" }] };
    entries.push({ id: `answer-${entries.length}`, type: "message", message });
    emit("message_end", { message });
  };
  emit("session_start");
  return { emit, events, answer, timers, output, entries, titles, footers, fail: () => { failAppend = true; }, renders: () => renders };
}

test("disposing the owned footer stops its timer; stale disposal preserves replacement", (t) => {
  const h = harness(t);
  const first = h.footers.at(-1);
  h.emit("agent_start");
  first.dispose();
  assert.equal(h.timers.size, 0);
  h.emit("agent_start");
  assert.equal(h.timers.size, 0);
  h.emit("session_start");
  h.emit("agent_start");
  const before = h.renders();
  first.dispose();
  assert.equal(h.timers.size, 1);
  for (const tick of h.timers) tick();
  assert.equal(h.renders(), before + 1);
  h.footers.at(-1).dispose();
  assert.equal(h.timers.size, 0);
});

test("Footer host accepts event contributions, redraws and clears them on session replacement", (t) => {
  const h = harness(t);
  const footer = h.footers.at(-1);
  const before = h.renders();
  h.events.emit("auren:footer-status:v1", { version: 1, id: "relay-search", active: true, label: "web", tone: "accent", priority: 80 });
  assert.equal(h.renders(), before + 1);
  assert.ok(footer.render(160)[0].includes("web"));
  h.events.emit("auren:footer-status:v1", { version: 9, id: "bad", active: true, label: "bad" });
  assert.equal(h.renders(), before + 1);
  h.emit("session_start");
  assert.ok(!h.footers.at(-1).render(160)[0].includes("web"));
});

test("duplicate error settlement emits only one BEL and metadata entry", (t) => {
  const h = harness(t);
  h.emit("agent_start"); h.emit("agent_start");
  assert.equal(h.timers.size, 1);
  h.answer("aborted"); h.emit("agent_settled"); h.emit("agent_settled");
  assert.equal(h.output.filter(s => s === "\x07").length, 1);
  assert.equal(h.entries.filter(e => e.type === "custom").length, 1);
  assert.equal(h.timers.size, 0);
});

test("append failure cannot leak a timer or repeat settlement", (t) => {
  const h = harness(t);
  h.emit("agent_start"); h.answer("error"); h.fail();
  h.emit("agent_settled"); h.emit("agent_settled");
  assert.equal(h.timers.size, 0);
  assert.equal(h.output.filter(s => s === "\x07").length, 1);
  assert.ok(h.titles.at(-1)?.startsWith("!"));
});

test("session replacement and shutdown discard active run state", (t) => {
  const h = harness(t);
  h.emit("agent_start"); h.emit("session_start"); h.emit("agent_settled");
  assert.equal(h.timers.size, 0);
  assert.equal(h.entries.length, 0);
  assert.equal(h.output.filter(s => s === "\x07").length, 0);
  h.emit("agent_start"); h.emit("session_shutdown"); h.emit("agent_settled");
  assert.equal(h.output.filter(s => s === "\x07").length, 0);
  h.emit("session_start");
  assert.equal(h.timers.size, 0);
});

test("successful final response clears recovered tool and provider errors", (t) => {
  const h = harness(t);
  h.emit("agent_start"); h.emit("tool_execution_end", { isError: true });
  h.answer("error"); h.answer(); h.emit("agent_settled");
  assert.equal(h.entries.at(-1).data.outcome, "done");
  assert.ok(h.titles.at(-1)?.startsWith("✓"));
});

test("non-TUI persists metadata without timer or terminal writes", (t) => {
  const h = harness(t, "rpc");
  h.emit("agent_start"); h.answer(); h.emit("agent_settled"); h.emit("session_shutdown");
  assert.equal(h.entries.at(-1).type, "custom");
  assert.equal(h.timers.size, 0);
  assert.deepEqual(h.output, []);
  assert.deepEqual(h.titles, []);
});
