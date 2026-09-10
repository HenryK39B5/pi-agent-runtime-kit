import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface RelaySearchPreference { enabled: boolean; warning?: string; }

export function relaySearchStatePath(): string {
  return process.env.PI_RELAY_SEARCH_STATE || join(homedir(), ".pi", "agent", "state", "relay-search.json");
}

export function loadRelaySearchPreference(path = relaySearchStatePath()): RelaySearchPreference {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid document");
    const state = value as Record<string, unknown>;
    if (state.version !== 1 || typeof state.enabled !== "boolean") throw new Error("unsupported state");
    return { enabled: state.enabled };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { enabled: false };
    return { enabled: false, warning: "Saved Relay Search state is invalid or unreadable; using off." };
  }
}

export function saveRelaySearchPreference(enabled: boolean, path = relaySearchStatePath()): string | undefined {
  const temporary = `${path}.tmp-${process.pid}`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporary, `${JSON.stringify({ version: 1, enabled })}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, path);
    return undefined;
  } catch {
    return "Current Relay Search mode changed, but its saved preference could not be updated.";
  } finally {
    try { rmSync(temporary, { force: true }); } catch { /* best-effort temp cleanup */ }
  }
}
