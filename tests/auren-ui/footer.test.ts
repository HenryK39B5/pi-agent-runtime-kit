import assert from "node:assert/strict";
import test from "node:test";
import "./installed-tui.ts";
import { createRuntimeState, startRun } from "../../extensions/auren-ui/runtime.ts";
const { renderFooter } = await import("../../extensions/auren-ui/footer.ts");
const { applyFooterStatus, orderedFooterStatuses, MAX_FOOTER_STATUSES } = await import("../../extensions/auren-ui/footer-status.ts");
const { visibleWidth, stripTerminalSequences } = await import("@earendil-works/pi-tui");
const colors: Record<string, number> = { text: 37, muted: 90, dim: 90, accent: 34, success: 32, warning: 33, error: 31 };
const theme = { fg: (color: string, text: string) => `\x1b[${colors[color]}m${text}\x1b[0m` };
const data = { session: "设计审查", cwd: "C:\\workspace\\中文工作区", model: "gpt-test", thinking: "high", contextPercent: 97 };

test("footer stays within every width with CJK, ANSI, emoji and long identities", () => {
  for (const status of ["idle", "working", "done", "error"] as const) {
    const state = { ...createRuntimeState(), status, lastRunDurationMs: 65_000 };
    for (let width = 0; width <= 240; width++) {
      const line = renderFooter({ ...data, session: "\x1b[31m设计👩‍💻".repeat(20) + "\nBAD", model: "model-".repeat(15) }, state, width, 0, theme);
      assert.ok(visibleWidth(line) <= width, `overflow at ${width}`);
      assert.ok(!line.includes("\n"));
    }
  }
});

test("wide footer preserves full Windows path, identity, estimate and right alignment", () => {
  const line = renderFooter(data, createRuntimeState(), 180, 0, theme);
  const plain = stripTerminalSequences(line);
  for (const field of [data.cwd, data.session, data.model, "session ~0s", "ctx 97%"])
    assert.ok(plain.includes(field));
  assert.equal(visibleWidth(line), 180);
  assert.ok(plain.endsWith("high"));
});

test("only status and context use semantic colors; duration and model remain neutral", () => {
  const state = createRuntimeState();
  startRun(state, 0);
  const line = renderFooter(data, state, 160, 20_000, theme);
  assert.ok(line.includes("\x1b[34m◐ working\x1b[0m"));
  assert.ok(line.includes("\x1b[31mctx 97%\x1b[0m"));
  assert.ok(line.includes("\x1b[90mgpt-test\x1b[0m"));
  assert.ok(line.includes("\x1b[90m · 20s\x1b[0m"));
});

test("status protocol sanitizes, bounds, replaces, removes and sorts contributions", () => {
  const registry = new Map();
  assert.equal(applyFooterStatus(registry, { version: 1, id: "bad/id", active: true, label: "bad" }), false);
  assert.equal(applyFooterStatus(registry, { version: 2, id: "future", active: true, label: "bad" }), false);
  assert.equal(applyFooterStatus(registry, { version: 1, id: "ntfy", active: true, label: "\x1b[31mntfy\nstrong".repeat(8), tone: "warning", priority: 999 }), true);
  assert.equal(applyFooterStatus(registry, { version: 1, id: "relay-search", active: true, label: "web", tone: "accent", priority: 80 }), true);
  const statuses = orderedFooterStatuses(registry);
  assert.equal(statuses[0].id, "ntfy");
  assert.equal(statuses[0].priority, 100);
  assert.ok(visibleWidth(statuses[0].label) <= 18);
  assert.doesNotMatch(statuses[0].label, /\x1b|\n/);
  assert.equal(applyFooterStatus(registry, { version: 1, id: "ntfy", active: false }), true);
  assert.equal(registry.has("ntfy"), false);
  for (let i = 0; i < MAX_FOOTER_STATUSES + 2; i++)
    applyFooterStatus(registry, { version: 1, id: `item-${i}`, active: true, label: `item${i}` });
  assert.equal(registry.size, MAX_FOOTER_STATUSES);
});

test("footer shows enabled contributions before model and omits whole fields when narrow", () => {
  const statuses: any[] = [
    { version: 1, id: "relay-search", active: true, label: "web", tone: "accent", priority: 80 },
    { version: 1, id: "ntfy", active: true, label: "ntfy strong", tone: "warning", priority: 70 },
  ];
  const wide = renderFooter({ ...data, statuses }, createRuntimeState(), 180, 0, theme);
  const plain = stripTerminalSequences(wide);
  assert.ok(plain.includes("ctx 97% · web · ntfy strong · gpt-test"));
  assert.ok(wide.includes("\x1b[34mweb\x1b[0m"));
  assert.ok(wide.includes("\x1b[33mntfy strong\x1b[0m"));
  const narrow = stripTerminalSequences(renderFooter({ ...data, statuses }, createRuntimeState(), 30, 0, theme));
  assert.ok(narrow.includes("ctx 97%"));
  assert.ok(!narrow.includes("ntfy strong"));
});

test("context thresholds, missing usage and complete-field omission", () => {
  for (const [percent, color] of [[79, 90], [80, 33], [95, 31]]) {
    assert.ok(renderFooter({ ...data, contextPercent: percent }, createRuntimeState(), 180, 0, theme).includes(`\x1b[${color}mctx ${percent}%`));
  }
  const short = stripTerminalSequences(renderFooter(data, createRuntimeState(), 30, 0, theme));
  assert.ok(short.includes("ctx 97%"));
  assert.ok(!short.includes("E:"));
  assert.ok(!renderFooter({ ...data, contextPercent: NaN }, createRuntimeState(), 180, 0, theme).includes("ctx"));
});
