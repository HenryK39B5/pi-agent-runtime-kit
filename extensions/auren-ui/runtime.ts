import { COMPLETION_ENTRY_TYPE, isCompletionEntryData } from "./completion.ts";

export const RUN_TIMING_ENTRY_TYPE = "auren.run-timing.v1";
export interface RunTimingData {
  version: 1;
  completedAt: string;
  durationMs: number;
  runStartLeafId: string | null;
  runEndLeafId: string | null;
  outcome: "done" | "error";
}

export type AurenRunStatus = "idle" | "working" | "done" | "error";

export interface AurenRuntimeState {
  status: AurenRunStatus;
  runStartedAt?: number;
  lastRunDurationMs?: number;
  sessionActiveMs: number;
  runHadError: boolean;
}

export interface TimestampedEntry {
  id?: string;
  parentId?: string | null;
  customType?: string;
  data?: unknown;
  type?: string;
  timestamp?: number | string;
  message?: {
    role?: string;
    timestamp?: number | string;
    stopReason?: string;
  };
}

export function createRuntimeState(sessionActiveMs = 0): AurenRuntimeState {
  return {
    status: "idle",
    sessionActiveMs: Math.max(0, sessionActiveMs),
    runHadError: false,
  };
}

export function startRun(state: AurenRuntimeState, now: number): void {
  if (state.status === "working") return;
  state.status = "working";
  state.runStartedAt = now;
  state.runHadError = false;
}

export function markRunError(state: AurenRuntimeState): void {
  if (state.status === "working") state.runHadError = true;
}

export function settleRun(state: AurenRuntimeState, now: number): number {
  if (state.runStartedAt === undefined) {
    return 0;
  }

  const duration = Math.max(0, now - state.runStartedAt);
  state.sessionActiveMs += duration;
  state.lastRunDurationMs = duration;
  state.runStartedAt = undefined;
  state.status = state.runHadError ? "error" : "done";
  return duration;
}

export function currentRunDuration(state: AurenRuntimeState, now: number): number | undefined {
  if (state.runStartedAt === undefined) return state.lastRunDurationMs;
  return Math.max(0, now - state.runStartedAt);
}

/** Cached settled history plus the current in-memory run, if any. */
export function sessionActiveAt(state: AurenRuntimeState, now: number): number {
  const current = state.runStartedAt === undefined ? 0 : Math.max(0, now - state.runStartedAt);
  return state.sessionActiveMs + current;
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function parseTime(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function isRunTimingData(value: unknown): value is RunTimingData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<RunTimingData>;
  return data.version === 1 && typeof data.durationMs === "number" && Number.isFinite(data.durationMs) &&
    data.durationMs >= 0 && typeof data.completedAt === "string" && parseTime(data.completedAt) !== undefined &&
    [data.runStartLeafId, data.runEndLeafId].every(id => id === null || (typeof id === "string" && id.length > 0)) &&
    (data.outcome === "done" || data.outcome === "error");
}

/** Exact recorded runs where available; conservative, branch-aware fallback for older history.
 * Assistant timestamps denote generation START, so use persisted entry time for its end.
 * No disk I/O or per-render scan; idle compact/summary cannot extend an already closed span.
 */
export function estimateSessionActiveMs(entries: readonly TimestampedEntry[]): number {
  let total = 0;
  const byId = new Map<string, number>();
  entries.forEach((entry, index) => { if (entry.id && !byId.has(entry.id)) byId.set(entry.id, index); });
  const covered = new Set<number>();
  const recorded = new Set<string>();

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.type !== "custom") continue;
    const completion = entry.customType === COMPLETION_ENTRY_TYPE && isCompletionEntryData(entry.data) ? entry.data : undefined;
    const timing = entry.customType === RUN_TIMING_ENTRY_TYPE && isRunTimingData(entry.data) ? entry.data : undefined;
    if (!completion && !timing) continue;
    const data = completion ?? timing!;
    const key = completion ? `answer:${completion.assistantEntryId}` : `run:${timing!.runStartLeafId}:${timing!.runEndLeafId}`;
    if (recorded.has(key)) continue;
    const target = completion ? byId.get(completion.assistantEntryId) : undefined;
    if (completion && (target === undefined || target >= index || entries[target].message?.role !== "assistant")) continue;
    const endId = data.runEndLeafId ?? (completion ? completion.assistantEntryId : null);
    if (endId === null && timing?.runStartLeafId === null && entry.parentId === null) {
      recorded.add(key); total += timing.durationMs; continue;
    }
    let cursor = endId === null ? undefined : byId.get(endId);
    if (cursor === undefined || cursor >= index) continue;
    if (entry.parentId !== undefined && entry.parentId !== endId) {
      let ancestor = entry.parentId === null ? undefined : byId.get(entry.parentId);
      const seen = new Set<number>();
      while (ancestor !== undefined && ancestor > cursor && !seen.has(ancestor)) {
        seen.add(ancestor);
        const parent = entries[ancestor].parentId;
        ancestor = typeof parent === "string" ? byId.get(parent) : undefined;
      }
      if (ancestor !== cursor) continue;
    }
    const hasStart = Object.hasOwn(data, "runStartLeafId");
    const startId = data.runStartLeafId;
    const path: number[] = [];
    const seen = new Set<number>();
    let reached = !hasStart;
    let boundAnswer = !completion;
    while (cursor !== undefined && !seen.has(cursor)) {
      seen.add(cursor);
      const node: TimestampedEntry = entries[cursor];
      if (cursor === target) boundAnswer = true;
      if (hasStart && node.id === startId) {
        if (node.message?.role === "user") path.push(cursor);
        reached = true; break;
      }
      if (node.type === "custom" && (node.customType === COMPLETION_ENTRY_TYPE || node.customType === RUN_TIMING_ENTRY_TYPE)) break;
      path.push(cursor);
      if (!hasStart && node.message?.role === "user") break;
      if (node.parentId === null) { if (startId === null) reached = true; break; }
      cursor = node.parentId === undefined ? cursor - 1 : byId.get(node.parentId);
      if (cursor !== undefined && cursor < 0) cursor = undefined;
    }
    if (!reached || !boundAnswer) continue;
    recorded.add(key);
    total += data.durationMs;
    path.forEach(member => covered.add(member));
  }

  interface Span { start?: number; latest?: number; closed: boolean; recorded: boolean; }
  const spans = new Map<number, Span>();
  const owners = new Map<string, number | undefined>();
  let linearOwner: number | undefined;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const user = entry.type === "message" && entry.message?.role === "user";
    const owner = user ? index : entry.parentId === undefined ? linearOwner :
      entry.parentId === null ? undefined : owners.get(entry.parentId);
    if (entry.id) owners.set(entry.id, owner);
    if (user) {
      linearOwner = index;
      const start = parseTime(entry.message?.timestamp) ?? parseTime(entry.timestamp);
      spans.set(index, { start, latest: start, closed: false, recorded: covered.has(index) });
      continue;
    }
    if (owner === undefined) continue;
    const span = spans.get(owner);
    if (!span) continue;
    if (covered.has(index)) { span.recorded = true; continue; }
    if (span.closed || span.recorded || span.start === undefined) continue;
    const activity = entry.type === "message" && ["assistant", "toolResult"].includes(entry.message?.role ?? "") ||
      entry.type === "compaction"; // A tree summary may follow arbitrary idle navigation.
    if (!activity) continue;
    const end = parseTime(entry.timestamp) ?? parseTime(entry.message?.timestamp);
    if (end !== undefined && end >= span.start) span.latest = Math.max(span.latest ?? span.start, end);
    if (entry.message?.role === "assistant" && entry.message.stopReason !== "toolUse") span.closed = true;
  }
  for (const span of spans.values())
    if (!span.recorded && span.start !== undefined && span.latest !== undefined) total += Math.max(0, span.latest - span.start);
  return Math.max(0, total);
}
