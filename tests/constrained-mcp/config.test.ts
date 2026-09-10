import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registry = readFileSync(new URL("../../extensions/constrained-mcp/servers.example.ts", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../../extensions/constrained-mcp/package.json", import.meta.url), "utf8"));

test("MCP template is deliberately invalid and disables broad capability surfaces", () => {
  assert.match(registry, /https:\/\/mcp\.example\.invalid/);
  assert.match(registry, /https:\/\/oauth-mcp\.example\.invalid/);
  for (const statement of [
    'hostConfigDiscovery: "off"',
    "directTools: false",
    "scriptMode: false",
    "sampling: false",
    "samplingAutoApprove: false",
    "elicitation: false",
    "autoAuth: false",
    'mcpFooterStatus: "off"',
    "exposeResources: false",
    "debug: false",
    "trace: false",
    "lifecycle: \"lazy\"",
  ]) assert.ok(registry.includes(statement), `missing constrained setting: ${statement}`);
});

test("examples demonstrate environment-backed header and OAuth without secret values", () => {
  assert.match(registry, /Authorization: "\$\{EXAMPLE_MCP_AUTH_HEADER\}"/);
  assert.match(registry, /auth: "oauth"/);
  assert.doesNotMatch(registry, /Bearer\s+[A-Za-z0-9._~-]{8,}|Token\s+[A-Za-z0-9._~-]{8,}/);
});

test("dependency is private and exact-pinned to the reviewed adapter release", () => {
  assert.deepEqual(pkg.dependencies, { "pi-mcp-adapter": "2.32.1" });
  assert.equal(pkg.private, true);
});
