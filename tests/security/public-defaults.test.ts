import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { InMemoryCredentialStore, InMemoryModelsStore } from "@earendil-works/pi-ai";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { SEARCH_TARGETS } from "../../extensions/openai-web-search/config.ts";
import { KIRO_TARGETS } from "../../extensions/kiro-web-search/config.ts";
import { matchesTarget, helperPayload } from "../../extensions/kiro-web-search/protocol.ts";
test("public target registries are empty, helper payload identity is explicit, and native MCP examples remain disabled", () => {
  assert.deepEqual(SEARCH_TARGETS, []); assert.deepEqual(KIRO_TARGETS, []);
  const model = { provider: "fixture-provider", id: "fixture-model", api: "anthropic-messages", baseUrl: "https://gateway.example.invalid" };
  assert.equal(matchesTarget(model), false);
  const targets = [{ ...model, api: "anthropic-messages" as const }];
  assert(matchesTarget(model, targets));
  for (const baseUrl of ["http://gateway.example.invalid", "https://user:password@gateway.example.invalid",
    "https://gateway.example.invalid/path", "https://gateway.example.invalid?query=x", "https://gateway.example.invalid#fragment",
    "https://gateway.example.invalid:444", "https://gateway.example.invalid.evil.example"])
    assert.equal(matchesTarget({ ...model, baseUrl }, targets), false);
  assert.throws(() => helperPayload({ model: "wrong" }, "public", model.id));
  const config = JSON.parse(readFileSync(new URL("../../examples/mcp.example.json", import.meta.url), "utf8"));
  for (const server of Object.values(config.mcpServers) as any[]) {
    assert.equal(server.enabled, false); assert(new URL(server.url).hostname.endsWith(".invalid"));
    assert.equal(server.exposure, undefined); assert.equal(server.timeout, undefined);
  }
});
test("actual default module files remain unsupported after explicit on with empty registries, without HTTP", async () => {
  const cwd = resolve(process.env.PI_CODING_AGENT_DIR!, "defaults-workspace"), agentDir = resolve(process.env.PI_CODING_AGENT_DIR!, "defaults-agent");
  mkdirSync(cwd, { recursive: true }); mkdirSync(agentDir, { recursive: true });
  const runtime = await ModelRuntime.create({ modelsPath: null, modelsStore: new InMemoryModelsStore(), credentials: new InMemoryCredentialStore(),
    allowModelNetwork: false, refreshOnCreate: false });
  runtime.registerProvider("fixture-provider", { api: "anthropic-messages", baseUrl: "https://gateway.example.invalid", apiKey: "synthetic-no-credential",
    models: [{ id: "fixture-model", name: "Public fixture", reasoning: false, input: ["text"], contextWindow: 200000, maxTokens: 2048,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] });
  const model = runtime.getModel("fixture-provider", "fixture-model"); assert(model);
  const settings = SettingsManager.inMemory({ retry: { enabled: false }, compaction: { enabled: false }, cacheWarming: "off" });
  const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager: settings, noExtensions: true, noSkills: true, noThemes: true,
    noPromptTemplates: true, noContextFiles: true, additionalExtensionPaths: ["openai-web-search", "kiro-web-search"].map(name => resolve("extensions", name, "index.ts")),
    systemPromptOverride: () => "Public synthetic fixture", appendSystemPromptOverride: () => [] });
  await loader.reload(); assert.deepEqual(loader.getExtensions().errors, []); assert.equal(loader.getExtensions().extensions.length, 2);
  const { session } = await createAgentSession({ cwd, agentDir, resourceLoader: loader, modelRuntime: runtime, model, settingsManager: settings,
    tools: ["kiro_web_search"], sessionManager: SessionManager.inMemory(cwd) });
  const blockedFetch = globalThis.fetch; let attempts = 0;
  globalThis.fetch = async () => { attempts++; throw new Error("No HTTP in public-default test"); };
  try {
    await session.bindExtensions({ onError: () => { throw new Error("Extension error"); } });
    await session.prompt("/kiro-web on"); await session.prompt("/openai-web on");
    assert(!session.getActiveToolNames().includes("kiro_web_search"));
    const tool = loader.getExtensions().extensions.flatMap(ext => [...ext.tools.values()].map(tool => tool.definition)).find(tool => tool.name === "kiro_web_search");
    assert(tool);
    const denied = await tool.execute("forced", { query: "public" }, undefined, undefined, { model, modelRegistry: {} } as any);
    assert.equal((denied.details as any).code, "unsupported_model"); assert.equal(attempts, 0);
  } finally { session.dispose(); globalThis.fetch = blockedFetch; }
});
