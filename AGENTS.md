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
- Treat `extensions/auren-ui`, `extensions/relay-search`, `themes`, and `prompts` as source of truth. The MCP directory is a reviewed template until the adopter creates a local registry.
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

For `extensions/constrained-mcp`, install its pinned dependency separately only when testing that optional template.
