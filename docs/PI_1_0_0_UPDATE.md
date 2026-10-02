# Pi 1.0.0 reference update — 2026-10-02

## Scope

This is a local development-dependency and documentation update, not a runtime feature rewrite, installer, global deployment or published release.

The three development packages `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai` and `@earendil-works/pi-tui` move from exact 0.99.2 to exact 1.0.0, with an updated lockfile and lifecycle scripts disabled. Node remains >=22.19.0; validation uses Node 24.13.1. TypeBox and TypeScript pins remain unchanged. No fresh Node 22 or non-Windows certification is claimed.

Runtime TypeScript, four theme palettes, safety prompt, settings examples and route registries are unchanged. Both production search registries remain empty, preferences default off, missing-reference compatibility is not enabled implicitly, and the native MCP example stays disabled with an invalid domain.

## Upstream changes and adoption decisions

The official release is dated 2026-10-01:

| Upstream change | Reference-kit decision |
| --- | --- |
| Fullscreen becomes the default | Keep explicit trial flags and adopter preferences; no scrolling patch. |
| Codemode descriptions and prompt guidance become shorter | Use native behavior, not a duplicate prompt layer. The official default-tool example falls from about 5,300 to 3,300 prompt tokens, not a promise of 40% lower total usage or bills. |
| Missing tool/model members provide recovery guidance | For tool presence checks use `"name" in tools`, not `typeof tools.name`. No legacy probe was found in the reviewed maintained runtime/test source. |
| MCP OAuth issuer checks, server-name-plus-URL credential keys, retained scopes and empty-field handling | Prefer native support; do not rename servers or inspect/migrate token stores merely to upgrade. Actual authentication remains separately authorized. |
| Optional `oauth.authServerMetadataUrl` | Add only for an evidenced metadata-discovery problem with a reviewed trusted URL, not working connections. |
| Deferred tools restore correctly after resume/reload | Retain native discovery/exposure; actual server/recovery behavior is not certified by offline tests. |
| Transcript memory reductions and fullscreen highlight fixes | Keep the native renderer and existing bounded Markdown display transformer. Official per-message heap claims are not whole-process memory measurements. |
| Image generation through codemode and the model registry | An authenticated, potentially billed external operation; no image model, automatic call or feature-specific wrapper is added. |
| Radius and Anthropic copy-code login; `quietStartup: "header"` | Optional adopter choices, not new kit defaults or authorization to sign in. |
| `--provider` without `--model` now errors | Supply both for scoped CLI model selection; do not silently change a default model. |
| System-theme pastel chroma correction | Not a reason to change the four custom palettes. |

## Validation

An installed-1.0.0 SDK preflight passed 149/149 synthetic tests and strict types before dependency synchronization. That preflight is distinct from the clone-local pinned-package results below.

Clone-local validation after synchronization passed:

- PowerShell: **149/149** isolated tests;
- confirmed Git Bash/MINGW64 with Windows Node: **149/149** isolated tests, not WSL/Linux certification;
- strict TypeScript and all four themes against the clone's pinned Pi 1.0.0 packages;
- public-tree audit: **91 text files**;
- the three package pins, lockfile root/entries and installed versions all match **1.0.0**; other direct dependency pins and package fields are unchanged;
- changed documentation's relative file links and diff checks pass; runtime/test TypeScript, scripts, themes, prompts and examples are unchanged.

These clone-local results do not depend on a machine-specific global SDK override.

Run `npm run validate` and the isolated test runner in confirmed Git Bash with Windows Node. Bootstrap isolates routing/preferences/Agent paths before imports and blocks standard real network transports. These hooks are not an OS sandbox.

Actual user TUI, source-link clicks, long-session memory, complete resume/MCP composition, OAuth, provider authentication, searches and billing remain adopter checks. Dependency downloads from the package registry are not provider, notification or MCP requests.

## State, rollback and publication

No production preference is reset and no global directory is changed. No real model/search/notification/MCP/OAuth requests, commit, push, Release or blog update are authorized by this local synchronization. The package's own version remains unchanged; this is not a new package release.

Before adoption, save the affected source/dependency files. Roll back only those reviewed files, then reconcile clone-local dependencies from the restored lockfile with scripts disabled; do not overwrite unrelated work or global configuration.

The [2026-10-01 maintenance report](MAINTENANCE_UPDATE.md) keeps its original 0.99.2 facts. Current support and test boundaries are in [Compatibility](COMPATIBILITY.md); this update does not retroactively certify historical templates.

## Primary references

- [Official tagged 1.0.0 changelog](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/CHANGELOG.md)
- [Codemode reference](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/codemode.md)
- [MCP reference](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/mcp.md)
