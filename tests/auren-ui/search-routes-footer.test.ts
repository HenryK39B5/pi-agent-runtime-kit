import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import auren from "../../extensions/auren-ui/index.ts";
import { createOpenAIWebSearchExtension } from "../../extensions/openai-web-search/index.ts";
import { createExtension, TOOL_NAME } from "../../extensions/kiro-web-search/index.ts";
const openai = { provider: "response-fixture", id: "fixture-search-model", api: "openai-responses" as const };
const kiro = { provider: "helper-fixture", id: "fixture-opus", api: "anthropic-messages" as const, baseUrl: "https://gateway.example.invalid" };
for (const order of ["auren/openai/kiro", "openai/kiro/auren", "kiro/auren/openai", "kiro/openai/auren"])
  test(`three-route Footer preserves independent state and model-specific off in ${order}`, async () => {
    writeFileSync(process.env.PI_OPENAI_WEB_SEARCH_STATE!, JSON.stringify({ version: 1, enabled: true }));
    writeFileSync(process.env.PI_KIRO_WEB_SEARCH_STATE!, JSON.stringify({ version: 1, enabled: true }));
    const handlers = new Map<string, Function[]>(), bus = new Map<string, Function[]>(), commands = new Map<string, any>();
    let active = ["read", "codemode"], footer: any;
    const pi: any = {
      events: { on: (name: string, fn: Function) => bus.set(name, [...(bus.get(name) ?? []), fn]),
        emit: (name: string, data: unknown) => bus.get(name)?.forEach(fn => fn(data)) },
      on: (name: string, fn: Function) => handlers.set(name, [...(handlers.get(name) ?? []), fn]),
      registerCommand: (name: string, command: any) => commands.set(name, command),
      registerFlag() {}, registerTool() {}, registerMarkdownTransformer() {}, registerEntryRenderer() {}, appendEntry() {},
      getFlag: () => false, getSessionName: () => "Public fixture", getActiveTools: () => active, setActiveTools: (value: string[]) => { active = value; },
    };
    const ctx: any = { mode: "tui", cwd: "C:/fixture", model: openai, thinkingLevel: "off", getContextUsage: () => ({ percent: 10 }),
      sessionManager: { getEntries: () => [], getBranch: () => [], getLeafId: () => null },
      ui: { notify() {}, setTitle() {}, setFooter: (factory: any) => { if (factory) footer = factory({ requestRender() {} }, { fg: (_tone: string, value: string) => value }); } } };
    const factories: Record<string, (api: any) => void> = { auren, openai: createOpenAIWebSearchExtension([{ ...openai, toolType: "web_search" }]),
      kiro: createExtension(undefined, undefined, [kiro]) };
    for (const name of order.split("/")) factories[name](pi);
    const emit = (name: string) => handlers.get(name)?.forEach(fn => fn({ model: ctx.model }, ctx));
    try {
      emit("session_start"); assert(footer.render(180)[0].includes("web:openai")); assert(!active.includes(TOOL_NAME));
      ctx.model = kiro; emit("model_select"); assert(footer.render(180)[0].includes("web:kiro")); assert(active.includes(TOOL_NAME));
      await commands.get("kiro-web").handler("off", ctx);
      assert(footer.render(180)[0].includes("web:off")); assert(!active.includes(TOOL_NAME));
      ctx.model = openai; emit("model_select"); assert(footer.render(180)[0].includes("web:openai"));
      await commands.get("openai-web").handler("off", ctx); assert(footer.render(180)[0].includes("web:off"));
      ctx.model = { ...openai, provider: "unreviewed" }; emit("model_select"); assert(!footer.render(180)[0].includes("web:"));
      ctx.model = kiro; emit("model_select"); assert(footer.render(180)[0].includes("web:off"));
      assert.deepEqual(active, ["read", "codemode"]);
    } finally { emit("session_shutdown"); }
  });
