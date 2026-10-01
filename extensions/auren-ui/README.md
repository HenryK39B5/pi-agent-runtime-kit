# Auren UI

Event-driven Pi 0.99.2 reference source. It owns the single Footer, title, progress, completion metadata and optional notifications.

## Behavior

- `idle / working / done / error`; Run = `agent_start → agent_settled`.
- Automatic retry/queued continuation remains one Run. After settlement, a user's manual “continue” starts a new Run; previous Runs remain in Session cumulative time, without counting idle user waiting.
- Restoration prefers validated, branch-bound recorded durations, deduplicates completion records and covers queued/steering messages. Older history uses conservative persisted entry timing; idle summaries cannot extend an already finished answer.
- `auren.completion.v1` records visible final-answer timing; `auren.run-timing.v1` records runs without a bindable visible answer. Both stay out of model context.
- Context usage is cached by leaf/model/window and invalidated on message/turn/model/compact/tree events, sampled on render rather than before persistence.
- Only working owns one 1 Hz render timer. No idle timer, watcher, database, process or server.
- Responsive Footer prioritizes status/Context, then full `provider/model`; identities are omitted whole when they do not fit.
- Other modules publish bounded data-only status over `auren:footer-status:v1` and its request channel. Auren alone renders it.

## Markdown reading adaptation

A display-only transformer inserts needed separator spaces in simple closed spans such as `**注意：**下一步` or `这是**“重要”**内容`. It does not change stored messages, signatures, model context or `/copy` text. Code, escaped stars, links, incomplete and complex spans are preserved conservatively. Bounds: 128 KiB text, 8 KiB line, 512-character simple span. This is not a general Markdown repair engine; the native renderer still handles lists, tables, links and layout.

## Trial and notifications

Follow the isolated trial in [Adoption guide](../../docs/ADOPTION_GUIDE.md), rather than inheriting a developer's saved notification route/mode.

BEL flags: `--auren-notify`, `--auren-notify=false`, `--auren-notify-after-ms 15000`. BEL sound belongs to the terminal/OS. Windows Terminal OSC 9;4 progress is platform-specific.

ntfy defaults off. Routing lives outside the repository; `PI_NTFY_CONFIG` redirects it. `PI_AUREN_UI_STATE` redirects a versioned mode-only state file, normally `~/.pi/agent/state/auren-ui.json`.

Commands: `/ntfy off|on|strong|stop|status|test`. Test messages visibly say “test / not task completion.” Sending even a test is an external side effect requiring user intent. Normal notification threshold defaults to 60 seconds; errors bypass it. Strong mode has six fixed five-second slots, skips overlapping sends, stops on failure and cancels on task/mode/session changes. Payloads contain a short session label/duration, not answers, working paths or error details.

## Validation limits

Run `npm test`: preferences/routes/agent directories are isolated before imports and standard Node transports are blocked unless explicitly mocked. This is a test guard, not an OS sandbox. Native component and synthetic SDK tests are not end-device delivery, full user TUI or future-Pi compatibility certification.
