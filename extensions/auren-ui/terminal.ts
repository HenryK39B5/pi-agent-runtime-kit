export type TerminalProgressState = "clear" | "normal" | "error" | "indeterminate" | "paused";

const PROGRESS_CODES: Record<TerminalProgressState, number> = {
  clear: 0,
  normal: 1,
  error: 2,
  indeterminate: 3,
  paused: 4,
};

/** Windows Terminal taskbar progress protocol (OSC 9;4). */
export function oscProgress(state: TerminalProgressState, percent = 0): string {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return `\x1b]9;4;${PROGRESS_CODES[state]};${value}\x07`;
}

export function shouldNotify(durationMs: number, thresholdMs: number, isError: boolean): boolean {
  return isError || durationMs >= Math.max(0, thresholdMs);
}

export function writeTerminalControl(sequence: string): boolean {
  try {
    process.stdout.write(sequence);
    return true;
  } catch {
    return false;
  }
}
