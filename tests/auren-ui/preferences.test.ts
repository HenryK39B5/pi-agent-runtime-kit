import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAurenPreference, saveAurenPreference } from "../../extensions/auren-ui/preferences.ts";

function fixture() {
  mkdirSync(resolve(".tmp"), { recursive: true });
  const dir = mkdtempSync(resolve(".tmp/auren-preference-"));
  return { dir, path: resolve(dir, "state.json") };
}

test("Auren preference is versioned, persistent and fail-safe", () => {
  const f = fixture();
  try {
    assert.deepEqual(loadAurenPreference(f.path), { ntfyMode: "off" });
    assert.equal(saveAurenPreference("strong", f.path), undefined);
    assert.deepEqual(JSON.parse(readFileSync(f.path, "utf8")), { version: 1, ntfyMode: "strong" });
    assert.deepEqual(loadAurenPreference(f.path), { ntfyMode: "strong" });
    for (const value of ["bad", {}, { version: 2, ntfyMode: "on" }, { version: 1, ntfyMode: "loud" }]) {
      writeFileSync(f.path, JSON.stringify(value));
      const loaded = loadAurenPreference(f.path);
      assert.equal(loaded.ntfyMode, "off");
      assert.ok(loaded.warning);
    }
  } finally { rmSync(f.dir, { recursive: true }); }
});

test("Auren preference save failure leaves no adjacent temp file", () => {
  const f = fixture();
  try {
    writeFileSync(f.path, "blocks-directory-creation");
    const impossible = resolve(f.path, "child.json");
    assert.ok(saveAurenPreference("on", impossible));
    assert.deepEqual(loadAurenPreference(impossible).ntfyMode, "off");
  } finally { rmSync(f.dir, { recursive: true }); }
});
