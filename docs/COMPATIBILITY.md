# Compatibility

## Current reference-source baseline — 2026-10-01

| Component / evidence | Scope |
| --- | --- |
| Pi packages | Exact-pinned 0.99.2; strict source types, native components and in-memory SDK synthetic tests |
| Node | 24.13.1 tested this update; dependency minimum 22.19.0, not a fresh Node 22 certification |
| OS / main shell | Windows 11 / Windows PowerShell |
| Optional shell | Confirmed Git for Windows MINGW64 with Windows Node, not WSL/Linux |
| Themes | All four JSON palettes pass current pinned schema and shared palette tests |
| OpenAI route | Empty production registry; synthetic Responses declaration/guidance/URL-annotation tests only |
| Helper route | Empty production registry; explicit invalid-endpoint fixture policies and synthetic direct/codemode loops only |
| Native MCP | Installed-version docs and disabled example shape checked; no actual server/OAuth/interactive certification |
| Legacy adapter | Old 2.32.1 template retained; pure policy tests do not certify Runtime/OAuth against 0.99.2 |

The current update passes **149/149 isolated tests** in PowerShell and Git Bash/Windows Node, strict TypeScript, four-theme validation and public-tree audit. Tests use this clone's pinned packages, not a machine-specific global SDK default.

Actual user TUI/click behavior, long sessions, complete multi-session/MCP composition, real provider searches, endpoint authentication/billing and other platforms remain adopter validation. Package identity and synthetic HTTP cannot prove a remote model or search backend.

## Historical baseline

The earlier kit was tested with Pi 0.85.1 and Node 22/24. This history is not an assertion that changed sources using newer lifecycle/system-prompt/provider-event/codemode APIs still support 0.85.1. Review the exact installed version before adoption or upgrades.

## Known boundaries

- OSC 9;4 progress is Windows Terminal-specific; BEL sound belongs to terminal/OS.
- Theme changes color, not font or layout.
- Session time is recorded run wall time where available plus conservative old-history estimates, not billing, CPU or human work time.
- Manual continuation after settlement starts a new Run; prior time is retained without idle waiting.
- Markdown repairs are display-only/bounded and preserve stored text; complex/incomplete spans remain native.
- URL annotations that never arrived or were already lost cannot be reconstructed from cite IDs.
- Source summaries are not full pages or verified facts; source text filtering is not complete DLP.
- Helper adaptive/low/streamed hosted-search compatibility is target-specific. Empty registries and strict end/reference checks must not be weakened to make an untested provider appear supported.
- Native MCP can connect at startup/reconnect and spawn server processes. A /mcp-registering wrapper changes session support but not native shell CLI behavior.
- Reload/restart effects vary by installed Pi API; changing default tools may need a fresh process.
- Offline network hooks are not a sandbox and do not constrain malicious Extensions/subprocesses.

Keep Windows-native Shell/Git/Node/npm/SSH in one toolchain. A complete WSL environment can be valid, but was not tested here.
