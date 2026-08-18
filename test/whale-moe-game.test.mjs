import test from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "./load-core.mjs";

const core = loadCore();
const T0 = Date.UTC(2026, 7, 18, 10, 0, 0);

test("gameGrade boundaries: 150 draw, 299 draw, 300 win, 149 lose", () => {
  assert.equal(core.gameGrade(150), "draw");
  assert.equal(core.gameGrade(299), "draw");
  assert.equal(core.gameGrade(300), "win");
  assert.equal(core.gameGrade(149), "lose");
});

test("gamePop: bubble +10, star +30, bomb -20 and clears combo", () => {
  const s0 = core.gameNewState(T0, () => 0.5);
  const board = s0.board.slice();
  board[3] = { kind: "bubble", bornAt: T0 };
  const s1 = Object.assign({}, s0, { board });
  const pop = core.gamePop(s1, 3, T0 + 100, () => 0.5);
  assert.equal(pop.hit, true);
  assert.equal(pop.delta, 10 + 2); // base 10 + combo bonus min(1,10)*2
  assert.equal(pop.state.score, 12);

  const b2 = s1.board.slice();
  b2[5] = { kind: "star", bornAt: T0 };
  const s2 = Object.assign({}, s1, { board: b2, combo: 0, comboAt: 0 });
  const popStar = core.gamePop(s2, 5, T0 + 100, () => 0.5);
  assert.equal(popStar.delta, 30 + 2);

  const b3 = s1.board.slice();
  b3[7] = { kind: "bomb", bornAt: T0 };
  const s3 = Object.assign({}, s1, { board: b3, combo: 5, comboAt: T0, score: 50 });
  const popBomb = core.gamePop(s3, 7, T0 + 100, () => 0.5);
  assert.equal(popBomb.delta, -20);
  assert.equal(popBomb.state.combo, 0);
  assert.equal(popBomb.state.score, 50); // bomb does not add score
});

test("gamePop: combo increments within 1200ms and resets after window", () => {
  const s0 = core.gameNewState(T0, () => 0.5);
  let board = s0.board.slice();
  board[0] = { kind: "bubble", bornAt: T0 };
  let state = Object.assign({}, s0, { board });
  state = core.gamePop(state, 0, T0 + 100, () => 0.5).state;
  assert.equal(state.combo, 1);
  board = state.board.slice();
  board[1] = { kind: "bubble", bornAt: T0 + 100 };
  state = Object.assign({}, state, { board });
  state = core.gamePop(state, 1, T0 + 500, () => 0.5).state;
  assert.equal(state.combo, 2);
  board = state.board.slice();
  board[2] = { kind: "bubble", bornAt: T0 + 100 };
  state = Object.assign({}, state, { board });
  state = core.gamePop(state, 2, T0 + 2000, () => 0.5).state; // > 1200ms since last pop
  assert.equal(state.combo, 1);
});

test("gamePop: combo bonus capped at min(combo,10)*2", () => {
  const s0 = core.gameNewState(T0, () => 0.5);
  const board = s0.board.slice();
  board[0] = { kind: "bubble", bornAt: T0 };
  const state = Object.assign({}, s0, { board, combo: 12, comboAt: T0 });
  const pop = core.gamePop(state, 0, T0 + 100, () => 0.5);
  assert.equal(pop.delta, 10 + 20); // min(12,10)*2 = 20
});

test("gameTick: spawns at most one per interval on empty cell, expires bubbles", () => {
  const s0 = core.gameNewState(T0, () => 0.99);
  const t1 = core.gameTick(s0, T0 + 600, () => 0.99);
  const spawns = t1.events.filter((e) => e.kind === "spawn");
  assert.equal(spawns.length, 1);
  assert.equal(t1.state.board.filter(Boolean).length, 1);
  assert.ok(t1.state.remainingMs < s0.remainingMs);
  // at T0+2400: the T0+600 bubble (life 1600) expired, and a fresh one spawned
  const t2 = core.gameTick(t1.state, T0 + 2400, () => 0.99);
  const expires = t2.events.filter((e) => e.kind === "expire");
  assert.ok(expires.length >= 1);
  assert.equal(t2.state.board.filter(Boolean).length, 1);
});

test("gameTick: remainingMs decrements by real time and ends at 0", () => {
  const s0 = core.gameNewState(T0, () => 0.5);
  const t1 = core.gameTick(s0, T0 + 30000, () => 0.5);
  assert.equal(t1.state.status, "ended");
  assert.equal(t1.state.remainingMs, 0);
});

test("gameResult aggregates score/grade/comboMax", () => {
  const s = core.gameNewState(T0, () => 0.5);
  const ended = Object.assign({}, s, { score: 320, comboMax: 7, status: "ended" });
  const r = core.gameResult(ended);
  assert.equal(r.grade, "win");
  assert.equal(r.score, 320);
  assert.equal(r.comboMax, 7);
});

test("computeGrowth game branches: win/draw/lose/high-score and clamps", () => {
  const win = core.computeGrowth(null, { type: "game-win" }, T0, 0);
  assert.equal(win.growth.mood, 78);
  assert.equal(win.growth.affinity, 12);
  const draw = core.computeGrowth(null, { type: "game-draw" }, T0, 0);
  assert.equal(draw.growth.mood, 72);
  assert.equal(draw.growth.affinity, 3);
  const lose = core.computeGrowth({ mood: 2 }, { type: "game-lose" }, T0, 0);
  assert.equal(lose.growth.mood, 0);
  const hs = core.computeGrowth(null, { type: "high-score" }, T0, 0);
  assert.equal(hs.growth.affinity, 5);
  const capped = core.computeGrowth({ affinity: 9995 }, { type: "game-win" }, T0, 0);
  assert.equal(capped.growth.affinity, 10000);
});

test("evaluateGameAchievements: idempotent unlock rules", () => {
  const first = core.evaluateGameAchievements([], { plays: 1, wins: 0, comboMax: 0 });
  assert.ok(first.includes("game-first"));
  assert.ok(!first.includes("game-win"));
  const win = core.evaluateGameAchievements(["game-first"], { plays: 1, wins: 1, comboMax: 0 });
  assert.ok(win.includes("game-win"));
  const combo = core.evaluateGameAchievements([], { plays: 0, wins: 0, comboMax: 10 });
  assert.ok(combo.includes("game-combo10"));
  const hs = core.evaluateGameAchievements([], { plays: 0, wins: 0, comboMax: 0, highscore: true });
  assert.ok(hs.includes("game-highscore"));
  const again = core.evaluateGameAchievements(["game-first", "game-win", "game-combo10", "game-highscore"], { plays: 5, wins: 3, comboMax: 12, highscore: true });
  assert.deepEqual(again, []);
});

test("gameRewardAllowed: 3 per day, resets across days", () => {
  const stats = { today: "2026-8-18", playsToday: 2 };
  assert.equal(core.gameRewardAllowed(stats, T0), true);
  assert.equal(core.gameRewardAllowed({ today: "2026-8-18", playsToday: 3 }, T0), false);
  assert.equal(core.gameRewardAllowed({ today: "2026-8-17", playsToday: 9 }, T0), true);
});

/* ---- catch-the-snacks (game 2) ---- */

test("catchNewState: initial shape", () => {
  const s = core.catchNewState(T0, () => 0.5);
  assert.equal(s.items.length, 0);
  assert.equal(s.status, "playing");
  assert.equal(s.remainingMs, core.CATCH.DURATION_MS);
  assert.equal(s.basketX, 0.5);
});

test("catchTick: spawns one item per interval and items fall", () => {
  const s0 = core.catchNewState(T0, () => 0.5);
  const t1 = core.catchTick(s0, T0 + 1000, () => 0.5);
  assert.equal(t1.state.items.length, 1);
  assert.ok(t1.state.items[0].y > -0.06);
  const t2 = core.catchTick(t1.state, T0 + 1100, () => 0.5);
  assert.ok(t2.state.items[0].y > t1.state.items[0].y);
  assert.equal(t2.state.items.length, 1); // next spawn at 1800
});

test("catchTick: aligned basket catches cake and scores with combo", () => {
  const s0 = core.catchNewState(T0, () => 0.5);
  const placed = Object.assign({}, s0, { basketX: 0.5, items: [{ x: 0.5, y: 0.89, kind: "cake", resolved: false }], nextSpawnAt: T0 + 60000 });
  const out = core.catchTick(placed, T0 + 200, () => 0.5);
  assert.equal(out.state.score, 10 + 2); // base + combo bonus min(1,10)*2
  assert.equal(out.state.caught, 1);
  assert.equal(out.state.items.length, 0);
});

test("catchTick: misaligned basket misses and resets combo", () => {
  const s0 = core.catchNewState(T0, () => 0.5);
  const placed = Object.assign({}, s0, { basketX: 0.9, combo: 5, comboAt: T0, items: [{ x: 0.2, y: 0.89, kind: "cake", resolved: false }], nextSpawnAt: T0 + 60000 });
  const out = core.catchTick(placed, T0 + 200, () => 0.5);
  assert.equal(out.state.missed, 1);
  assert.equal(out.state.combo, 0);
  assert.equal(out.state.score, 0);
});

test("catchTick: caught bomb subtracts and resets combo, missed bomb is harmless", () => {
  const s0 = core.catchNewState(T0, () => 0.5);
  const caught = Object.assign({}, s0, { basketX: 0.5, score: 40, combo: 3, comboAt: T0, items: [{ x: 0.5, y: 0.89, kind: "bomb", resolved: false }], nextSpawnAt: T0 + 60000 });
  const out1 = core.catchTick(caught, T0 + 200, () => 0.5);
  assert.equal(out1.state.score, 20);
  assert.equal(out1.state.combo, 0);
  const missed = Object.assign({}, s0, { basketX: 0.9, combo: 3, comboAt: T0, items: [{ x: 0.2, y: 0.89, kind: "bomb", resolved: false }], nextSpawnAt: T0 + 60000 });
  const out2 = core.catchTick(missed, T0 + 200, () => 0.5);
  assert.equal(out2.state.combo, 3); // bomb miss does not reset combo
  assert.equal(out2.state.score, 0);
});

test("catchMove clamps basket into [0.02, 0.98]", () => {
  const s = core.catchNewState(T0, () => 0.5);
  assert.equal(core.catchMove(s, -5).basketX, 0.02);
  assert.equal(core.catchMove(s, 9).basketX, 0.98);
  assert.equal(core.catchMove(s, 0.4).basketX, 0.4);
});

test("catchTick: ends at zero remaining time", () => {
  const s0 = core.catchNewState(T0, () => 0.5);
  const out = core.catchTick(s0, T0 + core.CATCH.DURATION_MS + 10, () => 0.5);
  assert.equal(out.state.status, "ended");
});

test("catchResult aggregates score/grade/caught/missed", () => {
  const s = Object.assign({}, core.catchNewState(T0, () => 0.5), { score: 320, comboMax: 6, caught: 20, missed: 3, status: "ended" });
  const r = core.catchResult(s);
  assert.equal(r.grade, "win");
  assert.equal(r.score, 320);
  assert.equal(r.caught, 20);
  assert.equal(r.missed, 3);
});
