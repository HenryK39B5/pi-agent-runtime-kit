import { stripTerminalSequences, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { currentRunDuration, formatDuration, sessionActiveAt, type AurenRuntimeState } from "./runtime.ts";
import type { FooterStatusContribution } from "./footer-status.ts";

export interface FooterData {
  session?: string;
  cwd: string;
  model?: string;
  thinking?: string;
  contextPercent?: number | null;
  statuses?: readonly FooterStatusContribution[];
}

const clean = (value: string) => stripTerminalSequences(value).replace(/[\r\n\t\x00-\x1f\x7f]/g, " ");

/** One row, whole optional fields, measured in terminal cells rather than JS characters. */
export function renderFooter(data: FooterData, state: AurenRuntimeState, width: number, now: number, theme: Pick<Theme, "fg">): string {
  width = Math.max(0, Math.floor(width));
  if (width === 0) return "";
  const labels = { idle: "○ ready", working: "◐ working", done: "✓ done", error: "! error" } as const;
  const tones = { idle: "muted", working: "accent", done: "success", error: "error" } as const;
  const duration = currentRunDuration(state, now);
  let left = theme.fg(tones[state.status], labels[state.status]);
  if (duration !== undefined) left += theme.fg("muted", ` · ${formatDuration(duration)}`);
  if (visibleWidth(left) > width) return truncateToWidth(left, width);

  let right = "";
  const sep = theme.fg("dim", " · ");
  const fits = (l: string, r: string) => visibleWidth(l) + (r ? 3 + visibleWidth(r) : 0) <= width;
  const addLeft = (field: string) => {
    if (fits(left + sep + field, right)) left += sep + field;
  };
  const addRight = (field: string) => {
    const candidate = right ? right + sep + field : field;
    if (fits(left, candidate)) right = candidate;
  };

  // Reserve Context before bounding a long session name, so pressure remains visible.
  const percent = data.contextPercent;
  if (typeof percent === "number" && Number.isFinite(percent)) {
    addRight(theme.fg(percent >= 95 ? "error" : percent >= 80 ? "warning" : "muted", `ctx ${Math.round(Math.max(0, percent))}%`));
  }
  if (data.session) {
    const available = width - visibleWidth(left) - 3 - (right ? visibleWidth(right) + 3 : 0);
    if (available >= 8) addLeft(theme.fg("text", truncateToWidth(clean(data.session), Math.min(28, available))));
  }
  for (const status of data.statuses ?? []) addRight(theme.fg(status.tone, clean(status.label)));
  if (data.model) addRight(theme.fg("muted", truncateToWidth(clean(data.model), 28)));
  if (data.thinking && data.thinking !== "off") addRight(theme.fg("dim", clean(data.thinking)));
  // Never substitute a basename for the requested full working directory.
  if (data.cwd) addLeft(theme.fg("dim", clean(data.cwd)));
  addLeft(theme.fg("dim", `session ~${formatDuration(sessionActiveAt(state, now))}`));
  return right ? left + " ".repeat(width - visibleWidth(left) - visibleWidth(right)) + right : left;
}
