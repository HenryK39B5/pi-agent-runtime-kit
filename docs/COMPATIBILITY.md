# Compatibility

## Verified baseline

| Component | Verified |
|---|---|
| Pi | 0.85.1 |
| Node.js | 22 and 24 test execution |
| OS | Windows 11 |
| Main command tool | Windows PowerShell 5.1 |
| Terminal | Windows Terminal |
| Optional Bash | Git for Windows / MINGW64 |
| MCP adapter template | pi-mcp-adapter 2.32.1 |

The source uses Pi Extension events and APIs available in the verified baseline. Future versions may change lifecycle, settings, TUI, Theme, Provider request, or session-entry behavior. Read the installed package's local documentation and type declarations before adapting.

## Known limits

- OSC `9;4` taskbar progress is Windows Terminal-specific; unsupported terminals should ignore it.
- BEL sound and volume are controlled by the terminal and operating system.
- Theme controls colors, not font, size, or terminal layout.
- Session active time is a conservative estimate from timestamped entries, not billing, CPU time, or user work time.
- Pi 0.85.1 may drop provider-hosted search events and structured citations while retaining final text and explicit links.
- The pinned MCP adapter's declared Pi peer range may lag the verified Pi version; runtime smoke testing is required.
- OAuth may involve a platform-specific native credential-store binding. Install dependencies on the same OS/architecture that runs Pi.
- Changing `defaultTools` requires a fresh Pi process; `/reload` may preserve active tools.

## Platform guidance

The Auren core is mostly platform-neutral, but the baseline intentionally favors Windows-native projects. A complete WSL toolchain can also be stable; avoid mixing Linux Shell/Git with Windows Node/npm/SSH in one workflow.
