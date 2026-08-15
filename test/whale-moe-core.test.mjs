import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const core = require(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "whale-moe-core.js"));
const T0 = 1_000_000;

const freshSignals = (over = {}) => ({
  view: "workbench", waiting: false, thinking: false, tool: false,
  successAt: -Infinity, error: false, curiousAt: -Infinity,
  lastInteraction: T0, denseCode: false, ...over
});

test("priority: error beats tool and thinking", () => {
  const out = core.computeState(null, freshSignals({ error: true, tool: true, thinking: true }), T0, () => 0);
  assert.equal(out.state, "failure");
  assert.equal(out.speak, true);
  assert.ok(out.line.length > 0);
});

test("priority: tool beats thinking", () => {
  const out = core.computeState(null, freshSignals({ tool: true, thinking: true }), T0, () => 0);
  assert.equal(out.state, "tool");
  assert.equal(out.pose, "running");
});

test("success only wins inside its 2s window", () => {
  const inWindow = core.computeState(null, freshSignals({ successAt: T0 - 1500 }), T0, () => 0);
  assert.equal(inWindow.state, "success");
  const expired = core.computeState(null, freshSignals({ successAt: T0 - 3000 }), T0, () => 1);
  assert.equal(expired.state, "idle");
});

test("afk after 3 minutes of no interaction", () => {
  const idle = core.computeState(null, freshSignals({ lastInteraction: T0 - 170_000 }), T0, () => 1);
  assert.equal(idle.state, "idle");
  const nap = core.computeState(idle, freshSignals({ lastInteraction: T0 - 181_000 }), T0, () => 0);
  assert.equal(nap.state, "afk");
  assert.equal(nap.pose, "sleep");
});

test("speech gap: same state re-speaks only after 6s", () => {
  const first = core.computeState(null, freshSignals({ error: true }), T0, () => 0);
  assert.equal(first.speak, true);
  const quiet = core.computeState(first, freshSignals({ error: true }), T0 + 3000, () => 0);
  assert.equal(quiet.speak, false);
  assert.equal(quiet.line, "");
  const again = core.computeState(quiet, freshSignals({ error: true }), T0 + 9000, () => 0);
  assert.equal(again.speak, true);
  assert.equal(again.streak, 1);
});

test("teasing fires deterministically when rng is below the chance", () => {
  const teased = core.computeState(null, freshSignals(), T0, () => 0.001);
  assert.equal(teased.state, "teasing");
  const notTeased = core.computeState(null, freshSignals(), T0, () => 0.5);
  assert.equal(notTeased.state, "idle");
});

test("waiting beats idle but not thinking", () => {
  assert.equal(core.computeState(null, freshSignals({ waiting: true }), T0, () => 1).state, "waiting");
  assert.equal(core.computeState(null, freshSignals({ waiting: true, thinking: true }), T0, () => 1).state, "thinking");
});

test("petDisabled short-circuits to hidden without speech", () => {
  const out = core.computeState(null, freshSignals({ petDisabled: true, error: true }), T0, () => 0);
  assert.equal(out.state, "hidden");
  assert.equal(out.pose, null);
  assert.equal(out.speak, false);
});

test("denseCode flips mode to mini", () => {
  const out = core.computeState(null, freshSignals({ denseCode: true }), T0, () => 1);
  assert.equal(out.mode, "mini");
});

test("default rng falls back to idle, not teasing", () => {
  const out = core.computeState(null, freshSignals(), T0);
  assert.equal(out.state, "idle");
});

test("partial prev is normalized with defaults", () => {
  const out = core.computeState({ state: "idle" }, freshSignals({ error: true }), T0, () => 0);
  assert.equal(out.state, "failure");
  assert.equal(out.lastSpeechAt, T0);
  assert.equal(out.lineCount, 1);
  assert.equal(out.streak, 1);
});

test("curious wins inside its 6s window", () => {
  const inWindow = core.computeState(null, freshSignals({ curiousAt: T0 - 4000 }), T0, () => 1);
  assert.equal(inWindow.state, "curious");
  const expired = core.computeState(null, freshSignals({ curiousAt: T0 - 7000 }), T0, () => 1);
  assert.equal(expired.state, "idle");
});

test("afk never covers active work signals", () => {
  const err = core.computeState(null, freshSignals({ error: true, lastInteraction: T0 - 500_000 }), T0, () => 0);
  assert.equal(err.state, "failure");
  const tool = core.computeState(null, freshSignals({ tool: true, lastInteraction: T0 - 500_000 }), T0, () => 0);
  assert.equal(tool.state, "tool");
});

test("non-finite or future success timestamps are ignored", () => {
  assert.notEqual(core.computeState(null, freshSignals({ successAt: Infinity }), T0, () => 1).state, "success");
  assert.notEqual(core.computeState(null, freshSignals({ successAt: T0 + 5000 }), T0, () => 1).state, "success");
  assert.equal(core.computeState(null, freshSignals({ successAt: T0 - 500 }), T0, () => 1).state, "success");
});