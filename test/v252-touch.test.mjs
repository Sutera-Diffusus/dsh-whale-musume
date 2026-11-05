/**
 * 触屏 & 桌宠尺寸回归（PR #35 合入后的修正）：
 * 1. 长按不能被轻微抖动吃掉；非悬浮形态也必须有菜单入口；
 * 2. 尺寸解析统一 80–240，非法值 / 存储不可用回落默认。
 *
 * 零浏览器：DOM 桩 + 虚拟定时器，不联网、不起服务器。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createClientHostHarness, readRepoFile } from "../tools/dom-stub.mjs";
import { loadCore } from "./load-core.mjs";

const PLUGIN_ID = "dsh-whale-musume";
const HOST_DECLARED_SLOTS = { "settings.section": { kind: "list", scope: "root" } };
const CLIENT_SOURCE = readRepoFile("lib/client.js");
const core = loadCore();

async function bootPresenter() {
  const env = createClientHostHarness({
    declaredSlots: HOST_DECLARED_SLOTS,
    matchMedia: (query) => String(query).includes("reduce") === false,
  });
  env.loadBundle(CLIENT_SOURCE);
  env.materialize(PLUGIN_ID);
  env.apply(PLUGIN_ID);
  await env.idle();
  env.runInjectedScripts();
  return env;
}

function pointerEvent(env, type, init = {}) {
  const event = new env.sandbox.Event(type, { cancelable: true });
  event.pointerType = init.pointerType ?? "touch";
  event.isPrimary = init.isPrimary ?? true;
  event.clientX = init.clientX ?? 0;
  event.clientY = init.clientY ?? 0;
  event.button = init.button ?? 0;
  return event;
}

/** presenter 的拖拽监听挂在 window 上，事件必须派发到 window 才算走拖拽路径。 */
function dispatchWindowPointer(env, type, init = {}) {
  env.sandbox.dispatchEvent(pointerEvent(env, type, init));
}

/** 把当前模式切成 auto 并跑一次 reconcile（auto 下没有 dragState）。 */
function useAutoMode(env) {
  env.localStorage.setItem("whale-moe:mode", "auto");
  env.clearTimers();
  env.dispatchWindowEvent("whale-moe-prefs-change", { detail: { key: "mode", value: "auto" } });
  env.runTimers(4);
  return env;
}

function contextMenu(env) {
  return env.document.querySelector("[data-dsh-whale-context]") ?? null;
}

test("resolveFloatSize：80–240 内生效，其余（含非法值）回落默认", () => {
  const r = core.resolveFloatSize;
  assert.equal(r(null, 1440), 200, "缺省 → 桌面 200");
  assert.equal(r(undefined, 1440), 200);
  assert.equal(r("", 1440), 200, "空串按缺省处理");
  assert.equal(r("abc", 1440), 200, "非法数字回落到默认");
  assert.equal(r("79", 1440), 200, "低于下限忽略");
  assert.equal(r("80", 1440), 80);
  assert.equal(r("200", 1440), 200);
  assert.equal(r("240", 1440), 240, "上限 240 生效");
  assert.equal(r("241", 1440), 200, "超过 240 忽略（旧实现允许到 300）");
  assert.equal(r("300", 1440), 200);
  assert.equal(r(null, 600), 130, "窄屏缺省 130");
  assert.equal(r("150", 600), 150);
});

test("触屏长按：轻微抖动（1px）不能把计时器清掉", async () => {
  const env = await bootPresenter();
  const frame = env.document.querySelector("[data-dsh-whale-frame]");
  assert.ok(frame);

  env.clearTimers();
  frame.dispatchEvent(pointerEvent(env, "pointerdown", { clientX: 700, clientY: 500 }));
  // 手指抖动：window 上的 onDrag 会收到 pointermove，但位移只有 1px（旧实现在这里无条件清掉长按）
  dispatchWindowPointer(env, "pointermove", { clientX: 701, clientY: 500 });
  assert.ok(env.runTimers(4) >= 1, "长按定时器应仍然存在");

  assert.ok(contextMenu(env), "轻微抖动后长按必须仍能弹出右键菜单");
});

test("触屏长按：非悬浮形态（auto，没有 dragState）也有菜单入口", async () => {
  const env = useAutoMode(await bootPresenter());
  const frame = env.document.querySelector("[data-dsh-whale-frame]");
  assert.ok(frame);

  env.clearTimers();
  frame.dispatchEvent(pointerEvent(env, "pointerdown", { clientX: 640, clientY: 420 }));
  assert.ok(env.runTimers(4) >= 1);

  assert.ok(contextMenu(env), "auto / bar / side / mini 下长按也必须能打开菜单（旧实现只认 dragState）");
});

test("触屏长按：拖动超过阈值后不再弹菜单", async () => {
  const env = await bootPresenter();
  const frame = env.document.querySelector("[data-dsh-whale-frame]");
  assert.ok(frame);

  env.clearTimers();
  frame.dispatchEvent(pointerEvent(env, "pointerdown", { clientX: 700, clientY: 500 }));
  dispatchWindowPointer(env, "pointermove", { clientX: 712, clientY: 500 });
  env.runTimers(4);

  assert.equal(Boolean(contextMenu(env)), false, "拖拽超过 4px 后不应再弹菜单");
});
