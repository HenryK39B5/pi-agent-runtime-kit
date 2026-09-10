import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const COMPLETION_ENTRY_TYPE = "auren.completion.v1";

export interface AurenCompletionEntryV1 {
  version: 1;
  completedAt: string;
  durationMs: number;
  assistantEntryId: string;
  outcome: "done" | "error";
}

type SessionEntry = ReturnType<ExtensionContext["sessionManager"]["getBranch"]>[number];

export function isCompletionEntryData(value: unknown): value is AurenCompletionEntryV1 {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AurenCompletionEntryV1>;
  return (
    data.version === 1 &&
    typeof data.completedAt === "string" &&
    Number.isFinite(Date.parse(data.completedAt)) &&
    typeof data.durationMs === "number" &&
    Number.isFinite(data.durationMs) &&
    data.durationMs >= 0 &&
    typeof data.assistantEntryId === "string" &&
    data.assistantEntryId.length > 0 &&
    (data.outcome === "done" || data.outcome === "error")
  );
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatLocalDateTime(isoInstant: string): string {
  const date = new Date(isoInstant);
  if (!Number.isFinite(date.getTime())) return "unknown time";
  return [
    date.getFullYear(),
    "-",
    twoDigits(date.getMonth() + 1),
    "-",
    twoDigits(date.getDate()),
    " ",
    twoDigits(date.getHours()),
    ":",
    twoDigits(date.getMinutes()),
  ].join("");
}

export function isFinalAssistantAnswer(entry: SessionEntry): boolean {
  if (entry.type !== "message" || entry.message.role !== "assistant") return false;
  const hasVisibleText = entry.message.content.some(
    (part) => part.type === "text" && part.text.trim().length > 0,
  );
  const hasToolCall = entry.message.content.some((part) => part.type === "toolCall");
  return hasVisibleText && !hasToolCall;
}

/** Find the last visible Assistant answer appended after the leaf captured at agent_start. */
export function findFinalAssistantEntry(
  branch: readonly SessionEntry[],
  runStartLeafId: string | null,
): Extract<SessionEntry, { type: "message" }> | undefined {
  const startIndex = runStartLeafId === null ? -1 : branch.findIndex((entry) => entry.id === runStartLeafId);
  if (runStartLeafId !== null && startIndex < 0) return undefined;

  for (let index = branch.length - 1; index > startIndex; index--) {
    const entry = branch[index];
    if (isFinalAssistantAnswer(entry)) {
      return entry as Extract<SessionEntry, { type: "message" }>;
    }
  }
  return undefined;
}

export function completionAlreadyFollows(
  branch: readonly SessionEntry[],
  assistantEntryId: string,
): boolean {
  return branch.some(
    (entry) =>
      entry.type === "custom" &&
      entry.customType === COMPLETION_ENTRY_TYPE &&
      isCompletionEntryData(entry.data) &&
      entry.data.assistantEntryId === assistantEntryId,
  );
}
