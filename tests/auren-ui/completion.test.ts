import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPLETION_ENTRY_TYPE,
  completionAlreadyFollows,
  findFinalAssistantEntry,
  formatLocalDateTime,
  isCompletionEntryData,
} from "../../extensions/auren-ui/completion.ts";

type FixtureEntry = ReturnType<typeof buildMessageEntry>;
function messageEntry(id: string, role: "assistant", text: string): Omit<FixtureEntry, "message"> & { message: Extract<FixtureEntry["message"], { role: "assistant" }> };
function messageEntry(id: string, role: "user", text: string): Omit<FixtureEntry, "message"> & { message: Extract<FixtureEntry["message"], { role: "user" }> };
function messageEntry(id: string, role: "user" | "assistant", text: string) {
  return buildMessageEntry(id, role, text);
}

function buildMessageEntry(id: string, role: "user" | "assistant", text: string) {
  return {
    type: "message" as const,
    id,
    parentId: null,
    timestamp: "2026-08-30T06:32:00.000Z",
    message: {
      content: [{ type: "text" as const, text }],
      timestamp: Date.parse("2026-08-30T06:32:00.000Z"),
      ...(role === "assistant"
        ? {
            role: "assistant" as const,
            api: "openai-responses" as const,
            provider: "test",
            model: "test",
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: "stop" as const,
          }
        : { role: "user" as const }),
    },
  };
}

test("completion data validator rejects malformed durable entries", () => {
  assert.equal(
    isCompletionEntryData({
      version: 1,
      completedAt: "2026-08-30T06:32:00.000Z",
      durationMs: 84_000,
      assistantEntryId: "assistant-1",
      outcome: "done",
    }),
    true,
  );
  assert.equal(isCompletionEntryData({ version: 1, completedAt: "invalid" }), false);
});

test("local date-time formatter is stable and omits wall-clock seconds", () => {
  const instant = new Date(2026, 7, 30, 14, 32, 59).toISOString();
  assert.equal(formatLocalDateTime(instant), "2026-08-30 14:32");
});

test("final Assistant search is limited to entries after run start", () => {
  const before = messageEntry("assistant-before", "assistant", "Old answer");
  const start = messageEntry("user-run", "user", "New request");
  const toolCallOnly = {
    ...messageEntry("assistant-tool", "assistant", ""),
    message: {
      ...messageEntry("assistant-tool", "assistant", "").message,
      content: [{ type: "toolCall" as const, id: "tool-1", name: "read", arguments: {} }],
    },
  };
  const mixedTextAndTool = {
    ...messageEntry("assistant-mixed-tool", "assistant", "I will inspect this first."),
    message: {
      ...messageEntry("assistant-mixed-tool", "assistant", "I will inspect this first.").message,
      content: [
        { type: "text" as const, text: "I will inspect this first." },
        { type: "toolCall" as const, id: "tool-2", name: "read", arguments: {} },
      ],
    },
  };
  const final = messageEntry("assistant-final", "assistant", "Final answer");
  const branch = [before, start, toolCallOnly, mixedTextAndTool, final];

  assert.equal(findFinalAssistantEntry(branch, start.id)?.id, final.id);
  assert.equal(findFinalAssistantEntry([before, start, mixedTextAndTool], start.id), undefined);
  assert.equal(findFinalAssistantEntry([before, start], start.id), undefined);
  assert.equal(findFinalAssistantEntry(branch, "missing-leaf"), undefined);
});

test("duplicate guard binds completion metadata by Assistant entry id", () => {
  const assistant = messageEntry("assistant-final", "assistant", "Final answer");
  const completion = {
    type: "custom" as const,
    id: "completion-1",
    parentId: assistant.id,
    timestamp: "2026-08-30T06:32:00.000Z",
    customType: COMPLETION_ENTRY_TYPE,
    data: {
      version: 1 as const,
      completedAt: "2026-08-30T06:32:00.000Z",
      durationMs: 84_000,
      assistantEntryId: assistant.id,
      outcome: "done" as const,
    },
  };

  assert.equal(completionAlreadyFollows([assistant, completion], assistant.id), true);
  assert.equal(completionAlreadyFollows([assistant, completion], "another-assistant"), false);
});
