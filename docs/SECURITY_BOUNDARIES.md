# Security boundaries

Pi Extensions execute with Pi's user permissions. This kit is not a Sandbox, deterministic command gate, malicious-Extension defense, complete DLP or trust certification of a provider/server. Prompt policy is behavioral defense in depth, not enforceable OS permissions.

## Never publish

Credentials, auth/model files, ntfy Topics/routes used in practice, MCP headers/tokens/OAuth cache, credential-store exports, Session JSONL, raw chats/Tool output, business content, signed URLs, private target registries, machine paths or deployment history do not belong here. Examples use placeholders/invalid domains; real config belongs outside this clone. Manually review public candidate files and Git history before publication.

## External actions

Explicit intent is needed for real notification tests/sends, authenticated provider/helper probes, MCP connections/OAuth/writes, global deployment, and publication/Push/Release. These are distinct permissions. A response/HTTP 200/declaration/badge is not proof of device delivery, search execution, source completeness or fact verification.

## Search

Both registries are empty and modes default off. Exact target matching and execute-time policy prevent a disabled helper from being activated through ordinary or codemode calls. Caller queries must still be public: known-pattern filters cannot detect all private data.

OpenAI collector accepts actual response URL annotations, not guessed ID-to-URL mappings or arbitrary search hits. Source entries stay out of model context, but persist locally and may still reveal browsing interests. Sensitive/local/control-bearing URL patterns fail closed; ordinary query/fragment remains. The main response body is not rewritten or generally redacted by this display feature.

Helper never forwards main history/system/files/MCP results; it reuses Pi-owned auth and retains only bounded untrusted summary/sources/usage. Header values are held transiently for result redaction, never logged. User-Agent requirements and absent-reference compatibility are per-reviewed-target opt-ins, not universal patches. Strict SDK ending/signature checks remain intact.

Zero retry and finite tokens/time/bytes do not promise a maximum bill; failures/cancellation may cost money. Summaries are not full pages. Appended source Markdown is not a whole-text JSON parse contract or guarantee the model will cite correctly.

## Notifications and test isolation

Real routing stays external and preferences hold mode only. Even a visibly labeled test needs send authorization. Offline bootstrap isolates route/state/Agent paths before imports and denies standard fetch/HTTP(S)/net/TLS/socket calls; swallowed failures still fail the process. Explicit mock transports are used for SDK/phone tests.

This is not an OS network sandbox and cannot constrain a malicious subprocess/Extension or every alternate transport. Review new transports, child processes and fixtures separately. Do not infer real-device delivery from mocked tests.

## MCP

Prefer native support, disabled invalid-domain examples and exact Tool/schema discovery. Default native startup connections/reconnection/server processes have cost; even diagnostic CLI may connect. Review full server/auth/read/write/revocation scope. OAuth or exposure is not a read-only guarantee.

A legacy `/mcp` adapter replaces native session support; removing it does not automatically revoke grants. Its old pin/pure policy tests are not new-baseline Runtime/OAuth certification. See [Native MCP](NATIVE_MCP.md).

## Audit

`npm run audit:public` scans public candidate text for common private identifier/path/credential patterns. It is a narrow safeguard, not proof of safe publication. Native Markdown/SDK/unit checks do not replace real user TUI, real-route evidence or a manual publication review.
