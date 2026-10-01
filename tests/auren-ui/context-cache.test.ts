import assert from "node:assert/strict";
import test from "node:test";
import { createContextCache } from "../../extensions/auren-ui/context-cache.ts";

test("Context cache avoids repeated projection reads, including unknown percentages", () => {
  const cache = createContextCache();
  let reads = 0;
  const ctx = { model: { provider: "fixture", id: "model", contextWindow: 1000 },
    sessionManager: { getLeafId: () => "first" }, getContextUsage: () => { reads++; return undefined; } };
  for (let i = 0; i < 100; i++) assert.equal(cache.read(ctx), undefined);
  assert.equal(reads, 1);
  cache.invalidate(); cache.read(ctx); assert.equal(reads, 2);
});
test("Context cache observes finalized leaf after an early message_end render and model/window changes", () => {
  const cache = createContextCache();
  let reads = 0, leaf = "old", percent = 10;
  const ctx = { model: { provider: "fixture", id: "model", contextWindow: 1000 },
    sessionManager: { getLeafId: () => leaf }, getContextUsage: () => { reads++; return { percent }; } };
  assert.equal(cache.read(ctx), 10);
  cache.invalidate(); assert.equal(cache.read(ctx), 10); // Before persistence.
  leaf = "new"; percent = 20; assert.equal(cache.read(ctx), 20);
  ctx.model.contextWindow = 2000; cache.read(ctx);
  ctx.model.id = "other"; cache.read(ctx);
  cache.clear(); cache.read(ctx);
  assert.equal(reads, 6);
});
