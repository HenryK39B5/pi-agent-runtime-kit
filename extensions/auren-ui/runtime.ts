export type AurenRunStatus = "idle" | "working" | "done" | "error";

export interface AurenRuntimeState {
  status: AurenRunStatus;
  runStartedAt?: number;
  lastRunDurationMs?: number;
  sessionActiveMs: number;
  runHadError: boolean;
}

export interface TimestampedEntry {
  type?: string;
  timestamp?: number | string;
  message?: {
    role?: string;
    timestamp?: number | string;
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

function timestampOf(entry: TimestampedEntry): number | undefined {
  const raw = entry.message?.timestamp ?? entry.timestamp;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * Rebuild an intentionally conservative estimate from append-only session entries.
 * Each user message opens an activity span; the latest timestamp before the next
 * user message closes it. Entries without timestamps never add guessed time.
 */
export function estimateSessionActiveMs(entries: readonly TimestampedEntry[]): number {
  let total = 0;
  let openedAt: number | undefined;
  let latestAt: number | undefined;

  const close = () => {
    if (openedAt !== undefined && latestAt !== undefined && latestAt >= openedAt) {
      total += latestAt - openedAt;
    }
  };

  for (const entry of entries) {
    const timestamp = timestampOf(entry);
    const isUserMessage = entry.type === "message" && entry.message?.role === "user";

    if (isUserMessage) {
      close();
      openedAt = timestamp;
      latestAt = timestamp;
      continue;
    }

    const isActivityEntry =
      (entry.type === "message" &&
        (entry.message?.role === "assistant" || entry.message?.role === "toolResult")) ||
      entry.type === "compaction" || entry.type === "branch_summary";
    if (openedAt !== undefined && isActivityEntry && timestamp !== undefined && timestamp >= openedAt) {
      latestAt = Math.max(latestAt ?? openedAt, timestamp);
    }
  }

  close();
  return Math.max(0, total);
}
