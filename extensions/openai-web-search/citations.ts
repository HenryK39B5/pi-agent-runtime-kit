import { getMarkdownTheme, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";

export const CITATIONS_ENTRY_TYPE = "openai.web-citations.v1";
export const CITATION_LIMITS = Object.freeze({ responses: 8, sources: 8, annotations: 64, items: 32 });
export interface CitationSource { title: string; url: string; }
export interface CitationEntry { version: 1; assistantEntryId: string; sources: CitationSource[]; missing: boolean; }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const controls = /[\u0000-\u0020\u007f-\u009f\u202a-\u202e\u2066-\u2069<>]/u;
const sensitiveKey = /token|secret|signature|credential|password|api.?key|authorization|x-amz|x-goog|^(?:sig|key|auth|code)$/i;
function sensitiveUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return !!url.username || !!url.password || [...url.searchParams.keys(),
      ...new URLSearchParams(url.hash.slice(1).replace(/^.*?\?/, "")).keys()].some(key => sensitiveKey.test(key));
  } catch { return true; }
}
export function safeCitationUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1024 || Buffer.byteLength(value) > 1024 || controls.test(value) || sensitiveUrl(value) || value.includes("\\")) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.port && url.hostname.includes(".") &&
      !/^[\d.]+$/.test(url.hostname) && !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname) &&
      !/\bsk-[a-z0-9_-]{10,}/i.test(value);
  } catch { return false; }
}
function cleanTitle(value: unknown, url: string): string {
  if (typeof value !== "string" || value.length > 2048) return new URL(url).hostname;
  return Array.from(value.replace(/\bhttps?:\/\/[^\s<>"'`]+/giu, link => sensitiveUrl(link) ? "[REDACTED URL]" : link)
    .replace(/\bsk-[a-z0-9_-]{10,}|\bBearer\s+[a-z0-9_.-]{16,}|\b(?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, " ").trim()).slice(0, 240).join("") || new URL(url).hostname;
}
function responseId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && !controls.test(value) ? value : undefined;
}
interface ResponseSources { completed: boolean; sources: CitationSource[]; }
/** Only bounded URL annotations. Never holds raw events, text, query, thinking or an ID-to-guessed-URL map. */
export class CitationCollector {
  private responses = new Map<string, ResponseSources>();
  private current: string | undefined;
  private itemOwners = new Map<string, string>();
  clear(): void { this.responses.clear(); this.itemOwners.clear(); this.current = undefined; }
  private forget(id: string): void {
    this.responses.delete(id);
    for (const [item, owner] of this.itemOwners) if (owner === id) this.itemOwners.delete(item);
  }
  private ensure(id: string): ResponseSources {
    let value = this.responses.get(id);
    if (!value) {
      if (this.responses.size >= CITATION_LIMITS.responses) this.forget(this.responses.keys().next().value!);
      value = { completed: false, sources: [] }; this.responses.set(id, value);
    }
    return value;
  }
  private items(target: ResponseSources, items: unknown): void {
    if (!Array.isArray(items)) return;
    for (const item of items.slice(0, CITATION_LIMITS.items)) {
      if (!record(item) || item.type !== "message" || item.role !== "assistant" || !Array.isArray(item.content)) continue;
      for (const part of item.content.slice(0, CITATION_LIMITS.items)) {
        if (!record(part) || part.type !== "output_text" || !Array.isArray(part.annotations)) continue;
        for (const annotation of part.annotations.slice(0, CITATION_LIMITS.annotations)) {
          if (!record(annotation) || annotation.type !== "url_citation" || !safeCitationUrl(annotation.url)) continue;
          if (target.sources.length >= CITATION_LIMITS.sources) break;
          if (!target.sources.some(source => source.url === annotation.url))
            target.sources.push({ title: cleanTitle(annotation.title, annotation.url), url: annotation.url });
        }
      }
    }
  }
  observe(value: unknown): void {
    if (!record(value)) return;
    if (value.type === "response.created" && record(value.response)) {
      this.current = responseId(value.response.id);
      if (this.current) { this.forget(this.current); this.ensure(this.current); }
    } else if (value.type === "response.output_item.added" && this.current && record(value.item) &&
        value.item.type === "message" && value.item.role === "assistant") {
      const id = responseId(value.item.id);
      if (id && this.itemOwners.size < CITATION_LIMITS.responses * CITATION_LIMITS.items) this.itemOwners.set(id, this.current);
    } else if (value.type === "response.output_text.annotation.added") {
      const item = responseId(value.item_id), owner = item ? this.itemOwners.get(item) : undefined;
      if (owner) this.items(this.ensure(owner), [{ type: "message", role: "assistant",
        content: [{ type: "output_text", annotations: [value.annotation] }] }]);
    } else if (value.type === "response.output_item.done" && this.current) {
      const id = record(value.item) ? responseId(value.item.id) : undefined;
      const owner = id ? this.itemOwners.get(id) ?? this.current : this.current;
      this.items(this.ensure(owner), [value.item]);
    } else if (value.type === "response.completed" && record(value.response)) {
      const id = responseId(value.response.id);
      if (id && value.response.status === "completed") {
        const target = this.ensure(id); this.items(target, value.response.output); target.completed = true;
      }
    } else if (["response.failed", "response.incomplete"].includes(String(value.type)) && record(value.response)) {
      const id = responseId(value.response.id); if (id) this.forget(id);
    }
  }
  take(id: unknown): CitationSource[] {
    const key = responseId(id); if (!key) return [];
    const value = this.responses.get(key); this.forget(key);
    if (this.current === key) this.current = undefined;
    return value?.completed ? value.sources : [];
  }
}

/** Display-only, exact known marker syntax, outside fenced/inline code. No source IDs are decoded. */
export function readableCitationMarkers(markdown: string): string {
  if (!markdown.includes("\uE200cite\uE202") || markdown.length > 128 * 1024) return markdown;
  let fence: { character: string; length: number } | undefined;
  let ticks: string | undefined;
  return markdown.split("\n").map(line => {
    const match = /^(?: {0,3}> ?)*(?: {0,3}(?:[-+*]|\d{1,9}[.)]) +)? {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (match && !ticks) {
      if (!fence) fence = { character: match[1][0], length: match[1].length };
      else if (match[1][0] === fence.character && match[1].length >= fence.length && !match[2].trim()) fence = undefined;
      return line;
    }
    if (fence || (!ticks && /^(?: {4}|\t)/.test(line))) return line;
    let output = "", start = 0;
    const replace = (text: string) => text.replace(/\uE200cite\uE202[^\uE201\r\n]{1,1024}\uE201/gu, "【网页引用】");
    for (const match of line.matchAll(/`+/g)) {
      const at = match.index!, run = match[0];
      if (ticks) {
        output += line.slice(start, at + run.length);
        if (run === ticks) ticks = undefined;
      } else {
        let preceding = at, slashes = 0;
        while (preceding > 0 && line[--preceding] === "\\") slashes++;
        if (slashes % 2) continue;
        output += replace(line.slice(start, at)) + run; ticks = run;
      }
      start = at + run.length;
    }
    return output + (ticks ? line.slice(start) : replace(line.slice(start)));
  }).join("\n");
}
export function isCitationEntry(value: unknown): value is CitationEntry {
  if (!record(value) || value.version !== 1 || typeof value.assistantEntryId !== "string" || !value.assistantEntryId ||
      typeof value.missing !== "boolean" || !Array.isArray(value.sources) || value.sources.length > CITATION_LIMITS.sources) return false;
  return value.sources.every(source => record(source) && safeCitationUrl(source.url) && typeof source.title === "string" &&
    source.title.length <= 480 && Array.from(source.title).length <= 240 && cleanTitle(source.title, source.url) === source.title);
}
export function citationMarkdown(data: CitationEntry): string {
  const sources = data.sources.map((source, index) => {
    const title = source.title.replace(/[\\\[\]`*_<>]/g, "\\$&");
    return `- [${index + 1}. ${title}](<${source.url}>)`;
  });
  return [data.sources.length ? "来源（服务返回的网页引用，未另行抓取）" : "", ...sources,
    data.missing ? "引用链接未由服务提供或未通过安全检查，无法从内部 cite 标识还原。" : ""].filter(Boolean).join("\n");
}
export function registerCitationDisplay(pi: ExtensionAPI): void {
  pi.registerMarkdownTransformer((markdown, context) => context.messageType === "assistant" ? readableCitationMarkers(markdown) : markdown);
  pi.registerEntryRenderer<CitationEntry>(CITATIONS_ENTRY_TYPE, entry =>
    isCitationEntry(entry.data) ? new Markdown(citationMarkdown(entry.data), 1, 0, getMarkdownTheme()) : undefined);
}
