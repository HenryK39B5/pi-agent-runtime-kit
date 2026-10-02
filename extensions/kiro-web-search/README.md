# Kiro Web Search helper adapter

An optional, protocol-specific `anthropic-messages` helper reference, **not a universal Claude/Kiro gateway adapter**. `KIRO_TARGETS` is empty, saved mode defaults off, and no reviewed target means the tool cannot execute even after `on` or forced activation.

Public identities: `kiro-web-search`, `/kiro-web`, `kiro_web_search`. There are no legacy/private aliases or state migration fallbacks.

## Review before enabling

Use [target shape](../../examples/kiro-web-search-targets.example.ts) only as a shape. Add an exact provider, model, API and HTTPS origin to `config.ts`, or pass an explicitly reviewed registry to `createExtension(executor, preferences, targets)` in a local entry point. Real registry and model authentication belong outside the published tree. There is no capability inference, auto-discovery or dynamic endpoint argument.

The adapter requires a streamed Anthropic hosted-search contract with adaptive thinking, low helper effort, one `web_search_20250305`, and complete `message_stop/end_turn`. It is not proof that an arbitrary provider implements that contract. User-Agent constraints are optional, target-specific and must be evidenced, not blindly copied.

`allowUnreferencedSingleResult` is false unless a reviewed target explicitly enables it after testing. The narrow exception accepts only one closed call and adjacent type/content-only result with entirely absent reference fields. Explicit mismatch/null/undefined, extra fields, multiple/duplicate/nonadjacent/open calls or incomplete endings remain rejected. SDK signature/end checks are not patched.

## Call and controls

Commands: `/kiro-web on|off|status|models`.
Preference: `~/.pi/agent/state/kiro-web-search.json`, or `PI_KIRO_WEB_SEARCH_STATE`; version/enabled only, invalid fails off.

The query-only local tool makes one separately billed helper request, reusing current Pi model authentication without reading credential files. Only the public query goes into helper context; main history/system prompt/files/MCP output are not forwarded. Main thinking level is unchanged; helper stays low.

On + reviewed current model exposes the tool; execute rechecks policy. Off removes the tool and cancels in-flight work. Switch/shutdown cancel; codemode does not bypass off. Footer is current-model `web:kiro` or muted `web:off`, not search success or backend availability.

## Bounds and safety

- query 800 characters; request 8 KiB; response 256 KiB;
- 45 seconds, at most one POST to the reviewed origin's `/v1/messages` (SDK beta query only);
- no redirect, retry, browser, downloads, fallback provider or background service;
- 8 sources, summary 8 KiB, returned text 32 KiB;
- requested 1024 output tokens is not a hard bill/response ceiling; cancellation/failure can still cost money.

Only bounded summary/title/URL and available usage survive; thinking/encrypted/opaque content and raw events do not. Sources are untrusted, may be stale or omit facts, and pages are not fetched. Sensitive URLs in summary/title are redacted; public query/fragment is preserved. Known-pattern filtering is not complete DLP: callers must still send public queries only.

Output is a JSON object plus a Markdown source list, not a promise that the entire text can be JSON.parse'd. The final model is guided to cite actual returned URLs, not opaque IDs; its compliance is not guaranteed. Available helper usage is reported once, including codemode nesting; configured SDK prices are not provider billing proof.

## Evidence

Pinned Pi 1.0.0 tests use invalid endpoints, explicit fixture registries, in-memory credentials/sessions and mocked HTTP. They cover protocol, limits, cancellation, failure, direct/codemode loops and strict default-off behavior. No real account, private target, gateway identity, live-search result or authenticated billing claim is published here.
