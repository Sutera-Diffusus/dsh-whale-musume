/**
 * v2.5.1 回归：关掉看板娘再打开后角色「透明隐身」（discussion #34）。
 *
 * 两个独立入口，覆盖同一类根因——`layerState` 是模块级缓存，而 DOM 节点会被
 * 重建；缓存不复位 / 不复核 DOM，`setPose()` 就会误判「这个姿势已经加载」而早退，
 * 新 <img> 拿不到 src。
 *
 * 零浏览器：全部跑在 tools/dom-stub.mjs 的 DOM 桩上，不联网、不起服务器。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createClientHostHarness, readRepoFile } from "../tools/dom-stub.mjs";

const PLUGIN_ID = "dsh-whale-musume";
const SECTION_SLOT = "settings.section";
const HOST_DECLARED_SLOTS = { [SECTION_SLOT]: { kind: "list", scope: "root" } };
const CLIENT_SOURCE = readRepoFile("lib/client.js");

/** 完整走一遍注入 → 物化 → apply → 执行 core/presenter。 */
async function bootPresenter(options = {}) {
  const env = createClientHostHarness({ declaredSlots: HOST_DECLARED_SLOTS, ...options });
  env.loadBundle(CLIENT_SOURCE);
  env.materialize(PLUGIN_ID);
  env.apply(PLUGIN_ID);
  await env.idle();
  env.runInjectedScripts();
  return env;
}

/** 触发一次防抖 reconcile：先清空虚拟定时器，再发事件，然后跑掉 schedule() 注册的那个。 */
function reconcileNow(env, detail = { key: "mode", value: "auto" }) {
  env.clearTimers();
  env.dispatchWindowEvent("whale-moe-prefs-change", { detail });
  const ran = env.runTimers(4);
  assert.ok(ran >= 1, "schedule() 应注册一次防抖 reconcile 定时器");
  return env;
}

/** 重新挂载后的「真正显示出来的那一层」：必须有 active 类名且带 src。 */
function shownLayer(env) {
  const root = env.document.querySelector("[data-dsh-whale-root]");
  assert.ok(root, "桌宠根节点应已挂载");
  const layers = root.querySelectorAll("[data-dsh-whale-layer]");
  const shown = layers.find((el) => el.classList.contains("dsh-whale-active"));
  assert.ok(shown, "必须有一层带 dsh-whale-active（否则整只桌宠不可见）");
  assert.ok(
    String(shown.getAttribute("src") || "").length > 0,
    "active 层必须带 src；为空说明 setPose() 因 layerState 缓存早退了（透明隐身）"
  );
  return shown;
}

test("关掉看板娘再打开：重新挂载后必须重新落图（不再透明隐身）", async () => {
  const env = await bootPresenter();
  assert.equal(env.document.querySelectorAll("[data-dsh-whale-root]").length, 1, "初始应只有一个根节点");
  shownLayer(env);

  /* 用户路径：齿轮菜单/设置面板把「看板娘」开关关掉 → 根节点被移除。 */
  env.localStorage.setItem("whale-moe:pet", "0");
  reconcileNow(env, { key: "pet", value: "0" });
  assert.equal(env.document.querySelector("[data-dsh-whale-root]"), null, "关闭后根节点应被移除");
  assert.ok(env.document.querySelector("[data-dsh-whale-recall]"), "关闭后应出现唤回按钮");

  /* 再打开：重新 ensureRoot() 生成新的 <img>，此时必须重新写 src。 */
  env.localStorage.setItem("whale-moe:pet", "1");
  reconcileNow(env, { key: "pet", value: "1" });
  assert.equal(env.document.querySelector("[data-dsh-whale-recall]"), null, "重新打开后唤回按钮应消失");
  const layer = shownLayer(env);

  /* 缓存与 DOM 必须重新对齐。 */
  const debug = JSON.parse(JSON.stringify(env.sandbox.__dshWhaleMoeDebug));
  assert.notEqual(debug.failed, true, "重挂载不得把 presenter 打进 failed 态");
  assert.equal(debug.layers.loaded.a, layer.getAttribute("src"), "layerState.loaded 应记录重新落上的 src");
});

test("宿主把根节点摘掉（不经过 removeRoot）后重挂载：setPose 必须复核 DOM 再落图", async () => {
  const env = await bootPresenter();
  const root = env.document.querySelector("[data-dsh-whale-root]");
  assert.ok(root);
  shownLayer(env);

  /* 模拟宿主/调试工具直接移除节点：layerState 仍然记着旧 src，这是缓存与 DOM
     脱节的第二种入口（removeRoot 之外的路径）。 */
  root.remove();
  assert.equal(env.document.querySelector("[data-dsh-whale-root]"), null);

  reconcileNow(env);
  shownLayer(env);
});
