import { KIRO_TARGETS, type KiroTarget } from "./config.ts";
import type { Api, AssistantMessage, Model } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { LIMITS, SearchCollector, SearchFailure, helperPayload, reviewedTarget, promptFor, validatePayload, validateQuery,
  type SearchData } from "./protocol.ts";
export interface SearchOptions { targets?: readonly KiroTarget[]; signals?: (AbortSignal | undefined)[]; fetch?: typeof globalThis.fetch; timeoutMs?: number; }
export interface SearchResult { data: SearchData; usage: AssistantMessage["usage"]; }
/** No credential files or private history: authentication stays owned by the current Pi model registry. */
export async function search(registry: Pick<ModelRegistry, "streamSimple">, model: Model<Api> | undefined,
  input: unknown, options: SearchOptions = {}): Promise<SearchResult> {
  const target = reviewedTarget(model, options.targets ?? KIRO_TARGETS);
  if (!target) throw new SearchFailure("unsupported_model");
  const query = validateQuery(input);
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, ...(options.signals ?? []).filter((s): s is AbortSignal => !!s)]);
  const timer = setTimeout(() => controller.abort(new SearchFailure("timeout")), options.timeoutMs ?? LIMITS.timeoutMs);
  timer.unref();
  let failure: SearchFailure | undefined;
  let usage: AssistantMessage["usage"] | undefined;
  let requests = 0;
  let bytes = 0;
  // Only exact header credentials, not the headers themselves, are held until this request completes.
  const secrets: string[] = [];
  // This compatibility policy is private to the exact target and one-tool payload checked above/below.
  const collector = new SearchCollector(secrets, { allowUnreferencedSingleResult: target.allowUnreferencedSingleResult === true });
  const boundedFetch: typeof globalThis.fetch = async (input, init) => {
    try {
      signal.throwIfAborted();
      if (++requests > 1) throw new SearchFailure("request_limit");
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (url.origin !== new URL(target.baseUrl).origin || url.pathname !== "/v1/messages" ||
          (url.search !== "" && url.search !== "?beta=true") || url.hash || url.username || url.password || request.method !== "POST")
        throw new SearchFailure("request_shape");
      const body = await request.clone().text();
      if (Buffer.byteLength(body) > LIMITS.requestBytes) throw new SearchFailure("request_limit");
      const authorization = request.headers.get("authorization");
      if (!(authorization?.startsWith("Bearer ") || request.headers.get("x-api-key")) ||
          (target.requiredUserAgent !== undefined && request.headers.get("user-agent") !== target.requiredUserAgent))
        throw new SearchFailure("request_shape");
      if (authorization?.startsWith("Bearer ")) secrets.push(authorization.slice(7));
      const key = request.headers.get("x-api-key");
      if (key) secrets.push(key);
      if (secrets.some(secret => secret && query.includes(secret))) throw new SearchFailure("credential_in_query");
      validatePayload(JSON.parse(body), query, model!.id);
      const response = await (options.fetch ?? globalThis.fetch)(request, { redirect: "error", signal });
      signal.throwIfAborted();
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new SearchFailure("http_error", response.status);
      }
      if (!response.body || response.redirected) throw new SearchFailure("protocol_error");
      const declared = response.headers.get("content-length");
      if (declared && Number(declared) > LIMITS.responseBytes) {
        await response.body.cancel();
        throw new SearchFailure("response_limit");
      }
      const bounded = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, stream) {
          bytes += chunk.byteLength;
          if (bytes > LIMITS.responseBytes) {
            failure = new SearchFailure("response_limit");
            controller.abort(failure);
            stream.error(failure);
          } else stream.enqueue(chunk);
        },
      }), { signal });
      return new Response(bounded, { status: response.status, headers: response.headers });
    } catch (error) {
      failure ??= error instanceof SearchFailure ? error : new SearchFailure("transport_error");
      throw failure;
    }
  };
  try {
    signal.throwIfAborted();
    const stream = registry.streamSimple(model!, {
      messages: [{ role: "user", content: promptFor(query), timestamp: Date.now() }],
    }, {
      reasoning: "low", maxTokens: 1024, cacheRetention: "none", maxRetries: 0, timeoutMs: LIMITS.timeoutMs,
      signal, fetch: boundedFetch,
      onPayload: body => {
        try { return helperPayload(body, query, model!.id); }
        catch (error) { failure = error instanceof SearchFailure ? error : new SearchFailure("request_shape"); throw failure; }
      },
      onProviderStreamEvent: event => {
        collector.observe(event);
        const invalid = collector.getFailure();
        if (invalid) { failure = invalid; controller.abort(invalid); }
      },
    });
    // SDK enforces message_stop and a stop reason as well; never relax its checks.
    for await (const _ of stream) { /* No normalized deltas, thinking, or raw events are retained. */ }
    const result = await stream.result();
    usage = result.usage;
    if (failure) throw failure;
    signal.throwIfAborted();
    if (requests !== 1 || result.stopReason === "error" || result.stopReason === "aborted") throw new SearchFailure("protocol_error");
    const text = result.content.filter(block => block.type === "text").map(block => block.text).join("\n");
    return { data: collector.finish(text, result.stopReason), usage: result.usage };
  } catch (error) {
    // Do not propagate SDK/server exception text: it can contain headers, prompt, or a response body.
    const safe = failure && failure.code !== "transport_error" ? failure : signal.aborted ?
      (signal.reason instanceof SearchFailure ? signal.reason : new SearchFailure("cancelled")) :
      failure ?? (error instanceof SearchFailure ? error : new SearchFailure("transport_error"));
    if (usage) safe.usage = usage;
    throw safe;
  } finally {
    clearTimeout(timer);
    controller.abort();
    secrets.length = 0;
  }
}
