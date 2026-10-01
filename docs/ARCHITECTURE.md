# Architecture

Event-driven, bounded and opt-in. No database, watcher, local server, background model call or second Footer owner.

## Layers

- Pi lifecycle/Session: native messages and runtime identity.
- Auren UI: state, Run/restored Session timing, metadata, title/progress/BEL and single Footer; Context leaf/model/event cache and bounded Markdown display adaptation.
- Footer Status Protocol: validated versioned short data contributions, maximum eight; load-order request/snapshot handshake.
- OpenAI route: exact reviewed Responses main-request declaration/guidance; bounded completed-response URL annotations and display-only source entries.
- Helper route: exact reviewed query-only independent request; one ordinary tool_result, strict payload/association/ending/limits, explicit on/off and cancellation.
- Official MCP: Pi-owned config/auth/connection/tool discovery. The old constrained adapter is a non-default historical template.

## Timing and context

Run = agent_start→agent_settled. Retry/queued work does not settle early; manual continuation after settlement is a new Run. Session totals retain previous success/error Runs without user idle waiting.

Validated metadata durations are preferred and branch-bound/deduplicated; older persisted history is conservatively estimated. Visible completion uses `auren.completion.v1`; no-answer timing uses `auren.run-timing.v1` without faking an answer row. Both remain outside model context, but are local Session state.

Context cache invalidation marks dirty on lifecycle events; it samples after persistence during render and also keys on leaf/provider/model/window. Working timer updates time only; idle has no timer.

## Display versus provider data

Auren's emphasis adaptation and OpenAI marker cleanup only transform assistant Markdown at display time, not stored/signed text or model context. Native Markdown handles layout and OSC 8/fallback links.

`openai.web-citations.v1` holds safe URL/title plus answer identity, not raw SSE, prompt, query, thinking or opaque data. Collector bounds: 8 responses, 8 sources each, 64 annotations/32 items per input batch, 256 item mappings. Temporary state is lifecycle-cleared. Old lost annotations cannot be recovered; sources are not separately fetched or verified.

## Status and preferences

The shared channels are `auren:footer-status:v1` and `auren:footer-status-request:v1`. Contributors have independent IDs, never delete another route's contribution, and Auren sanitizes/layouts all items.

Current supported model gets `web:openai` or `web:kiro`; disabled is muted `web:off`; unmatched models remove the badge. ntfy off is hidden. These are policy states, not external success indicators.

Three separate versioned preferences store only explicit mode, default off on absent/corrupt state. No watcher/history DB; writes only on explicit changes. Routing/authentication is separate.

## Network cost and scope

ntfy sends only a short session label/duration, never answer/path/tool/error details; strong mode is six fixed slots, no queued overlap/retries.

OpenAI declaration adds no extra request; existing provider/Pi behavior remains external. Helper adds one possibly billed request, only a public query, fixed low effort, zero retry/redirect and finite time/bytes/sources. Available usage is accounted once through ordinary/codemode tools, not treated as a billing guarantee.

Native MCP may connect/reconnect or spawn stdio processes when enabled. This kit deliberately supplies no wrapper, exposure tuning or real server. See [Native MCP](NATIVE_MCP.md) and the installed version's documentation.
