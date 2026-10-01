# OpenAI Web Search

A narrow, opt-in `openai-responses` hosted-search request hook, not a local executor. `SEARCH_TARGETS` is empty and preference is off by default.

## Configure

Review an exact provider/model/API/tool declaration after a separately authorized bounded test. Use [target shape](../../examples/openai-web-search-targets.example.ts); do not infer capability from names or badges. Edit the source-level registry, or use `createOpenAIWebSearchExtension(reviewedTargets)` in a reviewed local Extension entry point. Do not commit private accounts or enable targets through hidden test environment flags.

Commands: `/openai-web on|off|status|models`.
Preference: `~/.pi/agent/state/openai-web-search.json`, or `PI_OPENAI_WEB_SEARCH_STATE`; version/enabled only, unreadable/malformed fails off.

There are no old slash-command, tool or state aliases. Before replacing an installed Relay copy, back it up and explicitly remove it from discovery; migrate its boolean only with adopter approval, not a runtime fallback.

## Request contract

Exact provider/model/API and payload model, input array and nonempty ordinary tools, absent/auto tool choice, no duplicate hosted declaration. The hook copies rather than mutates, preserving ordinary tools and settings. On + supported adds request-local model guidance via the public system prompt section. Off adds neither declaration nor guidance; it does not remove declarations originating elsewhere or stop an already-sent main request.

No extra model call, browser, page fetch, schema fallback or retry. Provider/Pi retry policy remains external. `web_search appended` proves a declaration, not an executed search.

## Sources

Bounded public URL annotations from completed responses are associated with response ID and final Assistant entry ID. Known completed/output-item/incremental forms are supported; unrelated search hits are not relabeled as citations. Up to 8 safe URL/title sources per answer are persisted in `openai.web-citations.v1`, rendered using native Markdown, never added to model context or fetched separately.

Display-only cleanup replaces known opaque cite markers in assistant prose with a readable label, preserving code. If a new answer has a marker without usable annotations, a note says the URL cannot be reconstructed. Previously lost annotations cannot be recovered; there is no guessed cite-to-URL map.

URLs preserve public query/fragment while rejecting signatures, credentials, userinfo, controls and known local addresses. This is not complete DLP. OSC 8-capable terminals expose clickable source titles; other terminals use the native visible-URL fallback. Actual click/TUI validation belongs to the adopter.

## Footer and lifecycle

Only the matching current model contributes `web:openai` or muted `web:off`; other models remove this contribution. Switching models does not reset the saved choice or the other search route. Auren remains sole Footer owner. Temporary annotations clear on reset/off/settlement/shutdown; persisted sources remain readable after disabling search.

Pi 0.99.2 pinned-dependency synthetic tests cover declaration/guidance, source association and context exclusion. No configured public target or live-route certification ships with this module.
