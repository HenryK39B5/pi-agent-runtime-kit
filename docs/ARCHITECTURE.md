# Architecture

## Design goals

- event-driven and idle-light;
- one owner per shared UI surface;
- bounded timers, registries, retries, and persisted state;
- deterministic rules before model judgment;
- optional network capability remains off until explicitly configured;
- no database, watcher, local server, automatic model call, or unbounded history;
- temporary validation before global deployment.

## Runtime layers

```text
Pi Agent Loop and Session
          │
          ├─ Auren UI: lifecycle state, timing, title, progress, metadata
          │      └─ owns the single Footer renderer
          │
          ├─ Footer Status Protocol: bounded data contributions over pi.events
          │      └─ optional modules publish policy state such as web/ntfy
          │
          ├─ Relay Search: narrow before_provider_request declaration hook
          │
          └─ Constrained MCP template: one lazy proxy over a fixed registry
```

## Lifecycle semantics

A run begins at `agent_start` and completes at `agent_settled`, not merely `agent_end`. Settled completion avoids announcing success while Pi is retrying, compacting, or processing queued continuation work.

Only a working run owns the one-second render timer. Settlement, footer replacement, session replacement, `/reload`, and shutdown clean up owned state. Duplicate events do not double-count run time or append duplicate completion metadata.

## Completion metadata

A custom session entry records version, completion instant, run duration, final Assistant entry ID, and outcome. It is rendered for the user but does not enter subsequent model context. No Tool output, prompt, response body, workspace content, or credential is stored in this entry.

## Footer ownership protocol

Auren is the sole Footer renderer. Other Extensions publish data on:

```text
auren:footer-status:v1
auren:footer-status-request:v1
```

Contributions are validated, terminal sequences removed, labels width-bounded, priorities clamped, and the registry limited to eight entries. A request/snapshot handshake prevents Extension load order from deciding whether state appears.

The displayed state is a policy signal, not proof of an external result. `web` means hosted search declaration is enabled for configured targets; `ntfy` means notification mode is enabled. Neither proves that a provider searched or a phone received a message.

## Preferences

Each optional module stores only its explicit mode in a separate versioned JSON file under Pi's state directory. Reads happen at session start. Writes happen only on explicit mode changes and use adjacent temporary-file replacement. Missing, unreadable, malformed, or unsupported data fails safe to `off`.

## Optional network boundaries

ntfy sends a short session label and duration, never the Assistant response, working directory, Tool output, or error details. Strong mode has six fixed slots, skips overlap, stops on transport failure, and cancels on mode/session/task changes.

Relay Search never executes local search. It immutably appends one provider-hosted declaration only for exact reviewed targets and conservative ordinary Agent request shapes. It does not retry, discover capabilities, inspect credentials, or replace existing tools.

The MCP template uses programmatic config rather than ambient discovery. It disables Direct Tools, script mode, Sampling, Resources, auto-auth, debug/trace, eager connection, startup notifications, and a competing MCP Footer.
