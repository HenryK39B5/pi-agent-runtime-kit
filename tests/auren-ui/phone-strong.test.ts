import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import "./installed-tui.ts";
const { registerPhoneNotify } = await import("../../extensions/auren-ui/phone.ts");

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test("strong mode six slots, transitions, stop, new task, failure and timeout", async t => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  const dir = mkdtempSync(resolve(".tmp-phone-strong-"));
  const old = process.env.PI_NTFY_CONFIG;
  const oldState = process.env.PI_AUREN_UI_STATE;
  process.env.PI_AUREN_UI_STATE = resolve(dir, "state.json");
  process.env.PI_NTFY_CONFIG = resolve(dir, "config.json");
  writeFileSync(process.env.PI_NTFY_CONFIG, JSON.stringify({ server: "https://ntfy.sh", topic: "test-fixture-topic-only" }));
  const handlers = new Map<string, Function>();
  let command: any;
  const requests: any[] = [];
  const notices: string[] = [];
  let responseMode: "ok" | "fail" | "slow" = "ok";
  let finish: ((r: Response) => void) | undefined;
  const transport = ((_url: string, options: any) => {
    requests.push(options);
    if (responseMode !== "slow") return Promise.resolve(new Response(null, { status: responseMode === "ok" ? 200 : 429 }));
    return new Promise<Response>((resolve, reject) => {
      finish = resolve;
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  }) as typeof fetch;
  const ctx: any = { ui: { notify: (s: string) => notices.push(s) } };
  const pi: any = { events: { on() {}, emit() {} }, on: (e: string, h: Function) => handlers.set(e, h), registerCommand: (_: string, c: any) => { command = c; }, getSessionName: () => "Fixture" };
  const phone = registerPhoneNotify(pi, transport);
  const run = (action: string) => command.handler(action, ctx);
  const tick = async (ms: number) => { t.mock.timers.tick(ms); await flush(); };
  try {
    handlers.get("session_start")!();
    await run("strong");
    await run("test");
    assert.equal(requests.length, 1);
    await tick(4999); assert.equal(requests.length, 1);
    await tick(1); assert.equal(requests.length, 2);
    await run("strong"); // Same mode does not stop active reminders.
    for (let i = 0; i < 4; i++) await tick(5000);
    assert.equal(requests.length, 6);
    await tick(60000); assert.equal(requests.length, 6);
    requests.forEach((r, i) => {
      const body = JSON.parse(r.body);
      assert.equal(body.priority, 5);
      assert.ok(body.message.endsWith(`提醒 ${i + 1}/6`));
    });
    for (const from of ["off", "on", "strong"]) {
      for (const to of ["off", "on", "strong"]) {
        await run(from); await run(to);
        await run("status");
        assert.ok(notices.at(-1)?.includes({ off: "关闭", on: "正常模式", strong: "强提醒模式" }[to]!));
      }
    }
    await run("strong"); await run("test");
    const count = requests.length;
    await run("on"); await tick(30000);
    assert.equal(requests.length, count);
    await run("strong"); await run("test"); await run("stop");
    const stopped = requests.length;
    await tick(30000); assert.equal(requests.length, stopped);
    await run("status"); assert.ok(notices.at(-1)?.includes("强提醒模式"));
    await run("test"); handlers.get("agent_start")!();
    const interrupted = requests.length;
    await tick(30000); assert.equal(requests.length, interrupted);
    responseMode = "fail";
    await run("test"); const failed = requests.length;
    await tick(30000); assert.equal(requests.length, failed);
    assert.ok(notices.at(-1)?.includes("429"));
    responseMode = "slow";
    const trial = run("test");
    const slowCount = requests.length;
    await tick(5000); assert.equal(requests.length, slowCount);
    finish!(new Response(null, { status: 200 })); await trial;
    await tick(5000); assert.equal(requests.length, slowCount + 1);
    await tick(8000); assert.equal(requests.at(-1).signal.aborted, true);
    const timedOut = requests.length;
    await tick(30000); assert.equal(requests.length, timedOut);
    responseMode = "ok";
    await run("test"); handlers.get("session_shutdown")!();
    const exited = requests.length;
    await tick(30000); assert.equal(requests.length, exited);
    handlers.get("session_start")!(); phone.settled(ctx, 90000, false);
    assert.equal(requests.length, exited + 1, "saved strong mode should survive session restart");
  } finally {
    handlers.get("session_shutdown")!();
    if (old === undefined) delete process.env.PI_NTFY_CONFIG;
    else process.env.PI_NTFY_CONFIG = old;
    if (oldState === undefined) delete process.env.PI_AUREN_UI_STATE;
    else process.env.PI_AUREN_UI_STATE = oldState;
    rmSync(dir, { recursive: true });
  }
});
