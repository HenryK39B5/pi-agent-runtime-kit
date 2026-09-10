import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collect(path) : entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const files = collect(resolve("tests"));
if (!files.length) throw new Error("No tests found");
const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...files], {
  stdio: "inherit",
  env: {
    ...process.env,
    PI_TEST_PACKAGE_ROOT: process.env.PI_TEST_PACKAGE_ROOT ?? resolve("node_modules", "@earendil-works", "pi-coding-agent"),
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
