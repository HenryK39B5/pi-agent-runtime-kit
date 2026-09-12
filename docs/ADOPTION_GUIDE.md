# Agent-assisted adoption guide

This guide is written for both adopters and the Agent helping them. Do not copy the whole repository into a global Pi directory.

## Adoption contract

Before changing global configuration, the Agent must:

1. read the installed Pi version's local documentation for Extensions, Themes, settings, TUI, and Windows behavior as relevant;
2. inspect existing global and project configuration without printing credentials;
3. identify already installed Extensions that own the footer, title, notifications, or the same slash commands;
4. ask which optional modules are actually wanted;
5. run a temporary trial and repository validation;
6. show the exact destination files, settings-field diff, backup location, and rollback procedure;
7. obtain explicit approval for global deployment.

Do not run `pi install`; this repository is not a Pi Package.

## Choose modules

| Module | Network | Persistent state | Default |
|---|---:|---:|---|
| Auren Dark / Forest / Ember / Violet | no | Pi theme setting only if deployed | explicit trial flag |
| Auren UI status/timing/Footer/BEL | no | completion metadata in Pi sessions | enabled when loaded |
| ntfy | yes, when enabled | mode only; routing separate | off |
| Relay Search | provider request only, when enabled | enabled boolean | off; target list empty |
| Constrained MCP template | yes, on calls/OAuth | adapter credential store | non-runnable template |
| Safety prompt | no | global context file if deployed | manual merge |
| Windows settings example | no | Pi settings | manual merge |

Start with Auren Theme/UI. Add optional modules only when their benefit and data boundary are understood.

## Validate the repository

```powershell
npm ci --ignore-scripts
npm test
npm run typecheck
npm run validate:theme
npm run audit:public
```

Dependency installation is local to this clone. Inspect `package.json` and `package-lock.json` before installation in a high-trust environment.

## Temporary Auren trial

Choose one of `auren-dark`, `auren-forest`, `auren-ember`, or `auren-violet`. Use the same name for the JSON file and `--use-theme`. From this repository root:

```powershell
pi `
  --no-extensions `
  --no-themes `
  --theme ./themes/auren-dark.json `
  --use-theme auren-dark `
  --tui-mode fullscreen `
  -e ./extensions/auren-ui/index.ts
```

Check idle/working/done/error state, elapsed time, resizing, session changes, `/reload`, and shutdown. BEL is enabled by default for successful runs longer than 15 seconds and for errors. Disable it for a trial with `--auren-notify=false`.

## Configure ntfy safely

Copy `examples/ntfy.example.json` to a private path outside this repository and replace the deliberately invalid Topic with a random private Topic. The file format intentionally has no token field in this implementation.

Point the trial process to it:

```powershell
$env:PI_NTFY_CONFIG = '<private-config-path>'
pi --no-extensions -e ./extensions/auren-ui/index.ts
```

Inside Pi, use `/ntfy status` before `/ntfy test`, then explicitly select `/ntfy on` or `/ntfy strong`. Do not commit the routing file. Sending a test is an external side effect and requires user intent.

## Configure Relay Search

The committed `SEARCH_TARGETS` list is empty. Do not infer capability from a model family name, image support, or a provider badge. After a public, bounded provider test, add only the exact provider, model ID, API, and accepted tool schema to `extensions/relay-search/config.ts`.

Then load the Extension temporarily and use:

```text
/relay-search models
/relay-search on
/relay-search status
/relay-search off
```

`web_search appended` proves request declaration, not search execution. Verify resulting sources independently. Unsupported-tool responses should lead to disabling the experiment, not automatic schema retries.

## Configure the MCP template

The committed endpoints use the reserved `.invalid` domain and must never be used as real configuration.

1. Review `extensions/constrained-mcp/README.md` and the pinned dependency.
2. Copy `servers.example.ts` to the ignored local file `servers.ts` and replace the complete example registry.
3. Copy `index.example.ts` to the ignored local file `index.ts`, changing its import to `./servers.ts`.
4. Install the optional dependency with `npm ci` inside `extensions/constrained-mcp` after reviewing its package and lockfile.
5. Keep secrets in environment variables or the adapter's OS credential store.
6. Run a temporary `pi --no-extensions -e .../index.ts` test.

Never add arbitrary project/host MCP config discovery merely for convenience.

## Global deployment outline

The usual Pi global directory is `~/.pi/agent`; resolve it from the current user rather than hard-coding a username.

A deployment may selectively copy:

```text
themes/auren-*.json          → ~/.pi/agent/themes/ (copy only selected themes)
extensions/auren-ui/*.ts     → ~/.pi/agent/extensions/auren-ui/
extensions/relay-search/*.ts → ~/.pi/agent/extensions/relay-search/
prompts/APPEND_SYSTEM.md     → merge/review with ~/.pi/agent/APPEND_SYSTEM.md
```

Do not overwrite an existing APPEND_SYSTEM or settings file wholesale. Merge reviewed sections/fields and preserve unrelated configuration.

For Windows, `examples/settings.windows.json` is a shape, not a blindly copied file. Detect the actual Git Bash path first. If `defaultTools` changes, fully exit and restart Pi: `/reload` may preserve the current active tool list.

## Rollback

Before deployment, copy every affected file to a timestamped backup outside automatic Extension discovery. Record checksums. Roll back by restoring the exact prior files or moving newly added Extension directories outside discovery, then fully restart Pi when tool defaults changed.
