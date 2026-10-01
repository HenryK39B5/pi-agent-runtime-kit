/** Public SDK usage is projection-based, not a constant-time getter. Cache by finalized leaf/model. */
export interface ContextReader {
  model?: { provider: string; id: string; contextWindow: number };
  sessionManager: { getLeafId(): string | null };
  getContextUsage(): { percent: number | null } | undefined;
}
export function createContextCache() {
  let key: string | undefined;
  let dirty = true;
  let percent: number | null | undefined;
  return {
    invalidate() { dirty = true; },
    clear() { key = undefined; percent = undefined; dirty = true; },
    read(ctx: ContextReader): number | null | undefined {
      const next = JSON.stringify([ctx.sessionManager.getLeafId(), ctx.model?.provider, ctx.model?.id, ctx.model?.contextWindow]);
      if (dirty || key !== next) {
        percent = ctx.getContextUsage()?.percent;
        key = next;
        dirty = false;
      }
      return percent;
    },
  };
}
