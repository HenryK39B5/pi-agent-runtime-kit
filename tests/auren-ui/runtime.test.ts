import assert from "node:assert/strict";
import test from "node:test";

import {
  createRuntimeState,
  currentRunDuration,
  estimateSessionActiveMs,
  formatDuration,
  markRunError,
  sessionActiveAt,
  settleRun,
  startRun,
} from "../../extensions/auren-ui/runtime.ts";

test("idle settlement preserves idle status", () => {
  const state = createRuntimeState();
  assert.equal(settleRun(state, 1_000), 0);
  assert.equal(state.status, "idle");
});

test("history excludes manual Bash and does not regress on older activity", () => {
  assert.equal(estimateSessionActiveMs([
    { type: "message", message: { role: "user", timestamp: 1_000 } },
    { type: "message", message: { role: "assistant", timestamp: 5_000 } },
    { type: "message", message: { role: "toolResult", timestamp: 3_000 } },
    { type: "message", message: { role: "bashExecution", timestamp: 90_000 } },
  ]), 4_000);
});

test("formatDuration follows Auren compact rules", () => {
  assert.equal(formatDuration(42_999), "42s");
  assert.equal(formatDuration(84_000), "1m 24s");
  assert.equal(formatDuration(4_080_000), "1h 08m");
});

test("runtime state accumulates settled runs and ignores duplicate starts", () => {
  const state = createRuntimeState(5_000);
  startRun(state, 10_000);
  startRun(state, 15_000);

  assert.equal(currentRunDuration(state, 20_000), 10_000);
  assert.equal(sessionActiveAt(state, 20_000), 15_000);
  assert.equal(settleRun(state, 20_000), 10_000);
  assert.equal(state.sessionActiveMs, 15_000);
  assert.equal(sessionActiveAt(state, 30_000), 15_000);
  assert.equal(state.status, "done");
});

test("duplicate settled events do not double count a run", () => {
  const state = createRuntimeState(1_000);
  startRun(state, 10_000);

  assert.equal(settleRun(state, 13_000), 3_000);
  assert.equal(settleRun(state, 20_000), 0);
  assert.equal(state.sessionActiveMs, 4_000);
});

test("clock rollback is clamped and never reduces active time", () => {
  const state = createRuntimeState(5_000);
  startRun(state, 10_000);

  assert.equal(sessionActiveAt(state, 9_000), 5_000);
  assert.equal(settleRun(state, 9_000), 0);
  assert.equal(state.sessionActiveMs, 5_000);
});

test("a tool error marks the settled run as error", () => {
  const state = createRuntimeState();
  startRun(state, 1_000);
  markRunError(state);
  settleRun(state, 2_500);

  assert.equal(state.status, "error");
  assert.equal(state.lastRunDurationMs, 1_500);
});

test("session estimate excludes time between user turns", () => {
  const entries = [
    { type: "message", message: { role: "user", timestamp: 1_000 } },
    { type: "message", message: { role: "assistant", timestamp: 4_000 } },
    { type: "message", message: { role: "user", timestamp: 20_000 } },
    { type: "message", message: { role: "toolResult", timestamp: 23_000 } },
    { type: "message", message: { role: "assistant", timestamp: 25_000 } },
  ];

  assert.equal(estimateSessionActiveMs(entries), 8_000);
});

test("session estimate accepts ISO entry timestamps and ignores metadata", () => {
  const entries = [
    { type: "message", timestamp: "2026-08-30T10:00:00.000Z", message: { role: "user" } },
    { type: "model_change", timestamp: "2026-08-30T10:05:00.000Z" },
    { type: "compaction", timestamp: "2026-08-30T10:00:03.000Z" },
    { type: "message", timestamp: "2026-08-30T10:00:05.000Z", message: { role: "assistant" } },
  ];

  assert.equal(estimateSessionActiveMs(entries), 5_000);
});

test("session estimate ignores invalid and backward timestamps", () => {
  const entries = [
    { type: "message", timestamp: "2026-08-30T10:00:10.000Z", message: { role: "user" } },
    { type: "message", timestamp: "not-a-date", message: { role: "assistant" } },
    { type: "message", timestamp: "2026-08-30T10:00:05.000Z", message: { role: "assistant" } },
  ];

  assert.equal(estimateSessionActiveMs(entries), 0);
});

test("session estimate does not invent spans without timestamps", () => {
  assert.equal(
    estimateSessionActiveMs([
      { type: "message", message: { role: "user" } },
      { type: "message", message: { role: "assistant", timestamp: 5_000 } },
    ]),
    0,
  );
});
