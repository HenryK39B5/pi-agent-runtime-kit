# Official built-in MCP baseline

For the current Pi 0.99.2 reference baseline, prefer built-in MCP unless a specific reviewed gap justifies a wrapper. Read the installed package's complete `docs/mcp.md`, `docs/extensions.md`, relevant `docs/sdk.md` and linked security/configuration documentation before adoption. This kit does not configure any real server or start OAuth.

## Safe shape

[examples/mcp.example.json](../examples/mcp.example.json) uses an invalid HTTP domain, environment header placeholder and `enabled:false`. It deliberately avoids exposure/timeout/lifecycle overrides. Replace and review the entire entry; never enable the placeholder.

Native user config is `~/.pi/agent/mcp.json`, trusted project config `.pi/mcp.json`, with `mcpServers` entries. For HTTP, `url` is enough for transport selection; stdio entries use command/args. Environment expansion keeps credentials out of committed JSON. Project trust and user/project merging belong to Pi, not this kit.

Enabled native servers connect when Pi starts; network/reconnection and possible server processes are not “zero idle cost.” Review the installed version's defaults rather than copying private tuning assumptions.

## Discover instead of guessing

Use `/mcp` for state, tools, reconnect and explicitly authorized sign-in. `failed`, `needs-auth` and `disabled` require attention; a disconnected server can reconnect on its next call. Even `pi mcp list` can connect enabled servers—run it only with that intent.

Default tool exposure is codemode; discover with `searchTools`, inspect `describeTool` / `describeNamespace`, then call the exact returned tool and argument schema. Deferred tools use `tool_search`. Do not invent Tool names or use a retired generic proxy shape. Descriptions/annotations do not guarantee read-only behavior; inspect action and scope, especially for combined read/write tools.

Read domain policies outside this transport layer. Reads of private business content and remote writes still require appropriate task scope; OAuth is never implicit authorization.

## Wrapper coexistence warning

The historical [constrained template](../extensions/constrained-mcp/README.md) remains non-runnable by default. An Extension registering `/mcp` replaces built-in session MCP support, while shell-level `pi mcp` commands still use the built-in implementation. Do not enable both and assume they share configuration/authentication or that native tests certify the legacy adapter.

This update validates the disabled JSON shape and static guidance only. No real server, authentication, OAuth or native interactive lifecycle is certified by the public kit.
