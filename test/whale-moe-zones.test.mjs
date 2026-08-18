import test from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "./load-core.mjs";

const core = loadCore();
const T0 = Date.UTC(2026, 7, 18, 10, 0, 0);

test("hitZone: head hit", () => assert.equal(core.hitZone(0.5, 0.2, "full"), "head"));
test("hitZone: belly hit", () => assert.equal(core.hitZone(0.5, 0.6, "full"), "belly"));
test("hitZone: tail hit", () => assert.equal(core.hitZone(0.5, 0.9, "full"), "tail"));
test("hitZone: belly top edge is inclusive", () => assert.equal(core.hitZone(0.5, 0.5, "full"), "belly"));
test("hitZone: tail top edge is inclusive and wins over head/belly", () => assert.equal(core.hitZone(0.5, 0.78, "full"), "tail"));
test("hitZone: tail full width wins on the bottom-left corner", () => assert.equal(core.hitZone(0.1, 0.9, "full"), "tail"));
test("hitZone: miss falls back to head", () => assert.equal(core.hitZone(0.9, 0.6, "full"), "head"));
test("hitZone: out-of-range input clamps without throwing", () => {
  assert.equal(core.hitZone(-1, 2, "full"), "tail"); // clamps to (0,1) -> tail band
  assert.equal(core.hitZone(2, -1, "full"), "head"); // clamps to (1,0) -> falls back head
});
test("hitZone: peek set is all head", () => assert.equal(core.hitZone(0.5, 0.9, "peek"), "head"));
test("hitZone: unknown poseSet degrades to peek", () => assert.equal(core.hitZone(0.5, 0.9, "bogus"), "head"));
test("hitZone: non-numeric input tolerated", () => {
  assert.doesNotThrow(() => core.hitZone(undefined, "0.9", "full"));
  assert.equal(core.hitZone(undefined, "0.9", "full"), "tail");
});

test("computeGrowth belly/tail deltas", () => {
  const belly = core.computeGrowth(null, { type: "belly" }, T0, 0);
  assert.equal(belly.growth.mood, 73);
  assert.equal(belly.growth.affinity, 2);
  const tail = core.computeGrowth(null, { type: "tail" }, T0, 0);
  assert.equal(tail.growth.mood, 72);
  assert.equal(tail.growth.affinity, 3);
});

test("DIALOGUE.interact belly/tail banks have lines", () => {
  assert.ok(core.DIALOGUE.interact.belly.length >= 5);
  assert.ok(core.DIALOGUE.interact.tail.length >= 5);
  assert.ok(core.DIALOGUE.interact.tease.length >= 5);
});

test("festivalKey: fixed festivals", () => {
  assert.equal(core.festivalKey(Date.UTC(2026, 9, 31, 10)), "festival-halloween");
  assert.equal(core.festivalKey(Date.UTC(2026, 11, 25, 10)), "festival-christmas");
  assert.equal(core.festivalKey(Date.UTC(2026, 1, 14, 10)), "valentine");
  assert.equal(core.festivalKey(Date.UTC(2026, 1, 17, 10)), "festival-spring"); // lunar table
  assert.equal(core.festivalKey(Date.UTC(2026, 8, 25, 10)), "festival-mid-autumn"); // lunar table
  assert.equal(core.festivalKey(Date.UTC(2026, 2, 5, 10)), "");
  assert.equal(core.festivalKey(T0), "");
});

test("keyword banks for new ids exist", () => {
  for (const id of ["kyun", "omg", "doge", "sike", "worship", "peace", "doubt", "wakuwaku", "smilepain", "ojisan", "deploy", "meeting", "review"]) {
    assert.ok(core.DIALOGUE.keyword[id] && core.DIALOGUE.keyword[id].length >= 2, id);
    assert.ok(core.matchKeyword(core.KEYWORDS.find((k) => k.id === id).words[0], true) === id);
  }
});

test("dialogue quota still satisfied after additions", () => {
  assert.ok(core.dialogueCount() >= 480);
});
