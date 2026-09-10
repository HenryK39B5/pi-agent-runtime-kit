import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const theme = JSON.parse(readFileSync(new URL("../../themes/auren-dark.json", import.meta.url), "utf8"));
function color(token: string): string {
  const value = theme.colors[token];
  return theme.vars[value] ?? value;
}
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(index => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("reading text retains contrast on representative dark surfaces", () => {
  // These backgrounds are test samples, not a claim about the user's terminal canvas.
  for (const background of ["#000000", "#1b1d21", "#242a33"]) {
    for (const token of ["text", "mdHeading", "mdCode", "mdQuote", "mdListBullet"]) {
      const ratio = (luminance(color(token)) + 0.05) / (luminance(background) + 0.05);
      assert.ok(ratio >= 4.5, `${token} on ${background}: ${ratio.toFixed(2)}`);
    }
  }
});

test("structural accents remain lower luminance than their associated text", () => {
  assert.ok(luminance(color("mdQuoteBorder")) < luminance(color("mdQuote")));
  assert.ok(luminance(color("mdListBullet")) < luminance(color("text")));
  assert.ok(luminance(color("mdHr")) < luminance(color("mdQuoteBorder")));
});
