# Agent-assisted adoption guide

Do not copy this entire repository into a global Pi directory.

## Contract

Before global changes, read the installed Pi version's complete relevant Extension/TUI/Theme/settings/provider/MCP docs and their linked references. Inspect existing state narrowly without printing credentials; identify competing Footer/title/notifications, old/new search commands and a wrapper that overrides native MCP. Ask which modules are wanted, run isolated validation, show the exact file/settings diff, backup and rollback, then obtain explicit deployment approval. Publishing is separate authorization. Do not run `pi install`: this is not a Pi Package.

## Modules

| Module | Network | State/default |
| --- | --- | --- |
| Four Auren Themes | none | explicit choice, colors only |
| Auren UI | none except optional ntfy | loaded UI; display-only timing metadata |
| ntfy | explicit sends | off, mode only; routing external |
| OpenAI Web Search | enabled provider requests | off, empty reviewed targets |
| Kiro helper | explicitly invoked extra request | off, empty reviewed targets |
| Native MCP | enabled servers can connect at startup | disabled invalid-domain example |
| Legacy constrained MCP | adapter-dependent | historical non-runnable template |
| Safety/settings examples | none | manual merge, never blanket overwrite |

## Repository validation

```powershell
npm ci --ignore-scripts
npm test
npm run typecheck
npm run validate:theme
npm run audit:public
```

Review package/lock files before local dependency installation. The test runner establishes isolated route/state/Agent directories before imports and denies standard Node HTTP/TLS/socket connections unless explicitly mocked. New transport or child-process tests require separate review; this is not a security Sandbox.

## Isolated Auren UI trial

In a separate PowerShell, from this clone:

```powershell
$trial = Join-Path (Get-Location) '.tmp/auren-trial'
New-Item -ItemType Directory -Force $trial | Out-Null
$env:PI_CODING_AGENT_DIR = Join-Path $trial 'agent'
$env:PI_AUREN_UI_STATE = Join-Path $trial 'auren.json'
$env:PI_NTFY_CONFIG = Join-Path $trial 'no-route.json'
$env:PI_OPENAI_WEB_SEARCH_STATE = Join-Path $trial 'openai.json'
$env:PI_KIRO_WEB_SEARCH_STATE = Join-Path $trial 'kiro.json'
pi --no-extensions --no-themes --theme ./themes/auren-dark.json --use-theme auren-dark --tui-mode fullscreen --auren-notify=false -e ./extensions/auren-ui/index.ts
```

Use a fresh trial directory if an earlier trial enabled anything; the routing path must not contain real notification config. A fresh isolated Agent directory has no stored account/model/MCP files, intentionally: do not copy credential files to make it work. It does not erase credentials or other configuration inherited through environment variables, nor provide an OS network sandbox. Review the installed CLI's startup behavior and inherited environment without printing secrets, and do not submit a model prompt or enable networking until that separate trial is authorized. Idle/render checks can be done first; an authenticated model or real server trial requires a separately reviewed, explicit setup. Close the trial shell afterward so its environment does not affect daily Pi.

Choose another theme by changing both theme flags consistently. Check resizing, status/timing, Context, Markdown, metadata, session change/reload and shutdown. BEL is disabled above; normal production BEL defaults to a threshold of 15 seconds and immediate errors.

## ntfy

Create real config outside this clone using `examples/ntfy.example.json` only as a shape. Never commit a real Topic. First inspect `/ntfy status`; `/ntfy test` requires explicit sending intent and clearly labels itself as a test, not completion. Set `on/strong` only after route/privacy/delivery review. Isolated tests do not prove device delivery.

## Two independent search routes

The committed registries are empty. Configure exact reviewed source-level targets only after a public, bounded test with explicit cost authorization; no inference from model family, context declaration, image capability or self-description.

OpenAI: `extensions/openai-web-search/config.ts`, `examples/openai-web-search-targets.example.ts`, `/openai-web models|status|on|off`. It adds a hosted declaration/guidance to the main request, not a codemode local executor. It does not define `tools.openai_web_search()`.

Helper: `extensions/kiro-web-search/config.ts`, `examples/kiro-web-search-targets.example.ts`, `/kiro-web models|status|on|off`, tool `kiro_web_search`. Only its narrow adaptive/low streamed Anthropic hosted-search contract is supported; identity/endpoint/authentication/compatibility must be assessed per target. The missing-reference exception and User-Agent requirement stay off/absent unless independently justified.

Factories allow explicit reviewed registries in local entry points; no hidden environment target override exists. Redirect state into the trial folder before slash commands. Tool declaration/HTTP 200/enabled badge is not execution evidence. Verify returned public source URLs separately. Failures should disable the experiment, not cause uncontrolled schema retries. Cancellation may still be billed.

When replacing an older Relay copy, save its source/current preference and remove it from discovery before loading the new route. No runtime aliases or fallback preference reads ship; migration is an explicit adopter action. Do not run old/new copies together.

## MCP

Prefer [official built-in MCP](NATIVE_MCP.md). The committed `examples/mcp.example.json` is disabled and invalid, not ready-to-connect config. Review complete server identity, protocol, auth, access/mutation, project trust and revocation before adding an entry. Use native `/mcp` for status and authorized reconnect/login, discover exact tools/schemas through codemode/tool_search. Keep domain read/write policy separate.

The historical constrained template is preserved for reference, not certified on this new baseline. A `/mcp`-registering adapter replaces built-in session support; do not assume it shares native config, CLI or credentials. Avoid wrappers without a concrete reviewed gap.

## Deployment and rollback

Resolve the adopter's user directory; never hard-code a username. Copy only chosen themes and all required modules within each chosen Extension directory. For example:

```text
themes/selected.json                 → user theme directory
extensions/auren-ui/*.ts             → chosen Auren Extension directory
extensions/openai-web-search/*.ts    → optional OpenAI directory
extensions/kiro-web-search/*.ts       → optional helper directory
examples/mcp.example.json            → reviewed/merged native config, never copied blindly
prompts/APPEND_SYSTEM.md              → reviewed merge, not full overwrite
```

Do not copy tests, node_modules, package development config, invalid examples or this repository's whole root into production. Preserve user theme/search/notification preferences and unrelated settings. `context-cache.ts`, `markdown-reading.ts`, `citations.ts`, helper `config.ts/links.ts` are runtime dependencies: copying index.ts alone is insufficient.

Back up affected source, record checksums, identify new files/commands and get approval. Keep backup outside Extension discovery. Rollback should save the current state, then restore the complete previous chosen directories or move new ones out—never mix generations or overwrite unrelated config/Session history. Reload/restart according to the installed API; changes to default tools can require a fully fresh process. Revoke OAuth grants only by explicit intent through the service/native tools.
