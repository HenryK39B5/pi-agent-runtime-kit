# Constrained MCP template

This directory demonstrates a narrow wrapper around pinned `pi-mcp-adapter@2.32.1`. It is deliberately **not a runnable configured Extension**: committed endpoints use the reserved `.invalid` domain, and the actual `servers.ts` / `index.ts` filenames are ignored.

## Policy represented by the template

- programmatic config; no ambient project/host MCP config merge;
- fixed, reviewed Streamable HTTP registry;
- one lazy `mcp` proxy instead of all remote Tools in default context;
- Direct Tools, script mode, Sampling, Resources, elicitation, auto-auth, trace/debug, startup notification, and independent MCP Footer disabled;
- authentication supplied by environment expansion or adapter-managed OAuth;
- no credentials in source;
- Registry-derived `/mcp-auth` completion only when upstream lacks it;
- future upstream command behavior takes precedence.

## Adoption

1. Review the adapter source/version, each server operator, transport, authentication, permissions, and mutation surface.
2. Copy `servers.example.ts` to the ignored `servers.ts` and replace every example.
3. Copy `index.example.ts` to the ignored `index.ts`; change its registry import to `./servers.ts`.
4. Run `npm ci` in this directory on the OS/architecture that runs Pi after reviewing the package and lockfile. Do not copy native OAuth dependencies between WSL and Windows.
5. Keep headers in environment variables and OAuth material in the supported OS credential store.
6. Temporarily test with `pi --no-extensions -e ./extensions/constrained-mcp/index.ts`.
7. Add domain-specific read/write policy outside the transport wrapper.

Never make the `.invalid` examples real by only changing DNS or bypassing validation. Replace and review the complete entries.

## Lifecycle and removal

The adapter owns its own lifecycle timer and idle connection handling. Network calls and remote Tool schemas add cost only when used, but the wrapper is not zero-runtime overhead. Removing the Extension does not automatically revoke OAuth grants or erase credentials; use the service and adapter's supported revocation flow separately.

The dependency is intentionally exact-pinned. Re-audit before updating it. This kit does not promise maintenance of the adapter integration.
