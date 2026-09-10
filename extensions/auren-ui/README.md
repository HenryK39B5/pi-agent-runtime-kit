# Auren UI

An event-driven Pi 0.85.1 reference Extension for terminal status, timing, completion metadata, and bounded notifications.

## Features

- `idle / working / done / error` state;
- run wall-clock timing from `agent_start` to `agent_settled`;
- conservative session active-time estimate;
- one width-aware Footer and Terminal Title;
- Windows Terminal OSC `9;4` progress;
- one completion metadata entry bound to the final Assistant entry;
- BEL after successful runs longer than 15 seconds and immediately on errors;
- optional ntfy mode persisted as `off | on | strong`;
- Footer Status Protocol v1 for bounded data-only contributions;
- timer/UI cleanup on settlement, replacement, reload, session change, and shutdown.

The Extension does not start a process, watcher, server, or idle timer. The only one-second timer exists while a run is working.

## Temporary trial

From the repository root:

```powershell
pi `
  --no-extensions `
  --no-themes `
  --theme ./themes/auren-dark.json `
  --use-theme auren-dark `
  --tui-mode fullscreen `
  -e ./extensions/auren-ui/index.ts
```

`--no-extensions` avoids loading an installed Footer owner alongside the trial copy.

Flags:

```text
--auren-notify
--auren-notify=false
--auren-notify-after-ms 15000
```

BEL volume belongs to the terminal/OS and cannot be adjusted by this Extension.

## ntfy

ntfy is off unless a valid private config exists and the user explicitly enables it. Copy `examples/ntfy.example.json` outside the repository, replace the deliberately invalid Topic, and set `PI_NTFY_CONFIG` for a trial. The fallback path is `~/.pi/agent/ntfy.json`.

Commands:

```text
/ntfy off|on|strong|stop|status|test
```

Normal completion uses the configured threshold (default 60 seconds); errors bypass it. Strong mode has six fixed five-second slots, never queues overlapping requests, stops on failure, and is cancelled by a new task, mode change, or shutdown. Messages contain only a bounded Session label and duration—not responses, paths, Tool output, or error details.

The saved state at `~/.pi/agent/state/auren-ui.json` contains only version and mode. `PI_AUREN_UI_STATE` can redirect it for isolated tests. Invalid state fails safe to off.

## Footer protocol

Other Extensions may emit `auren:footer-status:v1` and answer `auren:footer-status-request:v1`. Auren sanitizes IDs/labels/tone/priority, limits the registry to eight items, orders entries, and remains the sole renderer. See `docs/ARCHITECTURE.md`.

## Limits

Completion metadata is display-only but persists in Pi Session history. Session timing is an estimate. OSC progress may be ignored outside Windows Terminal. Read `docs/SECURITY_BOUNDARIES.md` before enabling ntfy.
