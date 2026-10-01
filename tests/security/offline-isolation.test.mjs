import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const bootstrap = pathToFileURL(resolve("tests/offline-bootstrap.mjs")).href;
test("offline bootstrap replaces inherited private paths and persists only disabled synthetic preferences", () => {
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { readFileSync } from "node:fs";
    process.env.PI_NTFY_CONFIG = "PRIVATE_ROUTE_MUST_NOT_BE_READ";
    process.env.PI_AUREN_UI_STATE = "PRIVATE_STATE_MUST_NOT_BE_READ";
    await import(${JSON.stringify(bootstrap)});
    for (const key of ["PI_NTFY_CONFIG", "PI_AUREN_UI_STATE", "PI_OPENAI_WEB_SEARCH_STATE", "PI_KIRO_WEB_SEARCH_STATE", "PI_CODING_AGENT_DIR"])
      assert(process.env[key].replaceAll("\\\\", "/").includes("/.tmp/offline-tests/"));
    assert.equal(JSON.parse(readFileSync(process.env.PI_AUREN_UI_STATE, "utf8")).ntfyMode, "off");
    assert.equal(JSON.parse(readFileSync(process.env.PI_OPENAI_WEB_SEARCH_STATE, "utf8")).enabled, false);
    console.log("ISOLATED");
  `], { encoding: "utf8", shell: false });
  assert.equal(child.status, 0, child.stderr); assert(child.stdout.includes("ISOLATED"));
});
for (const kind of ["fetch", "http", "https", "net", "tls"])
  test(`offline bootstrap blocks ${kind}; even swallowed failures make the subprocess fail`, () => {
    const code = kind === "fetch" ? 'try { await fetch("https://public-fixture.invalid"); } catch {}' :
      `const module = await import("node:${kind}"); try { module.${kind === "http" || kind === "https" ? "get" : "connect"}(${kind === "http" || kind === "https" ? '"https://public-fixture.invalid"' : '{host:"public-fixture.invalid",port:443}'}); } catch {}`;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(bootstrap)}); ${code}`], { encoding: "utf8", shell: false });
    assert.equal(child.status, 1, child.stderr);
  });
