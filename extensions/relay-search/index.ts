import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SEARCH_TARGETS, type SearchTarget } from "./config.ts";
import { loadRelaySearchPreference, saveRelaySearchPreference } from "./state.ts";

const FOOTER_STATUS_CHANNEL = "auren:footer-status:v1";
const FOOTER_STATUS_REQUEST_CHANNEL = "auren:footer-status-request:v1";

interface TargetModel { provider: string; id: string; api: string; }
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function searchTarget(
  model: TargetModel | undefined,
  targets: readonly SearchTarget[] = SEARCH_TARGETS,
): SearchTarget | undefined {
  return model && targets.find(target => target.provider === model.provider &&
    target.id === model.id && target.api === model.api);
}

export interface SearchDecision {
  reason: string;
  payload?: Record<string, unknown>;
}

/** Never mutates input. Unsupported/malformed requests remain unchanged. */
export function evaluateSearch(
  payload: unknown,
  model: TargetModel | undefined,
  targets: readonly SearchTarget[] = SEARCH_TARGETS,
): SearchDecision {
  const target = searchTarget(model, targets);
  if (!target) return { reason: "model not configured" };
  if (!record(payload) || payload.model !== target.id || !Array.isArray(payload.input))
    return { reason: "request shape or model mismatch" };
  if (payload.tool_choice !== undefined && payload.tool_choice !== "auto")
    return { reason: "explicit tool_choice preserved" };
  if (!Array.isArray(payload.tools) || payload.tools.length === 0 ||
      !payload.tools.every(tool => record(tool) && typeof tool.type === "string"))
    return { reason: "missing or malformed tools" };
  if (payload.tools.some(tool => tool.type === "web_search" || tool.type.startsWith("web_search_preview")))
    return { reason: "hosted search already declared" };
  if (!payload.tools.some(tool => tool.type === "function" || tool.type === "custom"))
    return { reason: "no ordinary agent tools" };
  return {
    reason: `${target.toolType} appended`,
    payload: { ...payload, tools: [...payload.tools, { type: target.toolType }] },
  };
}

/** Compatibility helper for pure request tests. */
export function appendHostedSearch(
  payload: unknown,
  model: TargetModel | undefined,
  targets: readonly SearchTarget[] = SEARCH_TARGETS,
): Record<string, unknown> | undefined {
  return evaluateSearch(payload, model, targets).payload;
}

export function createRelaySearchExtension(targets: readonly SearchTarget[] = SEARCH_TARGETS) {
  return function relaySearch(pi: ExtensionAPI) {
    let enabled = loadRelaySearchPreference().enabled;
    let active = false;
    let lastRequest = "none";
    let lastModel = "none";
    const resetRuntime = () => {
      active = false;
      lastRequest = "none";
      lastModel = "none";
    };
    const publishStatus = () => pi.events.emit(FOOTER_STATUS_CHANNEL, {
      version: 1, id: "relay-search", active: enabled,
      ...(enabled ? { label: "web", tone: "accent", priority: 80 } : {}),
    });
    pi.events.on(FOOTER_STATUS_REQUEST_CHANNEL, publishStatus);

    pi.registerCommand("relay-search", {
      description: "Provider-hosted search: on | off | status | models (manual capability list)",
      getArgumentCompletions: prefix => {
        const items = ["off", "on", "status", "models"]
          .filter(value => value.startsWith(prefix))
          .map(value => ({ value, label: value }));
        return items.length ? items : null;
      },
      handler: async (args, ctx) => {
        const action = args.trim().toLowerCase();
        if (action === "models") {
          ctx.ui.notify(targets.map(target => `${target.provider}/${target.id} [${target.api}] → ${target.toolType}`).join("\n") || "No search models configured.", "info");
          return;
        }
        if (action === "on" || action === "off") {
          enabled = action === "on";
          publishStatus();
          const saveWarning = saveRelaySearchPreference(enabled);
          if (saveWarning) ctx.ui.notify(saveWarning, "warning");
        }
        else if (action && action !== "status") {
          ctx.ui.notify("Usage: /relay-search on|off|status|models", "warning");
          return;
        }
        const target = searchTarget(ctx.model, targets);
        ctx.ui.notify([
          `Relay search: ${enabled ? "on" : "off"}; current model: ${target ? "configured" : "not configured"}.`,
          `Last request (${lastModel}): ${lastRequest}.`,
          "Reports request declaration only, not server-side execution. The selected mode is saved across restarts.",
        ].join("\n"), "info");
      },
    });
    pi.on("session_start", (_event, ctx) => {
      resetRuntime();
      const saved = loadRelaySearchPreference();
      enabled = saved.enabled;
      if (saved.warning) ctx.ui.notify(saved.warning, "warning");
      publishStatus();
    });
    pi.on("agent_start", () => { active = true; });
    pi.on("agent_settled", () => { active = false; });
    pi.on("session_shutdown", () => {
      resetRuntime();
      pi.events.emit(FOOTER_STATUS_CHANNEL, { version: 1, id: "relay-search", active: false });
    });
    pi.on("before_provider_request", (event, ctx) => {
      // Keep status limited to the latest ordinary run; auxiliary requests do not erase it.
      if (!active) return;
      lastModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "none";
      if (!enabled) { lastRequest = "disabled"; return; }
      const decision = evaluateSearch(event.payload, ctx.model, targets);
      lastRequest = decision.reason;
      return decision.payload;
    });
  };
}

export default createRelaySearchExtension();
