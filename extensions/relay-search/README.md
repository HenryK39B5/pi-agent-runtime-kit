# Relay Search

An experimental Pi request hook that declares provider-hosted Web Search without registering a local search executor.

The public `SEARCH_TARGETS` list is intentionally empty and saved mode defaults to off. Add an exact provider/model/API/tool declaration only after a bounded real test; never infer support from model names, reasoning/image flags, or UI badges.

## Request contract

A declaration is appended only when all conditions hold:

- selected provider, model ID, and API exactly match a reviewed target;
- payload model also matches;
- input and a non-empty ordinary Tool list are present;
- `tool_choice` is absent or `auto`;
- no hosted search declaration already exists.

The hook copies rather than mutates the payload and preserves input, existing Tools, include fields, reasoning, storage, and Tool choice. It adds no retry, fallback schema, forced search, browser, credential access, or additional model call.

## Configure and trial

Edit `config.ts` using `examples/relay-search-targets.example.ts` as a shape. Treat this source list as a reviewed capability registry, not user preference.

Temporarily load the Extension, then use:

```text
/relay-search models
/relay-search on
/relay-search status
/relay-search off
```

The explicit mode is saved in `~/.pi/agent/state/relay-search.json`; only version and enabled boolean are stored. `PI_RELAY_SEARCH_STATE` can redirect the path for tests. Invalid state fails safe to off.

If Auren UI is loaded, enabled policy appears as `web` through the bounded Footer Status Protocol. It means declaration is enabled, not that a search occurred.

## Limits

- Provider behavior, availability, billing, and live-vs-cached results remain external.
- `web_search appended` proves only that this request hook ran.
- Pi 0.85.1 may discard hosted-search events and structured citations.
- Explicit links in final text should still be independently checked.
- On unsupported-tool errors, turn the experiment off; do not add automatic retries.
