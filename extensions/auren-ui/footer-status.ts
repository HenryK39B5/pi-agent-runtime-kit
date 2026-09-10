import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";

export const FOOTER_STATUS_CHANNEL = "auren:footer-status:v1";
export const FOOTER_STATUS_REQUEST_CHANNEL = "auren:footer-status-request:v1";
export const MAX_FOOTER_STATUSES = 8;
export type FooterStatusTone = "muted" | "accent" | "success" | "warning" | "error";

export interface FooterStatusContribution {
  version: 1;
  id: string;
  active: true;
  label: string;
  tone: FooterStatusTone;
  priority: number;
}

const ID = /^[a-z][a-z0-9.-]{0,31}$/;
const TONES = new Set<FooterStatusTone>(["muted", "accent", "success", "warning", "error"]);
const clean = (value: string) => stripTerminalSequences(value).replace(/[\r\n\t\x00-\x1f\x7f]/g, " ").trim();
function boundLabel(value: string): string {
  let result = "";
  for (const character of Array.from(value)) {
    if (visibleWidth(result + character) > 18) break;
    result += character;
  }
  return result;
}

function same(a: FooterStatusContribution | undefined, b: FooterStatusContribution): boolean {
  return !!a && a.label === b.label && a.tone === b.tone && a.priority === b.priority;
}

/** Apply an untrusted, data-only contribution. Returns true only when visible state changed. */
export function applyFooterStatus(registry: Map<string, FooterStatusContribution>, value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.id !== "string" || !ID.test(raw.id) || typeof raw.active !== "boolean") return false;
  if (!raw.active) return registry.delete(raw.id);
  if (typeof raw.label !== "string") return false;
  const label = boundLabel(clean(raw.label));
  if (!label) return false;
  const tone = typeof raw.tone === "string" && TONES.has(raw.tone as FooterStatusTone)
    ? raw.tone as FooterStatusTone : "muted";
  const priority = typeof raw.priority === "number" && Number.isFinite(raw.priority)
    ? Math.max(0, Math.min(100, Math.round(raw.priority))) : 50;
  if (!registry.has(raw.id) && registry.size >= MAX_FOOTER_STATUSES) return false;
  const next: FooterStatusContribution = { version: 1, id: raw.id, active: true, label, tone, priority };
  if (same(registry.get(raw.id), next)) return false;
  registry.set(raw.id, next);
  return true;
}

export function orderedFooterStatuses(registry: ReadonlyMap<string, FooterStatusContribution>): FooterStatusContribution[] {
  return [...registry.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}
