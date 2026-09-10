import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { formatDuration } from "./runtime.ts";
import { FOOTER_STATUS_CHANNEL, FOOTER_STATUS_REQUEST_CHANNEL } from "./footer-status.ts";
import { loadAurenPreference, saveAurenPreference, type NtfyMode } from "./preferences.ts";

export interface PhoneConfig { server: string; topic: string; minDurationMs: number; }
export function parsePhoneConfig(value: unknown): PhoneConfig {
  if (!value || typeof value !== "object") throw new Error("Invalid config");
  const raw = value as Record<string, unknown>;
  const url = new URL(String(raw.server));
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Invalid server");
  if (typeof raw.topic !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(raw.topic)) throw new Error("Invalid topic");
  const threshold = raw.minDurationMs ?? 60_000;
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < 0) throw new Error("Invalid threshold");
  return { server: url.origin, topic: raw.topic, minDurationMs: threshold };
}
export function phoneMessage(session: string | undefined, duration: number, test = false) {
  const name = Array.from((session ?? "").replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, " ").trim() || "未命名会话");
  return {
    title: `Pi · ${name.slice(0, 48).join("")}${name.length > 48 ? "…" : ""}`,
    message: `本轮已结束 · 耗时 ${formatDuration(duration)}${test ? "（模拟测试）" : ""}`,
  };
}

const LABELS: Record<NtfyMode, string> = { off: "关闭", on: "正常模式", strong: "强提醒模式" };
const INTERVAL_MS = 5_000;
const STRONG_COUNT = 6;

/** One request at a time; six fixed slots and no retry queue. Only the selected mode is persisted. */
export function registerPhoneNotify(pi: ExtensionAPI, transport: typeof fetch = fetch) {
  let config: PhoneConfig | undefined;
  let mode: NtfyMode = "off";
  let last = "尚未发送";
  let pending: AbortController | undefined;
  let repeatTimer: ReturnType<typeof setInterval> | undefined;
  let requestTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let accepted = 0;
  let slots = 0;
  let limit = 0;
  const publishStatus = () => pi.events.emit(FOOTER_STATUS_CHANNEL, {
    version: 1,
    id: "ntfy",
    active: mode !== "off",
    ...(mode !== "off" ? {
      label: mode === "strong" ? "ntfy strong" : "ntfy",
      tone: mode === "strong" ? "warning" : "accent",
      priority: 70,
    } : {}),
  });
  pi.events.on(FOOTER_STATUS_REQUEST_CHANNEL, publishStatus);
  const clearRepeat = () => {
    if (repeatTimer !== undefined) clearInterval(repeatTimer);
    repeatTimer = undefined;
  };
  const cancel = () => {
    generation++;
    clearRepeat();
    if (requestTimer !== undefined) clearTimeout(requestTimer);
    requestTimer = undefined;
    pending?.abort();
    // Keep pending until its promise settles, preventing overlapping transports.
  };
  const reset = () => {
    cancel();
    mode = "off";
    config = undefined;
    accepted = slots = limit = 0;
    last = "尚未发送";
  };
  const start = async (ctx: ExtensionContext, duration: number, test: boolean) => {
    if (!config || pending || repeatTimer !== undefined) return;
    const route = config;
    const current = ++generation;
    const strong = mode === "strong";
    const content = phoneMessage(pi.getSessionName(), duration, test);
    accepted = slots = 0;
    limit = strong ? STRONG_COUNT : 1;
    const sendSlot = async () => {
      if (current !== generation || slots >= limit) return;
      const slot = ++slots;
      if (slot >= limit) clearRepeat();
      if (pending) { last = `第 ${slot}/${limit} 个发送时点已跳过（请求仍在途）`; return; }
      const controller = new AbortController();
      pending = controller;
      last = "发送中";
      const timeout = setTimeout(() => controller.abort(), 8_000);
      requestTimer = timeout;
      try {
        const response = await transport(`${route.server}/`, {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: route.topic, ...content,
            message: content.message + (strong ? ` · 提醒 ${slot}/${limit}` : ""),
            ...(strong ? { priority: 5 } : {}),
          }),
        });
        await response.body?.cancel();
        if (current !== generation) return;
        if (response.ok) {
          accepted++;
          last = "服务已接受（手机送达未确认）";
          if (test && slot === 1) ctx.ui.notify(`ntfy：${last}`, "info");
        } else {
          clearRepeat();
          last = `发送失败：HTTP ${response.status}；本组已停止`;
          ctx.ui.notify(`ntfy：${last}`, "warning");
        }
      } catch {
        if (current === generation) {
          clearRepeat();
          last = "发送失败或超时；本组已停止";
          ctx.ui.notify(`ntfy：${last}；本轮工作不受影响。`, "warning");
        }
      } finally {
        clearTimeout(timeout);
        if (requestTimer === timeout) requestTimer = undefined;
        if (pending === controller) pending = undefined;
      }
    };
    if (strong) repeatTimer = setInterval(() => { void sendSlot(); }, INTERVAL_MS);
    await sendSlot();
  };
  pi.on("session_start", (_event, ctx) => {
    reset();
    try {
      const path = process.env.PI_NTFY_CONFIG || join(homedir(), ".pi", "agent", "ntfy.json");
      config = parsePhoneConfig(JSON.parse(readFileSync(path, "utf8")));
    } catch { last = "未配置或配置无效"; }
    const saved = loadAurenPreference();
    if (saved.warning) ctx.ui.notify(saved.warning, "warning");
    if (config) mode = saved.ntfyMode;
    else if (saved.ntfyMode !== "off") last = "未配置或配置无效；已保存模式本次未启用";
    publishStatus();
  });
  pi.on("session_shutdown", () => { reset(); publishStatus(); });
  pi.on("agent_start", () => {
    if (pending || repeatTimer !== undefined) {
      cancel();
      last = "新任务已开始；上一轮提醒已停止";
    }
  });
  pi.registerCommand("ntfy", {
    description: "手机通知：off | on | strong | stop | status | test；默认关闭",
    getArgumentCompletions: prefix => {
      const items = ["off", "on", "strong", "stop", "status", "test"].filter(s => s.startsWith(prefix)).map(value => ({ value, label: value }));
      return items.length ? items : null;
    },
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase();
      if (action === "off" || action === "on" || action === "strong") {
        if (action !== "off" && !config) {
          ctx.ui.notify("ntfy：请配置 PI_NTFY_CONFIG 或 ~/.pi/agent/ntfy.json，再 /reload。", "warning"); return;
        }
        if (mode !== action) {
          cancel();
          mode = action;
          last = "模式已切换；旧提醒已取消，已送出的消息无法撤回";
          publishStatus();
        }
        const saveWarning = saveAurenPreference(action);
        if (saveWarning) ctx.ui.notify(saveWarning, "warning");
      } else if (action === "stop") {
        cancel();
        last = "当前提醒已停止；模式保留";
      } else if (action === "test") {
        if (!config) { ctx.ui.notify("ntfy：未配置或配置无效。", "warning"); return; }
        if (pending || repeatTimer !== undefined) { ctx.ui.notify("ntfy：已有提醒进行中，请稍后或 /ntfy stop。", "info"); return; }
        await start(ctx, 65_000, true);
        return;
      } else if (action && action !== "status") {
        ctx.ui.notify("用法：/ntfy off|on|strong|stop|status|test", "warning"); return;
      }
      ctx.ui.notify(`ntfy：${LABELS[mode]} · 阈值 ${formatDuration(config?.minDurationMs ?? 60_000)}${mode === "strong" ? " · 间隔 5s · 最多 6 条" : ""}\n最近一组：服务接受 ${accepted}/${limit} · ${repeatTimer !== undefined || pending ? "进行中" : "无待发提醒"}\n${last}`, "info");
    },
  });
  return {
    settled(ctx: ExtensionContext, duration: number, error: boolean) {
      if (mode === "off" || !config || (!error && duration < config.minDurationMs)) return;
      if (pending || repeatTimer !== undefined) { last = "上一组仍在发送，本轮已跳过"; return; }
      void start(ctx, duration, false);
    },
  };
}
