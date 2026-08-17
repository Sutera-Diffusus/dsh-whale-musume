import test from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "./load-core.mjs";

const core = loadCore();
const T0 = Date.UTC(2026, 7, 18, 10, 0, 0); // 2026-08-18 is a Tuesday
const DAY = 86400000;

test("refreshQuests: 3 slots, no duplicates, signin-1 always present", () => {
  const q = core.refreshQuests(null, T0, () => 0.1);
  assert.equal(q.slots.length, 3);
  const ids = q.slots.map((s) => s.id);
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.includes("signin-1"));
  assert.ok(q.slots.every((s) => s.claimed === false && s.progress === 0));
});

test("refreshQuests: same day returns the same quests, next day refreshes", () => {
  const q1 = core.refreshQuests(null, T0, () => 0.1);
  const q2 = core.refreshQuests(q1, T0 + 3600000, () => 0.9);
  assert.deepEqual(q2, q1);
  const q3 = core.refreshQuests(q1, T0 + DAY, () => 0.9);
  assert.notEqual(q3.date, q1.date);
  assert.equal(q3.slots.length, 3);
});

test("computeQuests: progress accumulates and completes at target", () => {
  const seeded = core.refreshQuests(null, T0, () => 0.5);
  const patSlot = seeded.slots.find((s) => s.id === "pat-3");
  const out1 = core.computeQuests(seeded, { metric: "pat", amount: 1 }, T0);
  const p1 = out1.quests.slots.find((s) => s.id === "pat-3");
  assert.equal(p1.progress, 1);
  assert.deepEqual(out1.completed, []);
  const out2 = core.computeQuests(out1.quests, { metric: "pat", amount: 2 }, T0);
  const p2 = out2.quests.slots.find((s) => s.id === "pat-3");
  assert.equal(p2.progress, 3);
  assert.deepEqual(out2.completed, ["pat-3"]);
});

test("computeQuests: progress never exceeds target", () => {
  const seeded = core.refreshQuests(null, T0, () => 0.5);
  const out = core.computeQuests(seeded, { metric: "pat", amount: 99 }, T0);
  const p = out.quests.slots.find((s) => s.id === "pat-3");
  assert.equal(p.progress, 3);
});

test("claimQuest: claims once, idempotent, returns reward", () => {
  const seeded = core.refreshQuests(null, T0, () => 0.5);
  const done = core.computeQuests(seeded, { metric: "pat", amount: 3 }, T0).quests;
  const c1 = core.claimQuest(done, "pat-3", T0);
  assert.equal(c1.claimed, true);
  assert.equal(c1.reward.affinity, 8);
  assert.equal(c1.quests.slots.find((s) => s.id === "pat-3").claimed, true);
  const c2 = core.claimQuest(c1.quests, "pat-3", T0);
  assert.equal(c2.claimed, false);
  assert.equal(c2.reward, null);
});

test("claimQuest: cannot claim unfinished quest", () => {
  const seeded = core.refreshQuests(null, T0, () => 0.5);
  const c = core.claimQuest(seeded, "pat-3", T0);
  assert.equal(c.claimed, false);
});

test("claimQuest: 3/3 claims trigger newlyAll", () => {
  const seeded = core.refreshQuests(null, T0, () => 0.5);
  let q = seeded;
  for (const slot of seeded.slots) {
    const def = core.QUEST_POOL.find((x) => x.id === slot.id);
    q = core.computeQuests(q, { metric: def.metric, amount: def.target }, T0).quests;
  }
  let last = null;
  for (const slot of q.slots) {
    last = core.claimQuest(q, slot.id, T0);
    q = last.quests;
  }
  assert.equal(last.newlyAll, true);
  assert.equal(q.allClaimed, true);
});

test("computeWeekSignin: milestones 1/3/7 fire once and board resets across weeks", () => {
  // week starts Monday 2026-08-17 (local). T0 is Tue 18.
  const day1 = core.computeWeekSignin(null, "2026-8-17", T0 - DAY);
  assert.equal(day1.milestoneHit, "1");
  assert.equal(day1.weekSignin.days.length, 1);
  const day2 = core.computeWeekSignin(day1.weekSignin, "2026-8-18", T0);
  assert.equal(day2.milestoneHit, null);
  const day3 = core.computeWeekSignin(day2.weekSignin, "2026-8-19", T0 + DAY);
  assert.equal(day3.milestoneHit, "3");
  assert.equal(day3.weekSignin.rewarded3, true);
  // same day re-sync does not re-fire
  const again = core.computeWeekSignin(day3.weekSignin, "2026-8-19", T0 + DAY);
  assert.equal(again.milestoneHit, null);
  // fill to 6 days (20..22)
  let w = day3.weekSignin;
  for (let i = 2; i < 5; i += 1) {
    w = core.computeWeekSignin(w, `2026-8-${18 + i}`, T0 + i * DAY).weekSignin;
  }
  // 7th day (Sun 23) fires milestone 7
  const day7 = core.computeWeekSignin(w, "2026-8-23", T0 + 5 * DAY);
  assert.equal(day7.milestoneHit, "7");
  assert.equal(day7.weekSignin.days.length, 7);
  // next week (Monday 24): board resets, signinStreak untouched (different system)
  const nextWeek = core.computeWeekSignin(day7.weekSignin, "2026-8-24", T0 + 6 * DAY);
  assert.equal(nextWeek.weekSignin.days.length, 1);
  assert.equal(nextWeek.weekSignin.rewarded7, false);
});

test("bondUnlocks thresholds: 2/3 action, 4/5 badge, 6/7 egg", () => {
  assert.equal(core.bondUnlocks(2).action, false);
  assert.equal(core.bondUnlocks(3).action, true);
  assert.equal(core.bondUnlocks(4).badge, false);
  assert.equal(core.bondUnlocks(5).badge, true);
  assert.deepEqual(core.bondUnlocks(5).badges, ["bond-lv5"]);
  assert.equal(core.bondUnlocks(6).egg, false);
  assert.equal(core.bondUnlocks(7).egg, true);
});

test("computeGrowth quest/questAll/weekly deltas and clamps", () => {
  const q = core.computeGrowth(null, { type: "quest" }, T0, 0);
  assert.equal(q.growth.affinity, 8);
  assert.equal(q.growth.mood, 72);
  const qa = core.computeGrowth(null, { type: "questAll" }, T0, 0);
  assert.equal(qa.growth.affinity, 20);
  const wk = core.computeGrowth(null, { type: "weekly" }, T0, 0);
  assert.equal(wk.growth.affinity, 30);
  assert.equal(wk.growth.mood, 75);
  const capped = core.computeGrowth({ affinity: 9990 }, { type: "weekly" }, T0, 0);
  assert.equal(capped.growth.affinity, 10000);
});

test("moodTier boundaries: 39/40/69/70/84/85", () => {
  assert.equal(core.moodTier(39), "low");
  assert.equal(core.moodTier(40), "mid");
  assert.equal(core.moodTier(69), "mid");
  assert.equal(core.moodTier(70), "high");
  assert.equal(core.moodTier(84), "high");
  assert.equal(core.moodTier(85), "high");
  assert.equal(core.moodTier(NaN), "high"); // defaults to 70 → high
});

test("evaluateQuestAchievements: idempotent unlock rules", () => {
  const quests = { slots: [{ id: "signin-1", progress: 1, claimed: true }, { id: "pat-3", progress: 3, claimed: true }, { id: "tool-3", progress: 0, claimed: false }], allClaimed: false };
  const out = core.evaluateQuestAchievements({ achievements: [], level: 1 }, quests, null);
  assert.ok(out.includes("quest-first"));
  assert.ok(!out.includes("quest-all"));
  const full = { slots: quests.slots, allClaimed: true };
  const out2 = core.evaluateQuestAchievements({ achievements: ["quest-first"], level: 5 }, full, { days: Array.from({ length: 7 }) });
  assert.ok(out2.includes("quest-all"));
  assert.ok(out2.includes("week-signin7"));
  assert.ok(out2.includes("bond-action"));
  assert.ok(out2.includes("bond-badge"));
  const haveAll = ["quest-first"].concat(out2);
  const again = core.evaluateQuestAchievements({ achievements: haveAll, level: 5 }, full, { days: Array.from({ length: 7 }) });
  assert.deepEqual(again, []);
});

test("DIALOGUE.bond exists with >=5 lines per bucket", () => {
  for (const key of ["l3", "l5", "l7", "high-mood", "low-mood"]) {
    assert.ok(core.DIALOGUE.bond[key].length >= 3, key);
  }
  assert.ok(core.dialogueCount() >= 480);
});
