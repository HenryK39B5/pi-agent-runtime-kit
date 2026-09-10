import assert from "node:assert/strict";
import test from "node:test";
import { mcpAuthArgumentCompletions, withRegistryCommandCompletions } from "../../extensions/constrained-mcp/commands.ts";

const servers = ["notes", "tasks"];

test("mcp-auth completion is registry-derived and prefix-filtered", () => {
  assert.deepEqual(mcpAuthArgumentCompletions("t", servers), [{ value: "tasks", label: "tasks" }]);
  assert.deepEqual(mcpAuthArgumentCompletions("  n", servers), [{ value: "notes", label: "notes" }]);
  assert.equal(mcpAuthArgumentCompletions("unknown", servers), null);
  assert.equal(mcpAuthArgumentCompletions("tasks extra", servers), null);
});

test("command decorator changes only missing mcp-auth completion and preserves receiver", () => {
  const registered = new Map<string, any>();
  const originalCompletion = () => [{ value: "upstream", label: "upstream" }];
  const pi: any = {
    marker: true,
    registerCommand(this: any, name: string, options: any) {
      assert.equal(this.marker, true);
      registered.set(name, options);
    },
    getSessionName(this: any) { assert.equal(this.marker, true); return "fixture"; },
  };
  const decorated = withRegistryCommandCompletions(pi, servers);
  const handler = async () => {};
  decorated.registerCommand("mcp", { handler, getArgumentCompletions: originalCompletion });
  decorated.registerCommand("mcp-auth", { handler });
  decorated.registerCommand("future-auth", { handler });
  assert.equal(registered.get("mcp").getArgumentCompletions, originalCompletion);
  assert.deepEqual(registered.get("mcp-auth").getArgumentCompletions("no"), [{ value: "notes", label: "notes" }]);
  assert.equal(registered.get("future-auth").getArgumentCompletions, undefined);
  assert.equal(decorated.getSessionName(), "fixture");
});

test("future upstream mcp-auth completion takes precedence", () => {
  let registered: any;
  const upstream = () => [{ value: "native", label: "native" }];
  const pi: any = { registerCommand: (_name: string, options: any) => { registered = options; } };
  withRegistryCommandCompletions(pi, servers).registerCommand("mcp-auth", { handler: async () => {}, getArgumentCompletions: upstream });
  assert.equal(registered.getArgumentCompletions, upstream);
});
