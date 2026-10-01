// Import before extension code. This isolates personal configuration and makes accidental I/O fail closed.
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";

const marker = Symbol.for("runtime-kit.offline-tests.v1");
if (!globalThis[marker]) {
  const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const root = resolve(repository, ".tmp", "offline-tests", `${process.pid}-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  for (const [key, file] of Object.entries({
    PI_NTFY_CONFIG: "no-notification-route.json", PI_AUREN_UI_STATE: "auren.json",
    PI_OPENAI_WEB_SEARCH_STATE: "openai.json", PI_KIRO_WEB_SEARCH_STATE: "kiro.json",
  })) process.env[key] = resolve(root, file);
  process.env.PI_OFFLINE = "1";
  process.env.PI_SKIP_VERSION_CHECK = "1";
  process.env.PI_TELEMETRY = "0";
  process.env.PI_CODING_AGENT_DIR = resolve(root, "agent");
  process.env.PI_CODING_AGENT_SESSION_DIR = resolve(root, "sessions");
  for (const key of ["PI_SESSION_ID", "PI_SESSION_FILE", "PI_PROVIDER", "PI_MODEL", "PI_REASONING_LEVEL"]) delete process.env[key];
  mkdirSync(process.env.PI_CODING_AGENT_DIR, { recursive: true });
  writeFileSync(process.env.PI_AUREN_UI_STATE, JSON.stringify({ version: 1, ntfyMode: "off" }));
  for (const key of ["PI_OPENAI_WEB_SEARCH_STATE", "PI_KIRO_WEB_SEARCH_STATE"])
    writeFileSync(process.env[key], JSON.stringify({ version: 1, enabled: false }));
  const deny = () => {
    // Do not print URLs, headers or arguments. A swallowed transport error must still fail the process.
    process.exitCode = 1;
    throw new Error("Offline tests blocked a real network attempt; inject a synthetic transport.");
  };
  globalThis.fetch = async () => deny();
  http.request = http.get = https.request = https.get = deny;
  net.connect = net.createConnection = tls.connect = deny;
  net.Socket.prototype.connect = deny;
  syncBuiltinESMExports();
  globalThis[marker] = Object.freeze({ root });
}
