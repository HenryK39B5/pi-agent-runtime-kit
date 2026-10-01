import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadOpenAIWebSearchPreference, saveOpenAIWebSearchPreference } from "../../extensions/openai-web-search/state.ts";

function fixture() {
  mkdirSync(resolve(".tmp"), { recursive: true });
  const dir = mkdtempSync(resolve(".tmp/relay-preference-"));
  return { dir, path: resolve(dir, "state.json") };
}

test("OpenAI Web Search preference is versioned, persistent and fail-safe", () => {
  const f = fixture();
  try {
    assert.deepEqual(loadOpenAIWebSearchPreference(f.path), { enabled: false });
    assert.equal(saveOpenAIWebSearchPreference(true, f.path), undefined);
    assert.deepEqual(JSON.parse(readFileSync(f.path, "utf8")), { version: 1, enabled: true });
    assert.deepEqual(loadOpenAIWebSearchPreference(f.path), { enabled: true });
    for (const value of ["bad", {}, { version: 2, enabled: true }, { version: 1, enabled: "yes" }]) {
      writeFileSync(f.path, JSON.stringify(value));
      const loaded = loadOpenAIWebSearchPreference(f.path);
      assert.equal(loaded.enabled, false);
      assert.ok(loaded.warning);
    }
  } finally { rmSync(f.dir, { recursive: true }); }
});

test("OpenAI Web Search preference save failure leaves no adjacent temp file", () => {
  const f = fixture();
  try {
    writeFileSync(f.path, "blocks-directory-creation");
    const impossible = resolve(f.path, "child.json");
    assert.ok(saveOpenAIWebSearchPreference(true, impossible));
    assert.deepEqual(loadOpenAIWebSearchPreference(impossible).enabled, false);
  } finally { rmSync(f.dir, { recursive: true }); }
});
