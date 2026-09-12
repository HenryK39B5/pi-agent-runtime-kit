import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

interface ThemeDocument {
  name: string;
  vars: Record<string, string>;
  colors: Record<string, string>;
}

const themes = ["auren-dark", "auren-forest", "auren-ember", "auren-violet"].map(name => JSON.parse(
  readFileSync(new URL(`../../themes/${name}.json`, import.meta.url), "utf8"),
) as ThemeDocument);

function color(theme: ThemeDocument, token: string): string {
  const value = theme.colors[token];
  return theme.vars[value] ?? value;
}
function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
}
function luminance(hex: string): number {
  const channels = rgb(hex).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("every Auren palette keeps reading text legible on its representative dark surfaces", () => {
  for (const theme of themes) {
    const backgrounds = ["#000000", theme.vars.canvas, theme.vars.userMessageBg];
    for (const background of backgrounds) {
      for (const token of ["text", "mdHeading", "mdCode", "mdQuote", "mdListBullet"]) {
        const ratio = (luminance(color(theme, token)) + 0.05) / (luminance(background) + 0.05);
        assert.ok(ratio >= 4.5, `${theme.name}: ${token} on ${background}: ${ratio.toFixed(2)}`);
      }
    }
  }
});

test("every Auren palette keeps structural accents quieter than associated text", () => {
  for (const theme of themes) {
    assert.ok(luminance(color(theme, "mdQuoteBorder")) < luminance(color(theme, "mdQuote")), theme.name);
    assert.ok(luminance(color(theme, "mdListBullet")) < luminance(color(theme, "text")), theme.name);
    assert.ok(luminance(color(theme, "mdHr")) < luminance(color(theme, "mdQuoteBorder")), theme.name);
  }
});

test("Auren Forest uses a green identity without collapsing state colors", () => {
  const forest = themes.find(theme => theme.name === "auren-forest")!;
  for (const key of ["accent", "accentStrong", "accentSoft"] as const) {
    const [red, green, blue] = rgb(forest.vars[key]);
    assert.ok(green > red && green > blue, `${key} is not green-led`);
  }
  assert.notEqual(forest.vars.accent, forest.vars.success);
  assert.notEqual(forest.vars.warning, forest.vars.error);
  assert.equal(color(forest, "toolDiffAdded"), forest.vars.success);
  assert.equal(color(forest, "toolDiffRemoved"), forest.vars.error);
});

test("Auren Ember uses a copper identity without collapsing warm semantic roles", () => {
  const ember = themes.find(theme => theme.name === "auren-ember")!;
  for (const key of ["accent", "accentStrong", "accentSoft"] as const) {
    const [red, green, blue] = rgb(ember.vars[key]);
    assert.ok(red > green && green > blue, `${key} is not copper-led`);
  }
  assert.notEqual(ember.vars.accent, ember.vars.warning);
  assert.notEqual(ember.vars.accent, ember.vars.error);
  assert.notEqual(ember.vars.warning, ember.vars.error);
  assert.equal(color(ember, "toolDiffAdded"), ember.vars.success);
  assert.equal(color(ember, "toolDiffRemoved"), ember.vars.error);
});

test("Auren Violet uses a lavender identity and separates higher thinking levels", () => {
  const violet = themes.find(theme => theme.name === "auren-violet")!;
  for (const key of ["accent", "accentStrong", "accentSoft"] as const) {
    const [red, green, blue] = rgb(violet.vars[key]);
    assert.ok(blue > red && red > green, `${key} is not lavender-led`);
  }
  assert.notEqual(violet.vars.accent, violet.vars.violet);
  assert.notEqual(violet.vars.accentStrong, violet.vars.violetStrong);
  assert.notEqual(color(violet, "thinkingMedium"), color(violet, "thinkingHigh"));
  assert.notEqual(color(violet, "thinkingHigh"), color(violet, "thinkingXhigh"));
  assert.notEqual(violet.vars.success, violet.vars.error);
  assert.equal(color(violet, "toolDiffAdded"), violet.vars.success);
  assert.equal(color(violet, "toolDiffRemoved"), violet.vars.error);
});
