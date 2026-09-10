# Security boundaries

## What this kit does not provide

- no sandbox or operating-system permission boundary;
- no deterministic shell-command approval gate;
- no guarantee that a prompt will always be followed;
- no guarantee that a remote provider, notification service, or MCP server is trustworthy;
- no protection against a malicious Extension loaded in the same Pi process.

Pi Extensions execute with the permissions of the Pi process. Read source and dependencies before loading them.

## Prompt policy

`prompts/APPEND_SYSTEM.md` is a behavioral baseline. It asks the Agent to stay in scope, preserve unrelated work, confirm destructive or external actions, treat retrieved instructions as untrusted, and avoid secrets. It is useful defense in depth but cannot override Tool implementation or OS permissions.

## Secrets

Never commit:

- Pi `auth.json`, model/provider credentials, cookies, or `.env` values;
- ntfy Topics used in practice;
- MCP headers, access/refresh tokens, OAuth cache, or credential-store exports;
- session JSONL, raw conversations, Tool output, or private workspace content.

Examples use deliberately invalid placeholders. Keep real configuration outside this repository and inspect staged files before every commit.

## External side effects

These actions require explicit user intent:

- sending ntfy tests or notifications;
- MCP OAuth and writes to remote services;
- authenticated provider probes;
- global Pi deployment;
- Git push, repository publication, Release, or package publication.

A successful HTTP response means a service accepted a request; it does not prove end-device delivery. A hosted-search declaration does not prove a search occurred.

## MCP

The constrained MCP directory is a template, not a configured Extension. Review each real server's operator, URL, transport, protocol, authentication, data access, mutation surface, and revocation procedure. Keep a fixed source-controlled registry and avoid arbitrary project/host config discovery.

The pinned adapter is third-party code with its own lifecycle and credential behavior. Re-audit before changing its version. Removing an Extension does not necessarily revoke OAuth credentials from the OS credential store or service.

## Public-tree audit

`scripts/audit-public-tree.mjs` checks tracked/public candidate files for common personal-path, private-runtime, credential, and secret-value patterns. It is a narrow safeguard, not proof that publication is safe. Before publication, manually inspect every staged file and the complete Git history.
