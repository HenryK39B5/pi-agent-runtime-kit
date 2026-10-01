import assert from "node:assert/strict";
import test from "node:test";
import { estimateSessionActiveMs, RUN_TIMING_ENTRY_TYPE, type TimestampedEntry } from "../../extensions/auren-ui/runtime.ts";
const iso = (ms: number) => new Date(ms).toISOString();
test("a settled empty-root run can record timing without creating a visible answer", () => {
  assert.equal(estimateSessionActiveMs([{ id: "time", parentId: null, type: "custom", customType: RUN_TIMING_ENTRY_TYPE,
    data: { version: 1, completedAt: iso(1000), durationMs: 1000, runStartLeafId: null, runEndLeafId: null, outcome: "error" } }]), 1000);
});
const message = (id: string, parentId: string | null, role: string, end: number, start = end, stopReason = "stop"): TimestampedEntry =>
  ({ id, parentId, type: "message", timestamp: iso(end), message: { role, timestamp: start, stopReason } });
const completion = (id: string, parentId: string, assistantEntryId: string, durationMs: number, extra = {}): TimestampedEntry =>
  ({ id, parentId, type: "custom", customType: "auren.completion.v1", data: { version: 1, completedAt: iso(100000), durationMs, assistantEntryId, outcome: "done", ...extra } });

test("resume prefers recorded final-generation duration and idle compaction cannot add an hour", () => {
  const entries = [message("u", null, "user", 0), message("a", "u", "assistant", 120000, 1000), completion("c", "a", "a", 120000)];
  assert.equal(estimateSessionActiveMs(entries), 120000);
  entries.push({ id: "compact", parentId: "c", type: "compaction", timestamp: iso(3600000) });
  assert.equal(estimateSessionActiveMs(entries), 120000);
});
test("legacy fallback uses persisted assistant end and closes before idle compact/tree summaries", () => {
  const entries = [message("u", null, "user", 1000), message("a", "u", "assistant", 5000, 1200),
    { id: "compact", parentId: "a", type: "compaction", timestamp: iso(3600000) },
    { id: "summary", parentId: "a", type: "branch_summary", timestamp: iso(7200000) }];
  assert.equal(estimateSessionActiveMs(entries), 4000);
});
test("explicit Run boundaries cover queued/steering user messages without double-counting", () => {
  const entries = [{ id: "setup", parentId: null, type: "model_change" },
    message("u1", "setup", "user", 1000), message("tool", "u1", "assistant", 2000, 1500, "toolUse"),
    message("u2", "tool", "user", 3000), message("result", "u2", "toolResult", 3500), message("a", "result", "assistant", 6000, 4000),
    completion("c", "a", "a", 5000, { runStartLeafId: "setup", runEndLeafId: "a" })];
  assert.equal(estimateSessionActiveMs(entries), 5000);
});
test("mixed recorded and legacy runs retain earlier work but exclude waiting for continue", () => {
  const entries = [message("u1", null, "user", 1000), message("a1", "u1", "assistant", 5000), completion("c1", "a1", "a1", 4000),
    message("u2", "c1", "user", 20000), message("a2", "u2", "assistant", 24000, 21000)];
  assert.equal(estimateSessionActiveMs(entries), 8000);
});
test("all executed branches count, duplicate metadata and unrelated branch binding do not", () => {
  const entries = [message("u", null, "user", 0), message("a1", "u", "assistant", 2000), completion("c1", "a1", "a1", 2000),
    message("a2", "u", "assistant", 5000), completion("c2", "a2", "a2", 3000), completion("duplicate", "c2", "a2", 999999),
    completion("forged", "a1", "a2", 999999)];
  assert.equal(estimateSessionActiveMs(entries), 5000);
});
test("failure without visible text has durable timing and manual continue is a separate counted Run", () => {
  const entries: TimestampedEntry[] = [message("u1", null, "user", 1000), message("error", "u1", "assistant", 2000, 1100, "error"),
    { id: "failure-time", parentId: "error", type: "custom", customType: RUN_TIMING_ENTRY_TYPE,
      data: { version: 1, completedAt: iso(3500), durationMs: 2500, runStartLeafId: null, runEndLeafId: "error", outcome: "error" } },
    message("u2", "failure-time", "user", 30000), message("a2", "u2", "assistant", 32000, 30100),
    completion("c2", "a2", "a2", 2000, { runStartLeafId: "failure-time", runEndLeafId: "a2" })];
  assert.equal(estimateSessionActiveMs(entries), 4500);
});
test("invalid boundaries or malformed metadata fall back without trusting declared durations", () => {
  const entries = [message("u", null, "user", 0), message("a", "u", "assistant", 2000),
    completion("bad", "a", "a", 999999, { runStartLeafId: "missing", runEndLeafId: "a" }),
    completion("bad2", "a", "a", -1)];
  assert.equal(estimateSessionActiveMs(entries), 2000);
});
