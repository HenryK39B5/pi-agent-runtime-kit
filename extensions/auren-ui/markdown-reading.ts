import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Display-only adaptation for word-adjacent punctuation in generated strong spans.
// Deliberately not a general Markdown parser or a repair of incomplete/invalid input.
const word = /[\p{L}\p{N}]/u;
const punctuation = /[\p{P}\p{S}]/u;
const forbiddenContent = /[\\`*_\[\]<>\r\n]/;
function escaped(text: string, at: number): boolean {
  let count = 0;
  while (at > 0 && text[--at] === "\\") count++;
  return count % 2 === 1;
}
export function normalizeReadingMarkdown(text: string): string {
  if (!text.includes("**") || text.length > 128 * 1024) return text;
  let fence: { character: string; length: number } | undefined;
  let inlineTicks: string | undefined;
  return text.split(/(\r?\n)/).map(line => {
    if (/^\r?\n$/.test(line)) return line;
    const opening = /^(?: {0,3}> ?)*(?: {0,3}(?:[-+*]|\d{1,9}[.)]) +)? {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const closing = /^(?: {0,3}> ?)* {0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) fence = undefined;
      return line;
    }
    if (!inlineTicks && opening) { fence = { character: opening[1][0], length: opening[1].length }; return line; }
    // Be conservative around indented code, definitions, HTML blocks and huge lines.
    if (!inlineTicks && (/^(?: {4}|\t)|^\s*\[[^\]]+\]:|^\s*</.test(line) || line.length > 8192)) return line;
    let output = "", i = 0;
    while (i < line.length) {
      if (inlineTicks) {
        const end = line.indexOf(inlineTicks, i);
        if (end < 0) { output += line.slice(i); break; }
        // Exact delimiter run only; a longer run is part of code content.
        let runEnd = end;
        while (line[runEnd] === "`") runEnd++;
        output += line.slice(i, runEnd); i = runEnd;
        if (runEnd - end === inlineTicks.length) inlineTicks = undefined;
        continue;
      }
      if (line[i] === "\\") { output += line.slice(i, i + 2); i += 2; continue; }
      if (line[i] === "`") {
        let end = i; while (line[end] === "`") end++;
        inlineTicks = line.slice(i, end); output += inlineTicks; i = end; continue;
      }
      // Preserve link destinations, including balanced URL parentheses and titles.
      if (line[i] === "]" && line[i + 1] === "(") {
        let end = i + 2, depth = 1;
        while (end < line.length && depth) {
          if (line[end] === "\\") { end += 2; continue; }
          if (line[end] === "(") depth++;
          if (line[end] === ")") depth--;
          end++;
        }
        output += line.slice(i, end); i = end; continue;
      }
      if (line[i] === "<") {
        const end = line.indexOf(">", i + 1);
        if (end >= 0) { output += line.slice(i, end + 1); i = end + 1; continue; }
      }
      const scheme = line.slice(i, i + 8).toLowerCase();
      if (scheme.startsWith("https://") || scheme.startsWith("http://")) {
        let end = i; while (end < line.length && !/[\s<>]/.test(line[end])) end++;
        output += line.slice(i, end); i = end; continue;
      }
      if (line[i] === "*" && line[i + 1] === "*") {
        let runEnd = i; while (line[runEnd] === "*") runEnd++;
        if (runEnd - i !== 2) { output += line.slice(i, runEnd); i = runEnd; continue; }
        let end = line.indexOf("**", i + 2);
        while (end >= 0 && escaped(line, end)) end = line.indexOf("**", end + 2);
        if (end >= 0 && line[end + 2] !== "*") {
          const content = line.slice(i + 2, end);
          if (content.length > 0 && content.length <= 512 && !forbiddenContent.test(content) && content.trim() === content) {
            const first = String.fromCodePoint(content.codePointAt(0)!);
            const last = Array.from(content).at(-1)!;
            const previous = Array.from(line.slice(Math.max(0, i - 2), i)).at(-1) ?? "";
            const next = String.fromCodePoint(line.codePointAt(end + 2) ?? 0);
            const before = word.test(previous) && punctuation.test(first) ? " " : "";
            const after = punctuation.test(last) && word.test(next) ? " " : "";
            output += before + line.slice(i, end + 2) + after; i = end + 2; continue;
          }
        }
      }
      output += line[i++];
    }
    return output;
  }).join("");
}
export function registerReadingMarkdown(pi: ExtensionAPI): void {
  pi.registerMarkdownTransformer((text, context) =>
    context.messageType === "assistant" ? normalizeReadingMarkdown(text) : text);
}
