import assert from "node:assert/strict";
import test from "node:test";

import { oscProgress, shouldNotify } from "../../extensions/auren-ui/terminal.ts";

test("OSC 9;4 progress sequences use Windows Terminal state codes", () => {
  assert.equal(oscProgress("clear"), "\x1b]9;4;0;0\x07");
  assert.equal(oscProgress("normal", 42.4), "\x1b]9;4;1;42\x07");
  assert.equal(oscProgress("error", 100), "\x1b]9;4;2;100\x07");
  assert.equal(oscProgress("indeterminate"), "\x1b]9;4;3;0\x07");
  assert.equal(oscProgress("paused", 200), "\x1b]9;4;4;100\x07");
});

test("completion notification respects threshold while errors notify immediately", () => {
  assert.equal(shouldNotify(14_999, 15_000, false), false);
  assert.equal(shouldNotify(15_000, 15_000, false), true);
  assert.equal(shouldNotify(1_000, 15_000, true), true);
});
