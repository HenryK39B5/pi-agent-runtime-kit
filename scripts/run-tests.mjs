import { readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? collect(path) : /\.test\.(?:ts|mjs)$/.test(entry.name) ? [path] : [];
  });
}
const files = collect(resolve(root, "tests")).sort();
if (!files.length) throw new Error("No tests found");
const result = spawnSync(process.execPath, ["--experimental-strip-types",
  "--import", "./tests/offline-bootstrap.mjs", "--import", "./tests/auren-ui/installed-tui.ts",
  "--import", "./tests/installed-runtime.ts", "--test", ...files], {
  cwd: root, stdio: "inherit", shell: false,
  env: { ...process.env, PI_TEST_PACKAGE_ROOT: process.env.PI_TEST_PACKAGE_ROOT ?? resolve(root, "node_modules/@earendil-works/pi-coding-agent") },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
