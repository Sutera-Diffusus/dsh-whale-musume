import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const core = require(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "whale-moe-core.js"));
const T0 = Date.UTC(2026, 7, 15, 10, 0, 0);

test("pat raises mood and affinity and unlocks first-pat", () => {
  const out = core.computeGrowth(null, { type: "pat" }, T0, 1);
  assert.equal(out.growth.mood, 74);
  assert.equal(out.growth.affinity, 2);
  assert.ok(out.unlocks.includes("first-pat"));
});

test("poke lowers mood but never below zero", () => {
  let g = core.computeGrowth(null, { type: "poke" }, T0, 0).growth;
  for (let i = 0; i < 20; i++) g = core.computeGrowth(g, { type: "poke" }, T0, 0).growth;
  assert.equal(g.mood, 0);
});

test("feed restores satiety and unlocks first-feed", () => {
  const out = core.computeGrowth({ satiety: 10 }, { type: "feed" }, T0, 0);
  assert.equal(out.growth.satiety, 40);
  assert.ok(out.unlocks.includes("first-feed"));
});

test("level rises at affinity 500 and unlocks lv5 at level 5", () => {
  const out = core.computeGrowth({ affinity: 1999 }, { type: "praise" }, T0, 0); // 1999+8=2007 -> lv5
  assert.equal(out.growth.level, 5);
  assert.ok(out.unlocks.includes("lv5"));
});

test("signin streak increments across consecutive days", () => {
  const d1 = core.computeGrowth(null, { type: "signin" }, T0, 0).growth;
  assert.equal(d1.signinStreak, 1);
  const d2 = core.computeGrowth(d1, { type: "signin" }, T0 + 86400000, 0).growth;
  assert.equal(d2.signinStreak, 2);
  const d3 = core.computeGrowth(d2, { type: "signin" }, T0 + 2 * 86400000, 0).growth;
  assert.equal(d3.signinStreak, 3);
  assert.ok(d3.achievements.includes("signin3"));
});

test("keyword matcher only works when enabled", () => {
  assert.equal(core.matchKeyword("谢谢你！", true), "thanks");
  assert.equal(core.matchKeyword("谢谢你！", false), null);
  assert.equal(core.matchKeyword("无关内容", true), null);
});

test("dialogue bank meets the 480-line quota", () => {
  assert.ok(core.dialogueCount() >= 480, String(core.dialogueCount()));
});

test("pickDialogue rotates within the requested event", () => {
  for (const c of [0, 1, 2, 3]) {
    const line = core.pickDialogue("interact", "pat", c, () => 0.2);
    assert.ok(core.DIALOGUE.interact.pat.includes(line));
  }
});