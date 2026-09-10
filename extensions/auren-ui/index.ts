import { basename } from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { registerPhoneNotify } from "./phone.ts";
import { renderFooter } from "./footer.ts";
import {
  applyFooterStatus,
  FOOTER_STATUS_CHANNEL,
  FOOTER_STATUS_REQUEST_CHANNEL,
  orderedFooterStatuses,
  type FooterStatusContribution,
} from "./footer-status.ts";

import {
  COMPLETION_ENTRY_TYPE,
  completionAlreadyFollows,
  findFinalAssistantEntry,
  formatLocalDateTime,
  isCompletionEntryData,
  type AurenCompletionEntryV1,
} from "./completion.ts";

import {
  createRuntimeState,
  estimateSessionActiveMs,
  formatDuration,
  markRunError,
  settleRun,
  startRun,
  type AurenRuntimeState,
} from "./runtime.ts";
import { oscProgress, shouldNotify, writeTerminalControl } from "./terminal.ts";

const TIMER_INTERVAL_MS = 1000;
const DEFAULT_NOTIFY_AFTER_MS = 15_000;

function notifyAfterMs(pi: ExtensionAPI): number {
  const raw = pi.getFlag("auren-notify-after-ms");
  const parsed = typeof raw === "string" ? Number(raw) : DEFAULT_NOTIFY_AFTER_MS;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_NOTIFY_AFTER_MS;
}
type SessionEntries = ReturnType<ExtensionContext["sessionManager"]["getEntries"]>;

function rebuildSessionActive(entries: SessionEntries): number {
  return estimateSessionActiveMs(entries);
}

function titleStatus(state: AurenRuntimeState): string {
  switch (state.status) {
    case "working":
      return "◐";
    case "done":
      return "✓";
    case "error":
      return "!";
    default:
      return "○";
  }
}

function terminalTitle(pi: ExtensionAPI, ctx: ExtensionContext, state: AurenRuntimeState): string {
  const workspace = basename(ctx.cwd) || ctx.cwd;
  const session = pi.getSessionName();
  return [titleStatus(state), session, workspace].filter(Boolean).join(" · ");
}

export default function aurenUi(pi: ExtensionAPI) {
  const phone = registerPhoneNotify(pi);
  pi.registerFlag("auren-notify", {
    description: "Enable Auren completion BEL notifications",
    type: "boolean",
    default: true,
  });
  pi.registerFlag("auren-notify-after-ms", {
    description: "Minimum successful run duration before Auren sends a BEL",
    type: "string",
    default: String(DEFAULT_NOTIFY_AFTER_MS),
  });

  let state = createRuntimeState();
  let timer: ReturnType<typeof setInterval> | undefined;
  let requestRender: (() => void) | undefined;
  let runStartLeafId: string | null | undefined;
  const footerStatuses = new Map<string, FooterStatusContribution>();

  const stopTimer = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  const renderNow = () => requestRender?.();

  pi.events.on(FOOTER_STATUS_CHANNEL, value => {
    if (applyFooterStatus(footerStatuses, value)) renderNow();
  });

  const startTimer = () => {
    stopTimer();
    if (!requestRender) return;
    timer = setInterval(renderNow, TIMER_INTERVAL_MS);
  };

  const refreshTitle = (ctx: ExtensionContext) => {
    if (ctx.mode === "tui") ctx.ui.setTitle(terminalTitle(pi, ctx, state));
  };

  const setProgress = (ctx: ExtensionContext, progress: "clear" | "error" | "indeterminate") => {
    if (ctx.mode === "tui") writeTerminalControl(oscProgress(progress));
  };

  const clearOwnedUi = (ctx: ExtensionContext) => {
    stopTimer();
    requestRender = undefined;
    if (ctx.mode === "tui") {
      ctx.ui.setFooter(undefined);
      ctx.ui.setTitle(basename(ctx.cwd) || "pi");
      setProgress(ctx, "clear");
    }
  };

  pi.registerEntryRenderer<AurenCompletionEntryV1>(COMPLETION_ENTRY_TYPE, (entry, _options, theme) => {
    if (!isCompletionEntryData(entry.data)) return undefined;
    const suffix = entry.data.outcome === "error" ? " · error" : "";
    const text = `${formatLocalDateTime(entry.data.completedAt)} · run ${formatDuration(entry.data.durationMs)}${suffix}`;
    return new Text(theme.fg("dim", text), 1, 0);
  });

  pi.on("session_start", (_event, ctx) => {
    stopTimer();
    requestRender = undefined;
    runStartLeafId = undefined;
    footerStatuses.clear();
    state = createRuntimeState(rebuildSessionActive(ctx.sessionManager.getEntries()));
    pi.events.emit(FOOTER_STATUS_REQUEST_CHANNEL, { version: 1 });

    if (ctx.mode !== "tui") return;

    refreshTitle(ctx);
    setProgress(ctx, "clear");
    ctx.ui.setFooter((tui, theme) => {
      const ownedRender = () => tui.requestRender();
      requestRender = ownedRender;
      if (state.status === "working") startTimer();

      return {
        invalidate() {},
        dispose() {
          if (requestRender === ownedRender) {
            requestRender = undefined;
            stopTimer();
          }
        },
        render(width: number): string[] {
          return [renderFooter({
            session: pi.getSessionName(),
            cwd: ctx.cwd,
            model: ctx.model?.id,
            thinking: ctx.thinkingLevel,
            contextPercent: ctx.getContextUsage()?.percent,
            statuses: orderedFooterStatuses(footerStatuses),
          }, state, width, Date.now(), theme)];
        },
      };
    });
  });

  pi.on("agent_start", (_event, ctx) => {
    if (state.status !== "working") {
      runStartLeafId = ctx.sessionManager.getLeafId();
      startRun(state, Date.now());
    }
    if (ctx.mode === "tui") {
      refreshTitle(ctx);
      setProgress(ctx, "indeterminate");
      startTimer();
      renderNow();
    }
  });

  pi.on("message_end", (event) => {
    if (state.status !== "working" || event.message.role !== "assistant") return;
    if (event.message.stopReason === "error" || event.message.stopReason === "aborted") {
      markRunError(state);
    } else if (event.message.stopReason === "stop") {
      // A successful final response supersedes recoverable intermediate failures.
      state.runHadError = false;
    }
  });

  pi.on("tool_execution_end", (event) => {
    if (event.isError) markRunError(state);
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (state.runStartedAt === undefined) return;
    const startLeafId = runStartLeafId;
    runStartLeafId = undefined;
    stopTimer();
    const duration = settleRun(state, Date.now());
    try {
      const branch = ctx.sessionManager.getBranch();
      const finalAssistant =
        startLeafId === undefined ? undefined : findFinalAssistantEntry(branch, startLeafId);
      if (finalAssistant && !completionAlreadyFollows(branch, finalAssistant.id)) {
        pi.appendEntry<AurenCompletionEntryV1>(COMPLETION_ENTRY_TYPE, {
          version: 1,
          completedAt: new Date().toISOString(),
          durationMs: duration,
          assistantEntryId: finalAssistant.id,
          outcome: state.status === "error" ? "error" : "done",
        });
      }
    } catch {
      if (ctx.mode === "tui") ctx.ui.notify("Auren completion metadata could not be saved.", "warning");
    }
    phone.settled(ctx, duration, state.status === "error");
    if (ctx.mode === "tui") {
      refreshTitle(ctx);
      setProgress(ctx, state.status === "error" ? "error" : "clear");
      if (
        pi.getFlag("auren-notify") !== false &&
        shouldNotify(duration, notifyAfterMs(pi), state.status === "error")
      ) {
        writeTerminalControl("\x07");
      }
      renderNow();
    }
  });

  pi.on("model_select", () => renderNow());

  pi.on("thinking_level_select", () => renderNow());
  pi.on("session_info_changed", (_event, ctx) => {
    refreshTitle(ctx);
    renderNow();
  });
  pi.on("session_tree", () => renderNow());

  pi.on("session_shutdown", (_event, ctx) => {
    runStartLeafId = undefined;
    footerStatuses.clear();
    state = createRuntimeState();
    clearOwnedUi(ctx);
  });
}
