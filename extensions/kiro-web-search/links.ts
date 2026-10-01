const sensitiveKey = /token|secret|signature|credential|password|api.?key|authorization|x-amz|x-goog|^(?:sig|key|auth|code)$/i;
const controls = /[\u0000-\u0020\u007f-\u009f\u202a-\u202e\u2066-\u2069<>]/u;

export function sensitiveUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return !!url.username || !!url.password ||
      [...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1).replace(/^.*?\?/, "")).keys()].some(key => sensitiveKey.test(key));
  } catch { return true; }
}
export function publicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return value.length <= 1024 && Buffer.byteLength(value) <= 1024 && !controls.test(value) && !value.includes("\\") && !sensitiveUrl(value) &&
      ["http:", "https:"].includes(url.protocol) && !url.port && url.hostname.includes(".") &&
      !/^[\d.]+$/.test(url.hostname) && !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname);
  } catch { return false; }
}
export function redactSensitiveUrls(text: string): string {
  return text.replace(/\bhttps?:\/\/[^\s<>"'`]+/giu, value =>
    controls.test(value) || sensitiveUrl(value) ? "[REDACTED URL]" : value);
}
export function sourceMarkdown(source: { title: string; url: string }): string {
  const title = source.title.replace(/[\\\[\]`*_<>]/g, "\\$&") || new URL(source.url).hostname;
  return `- [${title}](<${source.url}>)`;
}
