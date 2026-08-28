import test from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "./load-core.mjs";

const core = loadCore();
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
  assert.equal(nap.pose, "afk");
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

test("idle stays idle no matter the rng (no teasing flicker)", () => {
  const low = core.computeState(null, freshSignals(), T0, () => 0.001);
  assert.equal(low.state, "idle");
  const high = core.computeState(null, freshSignals(), T0, () => 0.5);
  assert.equal(high.state, "idle");
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

test("greetBucket maps all six time buckets", () => {
  assert.equal(core.greetBucket(5), "night");
  assert.equal(core.greetBucket(6), "morning");
  assert.equal(core.greetBucket(8), "morning");
  assert.equal(core.greetBucket(9), "forenoon");
  assert.equal(core.greetBucket(11), "forenoon");
  assert.equal(core.greetBucket(12), "noon");
  assert.equal(core.greetBucket(13), "noon");
  assert.equal(core.greetBucket(14), "afternoon");
  assert.equal(core.greetBucket(17), "afternoon");
  assert.equal(core.greetBucket(18), "evening");
  assert.equal(core.greetBucket(22), "evening");
  assert.equal(core.greetBucket(23), "night");
});

test("weatherText maps WMO codes", () => {
  assert.equal(core.weatherText(0).kind, "sunny");
  assert.equal(core.weatherText(2).kind, "cloudy");
  assert.equal(core.weatherText(61).kind, "rain");
  assert.equal(core.weatherText(71).kind, "snow");
  assert.equal(core.weatherText(95).kind, "thunder");
  assert.equal(core.weatherText(3).kind, "cloudy");
  assert.equal(core.weatherText(45).kind, "fog");
  assert.equal(core.weatherText(999).kind, "unknown");
});

test("classifyTask sorts text into topic buckets", () => {
  assert.equal(core.classifyTask("帮我写一个 React 组件"), "code");
  assert.equal(core.classifyTask("把这段文章润色成周报"), "write");
  assert.equal(core.classifyTask("调研一下 Server-Sent Events 的原理"), "research");
  assert.equal(core.classifyTask("这个报错怎么修复"), "bug");
  assert.equal(core.classifyTask("把 CSV 清洗后做统计"), "data");
  assert.equal(core.classifyTask("部署到服务器上线"), "deploy");
  assert.equal(core.classifyTask("今天心情不错"), "general");
});

test("pickDialogueAvoidRecent avoids recent lines", () => {
  const recent = ["早啊主人，太阳都晒到尾巴了才来🌞", "主人早安！鲸鱼娘今天也是精神百倍😤"];
  const pick = core.pickDialogueAvoidRecent("daily", "morning", 0, () => 0.99, recent);
  assert.equal(pick, "早～再不起来我就把你的咖啡喝光啦☕");
});

test("meme keyword groups match and have lines", () => {
  assert.equal(core.matchKeyword("我是打工人", true), "worker");
  assert.equal(core.matchKeyword("今天一直在摸鱼", true), "slack");
  assert.equal(core.matchKeyword("DDL 要到了", true), "ddl");
  assert.equal(core.matchKeyword("老板又在画饼", true), "cake");
  assert.equal(core.matchKeyword("已老实求放过", true), "crazy");
  assert.equal(core.matchKeyword("我立个 flag", true), "flag");
  assert.equal(core.matchKeyword("这个 bug 好玄学", true), "bugtalk");
  ["worker", "slack", "ddl", "cake", "crazy", "flag", "bugtalk"].forEach((id) => {
    assert.ok(core.DIALOGUE.keyword[id] && core.DIALOGUE.keyword[id].length >= 5, id);
  });
  ["worker", "slack", "ddl", "cake", "crazy", "flag"].forEach((id) => {
    assert.ok(core.DIALOGUE.meme[id] && core.DIALOGUE.meme[id].length >= 5, "meme " + id);
  });
  ["code", "write", "research", "bug", "data", "deploy", "general"].forEach((id) => {
    assert.ok(core.DIALOGUE.context[id] && core.DIALOGUE.context[id].length >= 4, id);
  });
  ["sunny", "rain", "snow", "thunder", "cloudy", "fog", "hot", "cold", "wind"].forEach((id) => {
    assert.ok(core.DIALOGUE.weather[id] && core.DIALOGUE.weather[id].length >= 3, id);
  });
  ["morning", "forenoon", "noon", "afternoon", "evening", "night"].forEach((id) => {
    assert.ok(core.DIALOGUE.greet[id] && core.DIALOGUE.greet[id].length >= 5, id);
  });
});

test("applyNames swaps the user title and the mascot self-name", () => {
  assert.equal(core.applyNames("主人好，鲸鱼娘来啦", "老板", "小鲸"), "老板好，小鲸来啦");
  assert.equal(core.applyNames("鲸鱼娘在忙", "主人", ""), "鲸鱼娘在忙");
  assert.equal(core.applyNames("鲸鱼娘在忙", null, null), "鲸鱼娘在忙");
  assert.equal(core.applyNames("主人好", "", "小鲸"), "主人好");
  assert.equal(core.applyNames("没有称呼的一句话", "老板", "小鲸"), "没有称呼的一句话");
  assert.equal(core.applyNames("", "老板", "小鲸"), "");
  assert.equal(core.applyNames(undefined, "老板", "小鲸"), "");
  /* 同一句里多处自称都要替换（台词里常出现「鲸鱼娘」两次以上）。 */
  assert.equal(core.applyNames("鲸鱼娘说鲸鱼娘来", "主人", "阿鲸"), "阿鲸说阿鲸来");
});

test("applyNames covers the default self-name carried by the line banks", () => {
  const allStates = Object.values(core.LINES).flat().join("|");
  assert.ok(allStates.indexOf("鲸鱼娘") !== -1, "台词库应保留默认自称「鲸鱼娘」");
  assert.equal(core.applyNames("鲸鱼娘", "主人", "小鲸"), "小鲸");
});