import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import "./installed-tui.ts";

const { default: auren } = await import("../../extensions/auren-ui/index.ts");
const { default: relay } = await import("../../extensions/relay-search/index.ts");

for (const order of ["auren-first", "relay-first"] as const) test(`Footer contributions survive ${order} lifecycle ordering`, () => {
  mkdirSync(resolve(".tmp"), { recursive: true });
  const dir = mkdtempSync(resolve(".tmp/footer-integration-"));
  const oldAuren = process.env.PI_AUREN_UI_STATE;
  const oldRelay = process.env.PI_RELAY_SEARCH_STATE;
  const oldNtfy = process.env.PI_NTFY_CONFIG;
  process.env.PI_AUREN_UI_STATE = resolve(dir, "auren.json");
  process.env.PI_RELAY_SEARCH_STATE = resolve(dir, "relay.json");
  process.env.PI_NTFY_CONFIG = resolve(dir, "ntfy.json");
  writeFileSync(process.env.PI_AUREN_UI_STATE, JSON.stringify({ version: 1, ntfyMode: "strong" }));
  writeFileSync(process.env.PI_RELAY_SEARCH_STATE, JSON.stringify({ version: 1, enabled: true }));
  writeFileSync(process.env.PI_NTFY_CONFIG, JSON.stringify({ server: "https://ntfy.sh", topic: "test-fixture-topic-only" }));
  try {
    const handlers = new Map<string, Function[]>();
    const bus = new Map<string, Function[]>();
    let footer: any;
    const pi: any = {
      events: {
        on: (channel: string, fn: Function) => bus.set(channel, [...(bus.get(channel) ?? []), fn]),
        emit: (channel: string, data: unknown) => bus.get(channel)?.forEach(fn => fn(data)),
      },
      on: (event: string, fn: Function) => handlers.set(event, [...(handlers.get(event) ?? []), fn]),
      registerFlag() {}, registerCommand() {}, registerEntryRenderer() {}, getFlag: () => true,
      getSessionName: () => "integration", appendEntry() {},
    };
    if (order === "auren-first") { auren(pi); relay(pi); } else { relay(pi); auren(pi); }
    const ctx: any = {
      mode: "tui", cwd: "C:/fixture", model: { provider: "example-provider", id: "search-model-alpha", api: "openai-responses" },
      thinkingLevel: "off", getContextUsage: () => ({ percent: 10 }),
      sessionManager: { getEntries: () => [], getBranch: () => [], getLeafId: () => null },
      ui: {
        notify() {}, setTitle() {},
        setFooter: (factory: any) => { if (factory) footer = factory({ requestRender() {} }, { fg: (_: string, text: string) => text }); },
      },
    };
    handlers.get("session_start")?.forEach(fn => fn({}, ctx));
    const line = footer.render(180)[0];
    assert.ok(line.includes("example-provider/search-model-alpha"));
    assert.ok(line.includes("web"));
    assert.ok(line.includes("ntfy strong"));
    ctx.model = { ...ctx.model, provider: "another-provider" };
    handlers.get("model_select")?.forEach(fn => fn({}, ctx));
    const switched = footer.render(180)[0];
    assert.ok(switched.includes("another-provider/search-model-alpha"));
    assert.ok(!switched.includes("example-provider/search-model-alpha"));
    handlers.get("session_shutdown")?.forEach(fn => fn({}, ctx));
  } finally {
    if (oldAuren === undefined) delete process.env.PI_AUREN_UI_STATE; else process.env.PI_AUREN_UI_STATE = oldAuren;
    if (oldRelay === undefined) delete process.env.PI_RELAY_SEARCH_STATE; else process.env.PI_RELAY_SEARCH_STATE = oldRelay;
    if (oldNtfy === undefined) delete process.env.PI_NTFY_CONFIG; else process.env.PI_NTFY_CONFIG = oldNtfy;
    rmSync(dir, { recursive: true });
  }
});
