# AGENTS.md

This repository is a public-safe, agent-assisted reference kit for customizing Pi. It is not an official Pi project, a package distribution, or a mirror of any private runtime repository.

## Start Here

Before substantive work, read:

1. `README.md`
2. `docs/ADOPTION_GUIDE.md` for installation or local trials
3. `docs/SECURITY_BOUNDARIES.md` before enabling networking, notifications, MCP, or global deployment
4. only the module README relevant to the current task

## Working Rules

- Keep the repository free of personal names, usernames, machine-specific paths, private service registries, provider accounts, tokens, topics, cookies, sessions, raw chats, and deployment history.
- Examples must use obvious placeholders or reserved invalid domains. Never replace examples with a user's real credentials or private configuration.
- Treat `extensions/auren-ui`, `extensions/openai-web-search`, `extensions/kiro-web-search`, `themes`, and `prompts` as source of truth. Current MCP guidance prefers official built-in support with disabled invalid-domain examples. The constrained directory is a historical, non-default template, not re-certified against the new baseline.
- Default optional network features to off. Do not add background servers, watchers, automatic discovery, automatic authentication, or unbounded retries.
- Read the installed Pi version's local documentation before changing Extension, TUI, Theme, Provider, or settings APIs.
- Test in a temporary Pi process before proposing global installation.
- Back up affected global files and show a diff before deployment. Global deployment requires explicit user confirmation.
- Never publish, push, create a remote, release, or upload without explicit user authorization.
- Do not promise compatibility beyond the versions actually tested.

## Validation

Run from the repository root after `npm ci --ignore-scripts`:

```powershell
npm test
npm run typecheck
npm run validate:theme
npm run audit:public
```

Current pinned source baseline is Pi 0.99.2; the changed source is not certified against the old 0.85.1 baseline. `npm test` isolates notification/preferences/Agent paths before imports and blocks standard real networking. No public Provider/helper targets are configured, and no hidden test environment flag may enable production targets.

For `extensions/constrained-mcp`, install its pinned dependency separately only after explicitly choosing and reviewing that historical optional template. Do not load a `/mcp`-registering wrapper alongside native MCP blindly. SDK/mock validation is not real TUI, notification delivery or live-route certification.
