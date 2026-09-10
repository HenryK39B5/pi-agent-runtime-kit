import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type NtfyMode = "off" | "on" | "strong";
export interface AurenPreference { ntfyMode: NtfyMode; warning?: string; }
const MODES = new Set<NtfyMode>(["off", "on", "strong"]);

export function aurenStatePath(): string {
  return process.env.PI_AUREN_UI_STATE || join(homedir(), ".pi", "agent", "state", "auren-ui.json");
}

export function loadAurenPreference(path = aurenStatePath()): AurenPreference {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid document");
    const state = value as Record<string, unknown>;
    if (state.version !== 1 || typeof state.ntfyMode !== "string" || !MODES.has(state.ntfyMode as NtfyMode))
      throw new Error("unsupported state");
    return { ntfyMode: state.ntfyMode as NtfyMode };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ntfyMode: "off" };
    return { ntfyMode: "off", warning: "Auren saved state is invalid or unreadable; ntfy is off." };
  }
}

export function saveAurenPreference(ntfyMode: NtfyMode, path = aurenStatePath()): string | undefined {
  const temporary = `${path}.tmp-${process.pid}`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporary, `${JSON.stringify({ version: 1, ntfyMode })}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, path);
    return undefined;
  } catch {
    return "当前 ntfy 模式已切换，但保存失败；重启后将使用上次成功保存的模式。";
  } finally {
    try { rmSync(temporary, { force: true }); } catch { /* best-effort temp cleanup */ }
  }
}
