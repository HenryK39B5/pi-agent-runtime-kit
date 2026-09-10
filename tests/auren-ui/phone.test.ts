import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import "./installed-tui.ts";
const { parsePhoneConfig, phoneMessage, registerPhoneNotify } = await import("../../extensions/auren-ui/phone.ts");

test("phone configuration rejects unsafe endpoints and invalid thresholds", () => {
  const base = { server: "https://ntfy.sh", topic: "test-fixture-topic-only" };
  assert.equal(parsePhoneConfig(base).minDurationMs, 60000);
  for (const server of ["http://ntfy.sh", "https://user:pass@ntfy.sh", "https://ntfy.sh/path", "https://ntfy.sh/?secret=x"])
    assert.throws(() => parsePhoneConfig({ ...base, server }));
  for (const minDurationMs of [-1, Infinity, "60"])
    assert.throws(() => parsePhoneConfig({ ...base, minDurationMs }));
  assert.throws(() => parsePhoneConfig({ ...base, topic: "a/b" }));
});

test("phone messages use short session labels and neutral wording", () => {
  assert.deepEqual(phoneMessage(undefined, 65000), { title: "Pi · 未命名会话", message: "本轮已结束 · 耗时 1m 5s" });
  assert.equal(phoneMessage("x\ny", 0).title, "Pi · x y");
  assert.ok(phoneMessage("中".repeat(100), 0).title.endsWith("…"));
});

test("saved enabled mode remains inactive when ntfy routing is unavailable", async () => {
  const dir = mkdtempSync(resolve(".tmp-phone-missing-config-"));
  const oldConfig = process.env.PI_NTFY_CONFIG;
  const oldState = process.env.PI_AUREN_UI_STATE;
  process.env.PI_NTFY_CONFIG = resolve(dir, "missing.json");
  process.env.PI_AUREN_UI_STATE = resolve(dir, "state.json");
  writeFileSync(process.env.PI_AUREN_UI_STATE, JSON.stringify({ version: 1, ntfyMode: "on" }));
  try {
    const handlers = new Map<string, Function>();
    let command: any;
    let requests = 0;
    const notices: string[] = [];
    const api: any = {
      events: { on() {}, emit() {} }, getSessionName: () => "Fixture",
      on: (event: string, fn: Function) => handlers.set(event, fn),
      registerCommand: (_name: string, value: any) => { command = value; },
    };
    const phone = registerPhoneNotify(api, (async () => { requests++; return new Response(); }) as typeof fetch);
    const ctx: any = { ui: { notify: (text: string) => notices.push(text) } };
    handlers.get("session_start")!({}, ctx);
    phone.settled(ctx, 90_000, false);
    await command.handler("status", ctx);
    assert.equal(requests, 0);
    assert.ok(notices.at(-1)?.includes("关闭"));
    assert.ok(notices.at(-1)?.includes("已保存模式本次未启用"));
  } finally {
    if (oldConfig === undefined) delete process.env.PI_NTFY_CONFIG; else process.env.PI_NTFY_CONFIG = oldConfig;
    if (oldState === undefined) delete process.env.PI_AUREN_UI_STATE; else process.env.PI_AUREN_UI_STATE = oldState;
    rmSync(dir, { recursive: true });
  }
});

test("opt-in, threshold, busy limit, errors, test command and cancellation", async () => {
  const dir = mkdtempSync(resolve(".tmp-phone-test-"));
  const old = process.env.PI_NTFY_CONFIG;
  const oldState = process.env.PI_AUREN_UI_STATE;
  process.env.PI_AUREN_UI_STATE = resolve(dir, "state.json");
  const path = resolve(dir, "config.json");
  writeFileSync(path, JSON.stringify({ server: "https://ntfy.sh", topic: "test-fixture-topic-only" }));
  process.env.PI_NTFY_CONFIG = path;
  try {
    const handlers = new Map<string, Function>();
    let command: any;
    const requests: any[] = [];
    let finish: ((r: Response) => void) | undefined;
    const transport = ((_url: string, options: any) => {
      requests.push(options);
      return new Promise<Response>((resolve, reject) => {
        finish = resolve;
        options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    }) as typeof fetch;
    const notices: string[] = [];
    const ctx: any = { ui: { notify: (s: string) => notices.push(s) } };
    const api: any = { events: { on() {}, emit() {} }, on: (e: string, h: Function) => handlers.set(e, h), registerCommand: (_: string, c: any) => { command = c; }, getSessionName: () => "Fixture" };
    const phone = registerPhoneNotify(api, transport);
    handlers.get("session_start")!();
    phone.settled(ctx, 90000, false);
    assert.equal(requests.length, 0);
    await command.handler("on", ctx);
    phone.settled(ctx, 59000, false);
    assert.equal(requests.length, 0);
    phone.settled(ctx, 60000, false);
    phone.settled(ctx, 60000, false);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].redirect, "error");
    assert.equal(JSON.parse(requests[0].body).title, "Pi · Fixture");
    finish!(new Response(null, { status: 200 }));
    await new Promise(resolve => setImmediate(resolve));
    phone.settled(ctx, 100, true);
    assert.equal(requests.length, 2);
    await command.handler("off", ctx);
    assert.equal(requests[1].signal.aborted, true);
    await new Promise(resolve => setImmediate(resolve));
    const trial = command.handler("test", ctx);
    assert.equal(requests.length, 3);
    finish!(new Response(null, { status: 503 }));
    await trial;
    assert.ok(notices.at(-1)?.includes("503"));
    await command.handler("on", ctx);
    phone.settled(ctx, 90000, false);
    handlers.get("session_shutdown")!();
    assert.equal(requests.at(-1).signal.aborted, true);
    await new Promise(resolve => setImmediate(resolve));
    handlers.get("session_start")!();
    phone.settled(ctx, 90000, false);
    assert.equal(requests.length, 5, "saved on mode should survive session restart");
  } finally {
    if (old === undefined) delete process.env.PI_NTFY_CONFIG;
    else process.env.PI_NTFY_CONFIG = old;
    if (oldState === undefined) delete process.env.PI_AUREN_UI_STATE;
    else process.env.PI_AUREN_UI_STATE = oldState;
    rmSync(dir, { recursive: true });
  }
});
