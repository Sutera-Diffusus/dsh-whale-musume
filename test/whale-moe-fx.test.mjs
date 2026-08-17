import test from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "./load-core.mjs";

const core = loadCore();

test("weatherFx maps every recorded WMO code to a known kind", () => {
  const codes = Object.keys({ 0: 1, 1: 1, 2: 1, 3: 1, 45: 1, 48: 1, 51: 1, 53: 1, 55: 1, 56: 1, 57: 1, 61: 1, 63: 1, 65: 1, 66: 1, 67: 1, 71: 1, 73: 1, 75: 1, 77: 1, 80: 1, 81: 1, 82: 1, 85: 1, 86: 1, 95: 1, 96: 1, 99: 1 });
  for (const code of codes) {
    const fx = core.weatherFx(code, 20, 10);
    assert.ok(fx, `code ${code} should map`);
    assert.ok(["sunny", "cloudy", "fog", "rain", "snow", "thunder", "hot", "cold", "wind"].includes(fx.kind), `code ${code} kind ${fx.kind}`);
  }
});

test("weatherFx derives hot/cold/wind from temp and wind on clear base", () => {
  assert.equal(core.weatherFx("0", 31, 10).kind, "hot");
  assert.equal(core.weatherFx("0", -2, 10).kind, "cold");
  assert.equal(core.weatherFx("0", 20, 45).kind, "wind");
  assert.equal(core.weatherFx("2", 35, 5).kind, "hot");
});

test("weatherFx: precipitation beats temp/wind", () => {
  assert.equal(core.weatherFx("95", 35, 50).kind, "thunder");
  assert.equal(core.weatherFx("61", 35, 50).kind, "rain");
  assert.equal(core.weatherFx("71", 35, 50).kind, "snow");
  assert.equal(core.weatherFx("45", 35, 50).kind, "fog");
});

test("weatherFx intensity boundaries", () => {
  assert.equal(core.weatherFx("61", 20, 0).intensity, 1);
  assert.equal(core.weatherFx("63", 20, 0).intensity, 2);
  assert.equal(core.weatherFx("65", 20, 0).intensity, 3);
  assert.equal(core.weatherFx("71", 20, 0).intensity, 1);
  assert.equal(core.weatherFx("73", 20, 0).intensity, 2);
  assert.equal(core.weatherFx("75", 20, 0).intensity, 3);
  assert.equal(core.weatherFx("95", 20, 0).intensity, 2);
  assert.equal(core.weatherFx("96", 20, 0).intensity, 3);
  assert.equal(core.weatherFx("99", 20, 0).intensity, 3);
});

test("weatherFx hot/cold/wind tier boundaries", () => {
  assert.equal(core.weatherFx("0", 29.9, 0).kind, "sunny"); // below hot threshold
  assert.equal(core.weatherFx("0", 30, 0).intensity, 1);
  assert.equal(core.weatherFx("0", 34, 0).intensity, 2);
  assert.equal(core.weatherFx("0", 38, 0).intensity, 3);
  assert.equal(core.weatherFx("0", 0.5, 0).kind, "sunny"); // above cold threshold
  assert.equal(core.weatherFx("0", 0, 0).intensity, 1);
  assert.equal(core.weatherFx("0", -6, 0).intensity, 2);
  assert.equal(core.weatherFx("0", -13, 0).intensity, 3);
  assert.equal(core.weatherFx("0", 20, 38.9).kind, "sunny"); // below wind threshold
  assert.equal(core.weatherFx("0", 20, 39).intensity, 1);
  assert.equal(core.weatherFx("0", 20, 50).intensity, 2);
  assert.equal(core.weatherFx("0", 20, 62).intensity, 3);
});

test("weatherFx robustness: unknown code null, NaN tolerated, string/number equal", () => {
  assert.equal(core.weatherFx("999", 20, 10), null);
  assert.equal(core.weatherFx("61", NaN, NaN).kind, "rain");
  assert.equal(core.weatherFx("0", NaN, NaN).kind, "sunny");
  assert.deepEqual(core.weatherFx(61, 20, 10), core.weatherFx("61", 20, 10));
});

test("weatherFx is pure: same input same output, no randomness", () => {
  const a = JSON.stringify(core.weatherFx("65", 20, 30));
  const b = JSON.stringify(core.weatherFx("65", 20, 30));
  assert.equal(a, b);
  assert.ok(!a.includes("Math.random"));
});

test("weatherFx mode dispatch: static for sunny/cloudy/cold, flash for thunder", () => {
  assert.equal(core.weatherFx("0", 20, 10).mode, "static");
  assert.equal(core.weatherFx("3", 20, 10).mode, "static");
  assert.equal(core.weatherFx("0", -5, 10).mode, "static");
  assert.equal(core.weatherFx("95", 20, 10).mode, "flash");
  assert.equal(core.weatherFx("61", 20, 10).mode, "motion");
});
