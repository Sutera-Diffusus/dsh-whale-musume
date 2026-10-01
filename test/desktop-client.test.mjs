/**
 * 零浏览器验收台:lib/client.js 在 DSH 桌面端(内嵌 0.2.0-rc.2 Web 客户端)
 * 里的装入 + 引导回归断言。
 *
 * 跑法:`node --test test/desktop-client.test.mjs`(文件名含 test,已随 `npm test` 的 `test/*test.mjs` 一起跑)。
 * 不启动浏览器、不起服务器、不联网、不装包;DOM 与宿主模块系统都是
 * tools/dom-stub.mjs 里的最小桩(契约来源见该文件头部注释)。
 *
 * 断言映射(与交接单一致):
 *   a 脚本执行期零副作用(仅注册 factory)          → a1( queue 顺序)/ a2( live 顺序)
 *   b 物化/引导后注入 <style data-...=css> + 内容相等 → b1(物化即注入)/ b2 / b3
 *   c 三段资源都走宿主路由、无外部请求               → c1 / c2 / c2b(桩自检)
 *   d presenter 路径改写命中                        → d1 / d2 / d3 / d4
 *   e slots 注册契约 + slots 缺失不抛错              → e1 / e2 / e3
 *   f 重复挂载不重复注入                            → f1 / f2 / f3
 *   额外:设置面板组件物化                           → g1 / g2 / g3
 *   桌面端运行时契约(CDP 实测结论,含牙齿验证)        → h1 误判设置页 / h2 body 空串暗色 /
 *                                                    h3 source 回落+html 兼容 / h4 冷启动非工作态 /
 *                                                    h5 body 优先 / h1 与 i4 的共同前提
 *   0.2.0-rc.2 结构信号与选择器契约                  → i1 工具卡 / i2 composer-card /
 *                                                    i3 composer-input / i4 shortcut-modal
 *   桩自检(防假阴性)                                → s1(查询/事件/存储/定时器)
 *   诊断(不做断言的观察项)                          → z1
 *
 * 「牙齿」约定:每条 h/i 断言都做过反证 —— 在内存里把 presenter 还原成修复前的写法
 * (不改 assets/),断言必须失败。证据见各自的测试注释与交付回信。
 *
 * 若某条断言因 lib/client.js 现状无法满足:测试会 t.skip() 并在 skip 文案里写清
 * 「为什么 + 需要 lib 侧怎么改」,绝不修改 lib/ 去凑测试。
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  HOST_QUERY,
  HOST_ROUTE,
  createAssetRouteFetch,
  createClientHostHarness,
  createSlotsService,
  countTags,
  plain,
  readRepoFile,
  renderElementTree,
} from "../tools/dom-stub.mjs";

const PLUGIN_ID = "dsh-whale-musume";
const BOOT_FLAG = "__dshWhaleMusumeBooted";
const SECTION_SLOT = "settings.section";
const ITEM_SLOT = "settings.mascot.item";
const ROUTE = `${HOST_ROUTE}${HOST_QUERY}`;

const CLIENT_SOURCE = readRepoFile("lib/client.js");
const CSS_TEXT = readRepoFile("assets/dsh-whale-moe.css");
const CORE_TEXT = readRepoFile("assets/whale-moe-core.js");
const PRESENTER_RAW = readRepoFile("assets/dsh-whale-moe.js");

/** 宿主外壳(ui-settings 领域基座)在插件加载前就已声明 settings.section。 */
const HOST_DECLARED_SLOTS = { [SECTION_SLOT]: { kind: "list", scope: "root" } };

function makeEnv(options = {}) {
  return createClientHostHarness({ declaredSlots: HOST_DECLARED_SLOTS, ...options });
}

/** 走最小启动路径:执行 bundle → 物化 factory → 调 apply(ctx) → 等 boot 的 await 链排空。 */
async function boot(options = {}) {
  const env = makeEnv(options);
  env.loadBundle(CLIENT_SOURCE);
  env.materialize(PLUGIN_ID);
  const applied = env.apply(PLUGIN_ID);
  await env.idle();
  return { env, applied };
}

/** 断言"脚本执行期零副作用"的公共部分(bundle 到达并执行之后立刻检查)。 */
function assertNoSideEffects(env, label) {
  assert.equal(env.document.head.children.length, 0, `${label}:脚本执行期不应往 <head> 插节点`);
  assert.equal(env.document.body.children.length, 0, `${label}:脚本执行期不应往 <body> 插节点`);
  assert.equal(env.fetchCalls.length, 0, `${label}:脚本执行期不应发请求`);
  assert.equal(env.localStorage.length, 0, `${label}:脚本执行期不应写 localStorage`);
  assert.equal(env.window[BOOT_FLAG], undefined, `${label}:脚本执行期不应置引导标志`);
  assert.equal(env.pendingTimers(), 0, `${label}:脚本执行期不应挂定时器`);
  assert.equal(env.queuedAnimationFrames(), 0, `${label}:脚本执行期不应挂 rAF`);
  assert.equal(env.warnings().length, 0, `${label}:脚本执行期不应产生告警`);
  assert.equal(env.errors().length, 0, `${label}:脚本执行期不应产生错误`);
}

/** 收集物化骨架树里的所有文本节点。 */
function collectStrings(tree, out = []) {
  if (tree === null || tree === undefined) return out;
  if (typeof tree === "string" || typeof tree === "number") {
    out.push(String(tree));
    return out;
  }
  if (Array.isArray(tree)) {
    for (const item of tree) collectStrings(item, out);
    return out;
  }
  if (typeof tree === "object" && tree.props !== undefined) collectStrings(tree.props.children, out);
  return out;
}

function renderedText(tree) {
  return collectStrings(tree).join("");
}

/* ------------------------------------------------------------------ *
 * a. 惰性 CJS:脚本执行期只注册 factory
 * ------------------------------------------------------------------ */

test("a1 【惰性 CJS】queue 模式下执行 bundle 只入队:零 DOM/网络/存储副作用", () => {
  const env = makeEnv();
  env.loadBundle(CLIENT_SOURCE);

  assert.equal(env.facade.mode, "queue", "bundle 执行时 facade 应仍处于 queue 模式");
  assert.equal(env.facade.pendingQueue.length, 1, "应恰好入队 1 条 factory 注册");
  const [registration] = env.facade.pendingQueue;
  assert.equal(registration.id, PLUGIN_ID);
  assert.equal(typeof registration.factory, "function");
  assert.equal(env.moduleSystem.isMaterialized(PLUGIN_ID), false, "脚本执行期不得物化");
  assertNoSideEffects(env, "a1");
});

test("a2 【惰性 CJS】live 模式下执行 bundle 只注册 factory:仍无副作用", () => {
  const env = makeEnv();
  env.createModuleSystem(); // 等价于 client-modules bootstrap 调 __ModuleLoader__.create()
  assert.equal(env.isLive(), true);

  env.loadBundle(CLIENT_SOURCE);
  assert.equal(env.moduleSystem.hasFactory(PLUGIN_ID), true, "live 模式下应注册到 factory 表");
  assert.equal(env.moduleSystem.isMaterialized(PLUGIN_ID), false, "注册 != 物化");
  assertNoSideEffects(env, "a2");
});

/* ------------------------------------------------------------------ *
 * b. 引导后注入样式与脚本
 * ------------------------------------------------------------------ */

test("b1 【惰性 CJS】factory 物化期即开始引导(副作用不在 apply 期)", async (t) => {
  const env = makeEnv();
  env.loadBundle(CLIENT_SOURCE);
  env.materialize(PLUGIN_ID);

  // 判别依据:boot() 的第一个动作是 fetch(CSS)。若引导在 factory 体内,
  // 物化返回时就已经同步发出了第 1 个请求;若引导在 apply 里,此刻还是 0。
  const fetchesAtMaterialize = env.fetchCalls.length;
  await env.idle();

  if (fetchesAtMaterialize === 0) {
    t.skip(
      "lib/client.js 把引导副作用放回了 apply(ctx)(boot() 由 apply 调用),factory 物化期只做函数定义、零请求。" +
        "0.2.0-rc.2 的 ClientModuleLoader 只在首次 import 时执行 factory(),随后 cordis fiber 才调 apply(ctx) —— " +
        "桌面端桌宠仍能出现,但「物化即引导」不成立,与 dsh-client-modules/lib/index.js:16-31 的惰性 CJS 契约注释不一致。" +
        "(此契约 2026-09-29 已修过一次:boot() 移进 factory 体,apply 只留 registerSettings;本条再次 skip 说明发生了回归。)" +
        "需要 lib 侧改动:把 boot() 调用移回 factory 体内。"
    );
    return;
  }

  assert.equal(fetchesAtMaterialize, 1, "物化期应同步发出第 1 个资源请求(样式)");
  assert.equal(env.styles().length, 1, "等 await 链排空后应已注入样式");
  assert.equal(env.scripts().length, 2, "等 await 链排空后应已注入两段脚本");
});

test("b2 引导后注入 <style data-dsh-whale-musume=css>,内容与 assets/dsh-whale-moe.css 完全相等", async () => {
  const { env } = await boot();
  const styles = env.styles();

  assert.equal(styles.length, 1, `应恰好注入 1 个 <style>,实际 ${styles.length}`);
  assert.equal(styles[0].getAttribute("data-dsh-whale-musume"), "css");
  assert.equal(styles[0].parentNode, env.document.head, "样式应挂在 document.head");
  assert.equal(styles[0].textContent, CSS_TEXT, "注入的 CSS 文本应与 assets/dsh-whale-moe.css 逐字符相等");
  assert.ok(CSS_TEXT.length > 1000, "样式表内容不应为空壳");
});

test("b3 注入顺序 style → core → presenter,两个 <script> 都带 data-dsh-whale-musume=js", async () => {
  const { env } = await boot();
  const scripts = env.scripts();

  assert.equal(scripts.length, 2, `应注入 2 个 <script>(core + presenter),实际 ${scripts.length}`);
  for (const script of scripts) assert.equal(script.getAttribute("data-dsh-whale-musume"), "js");
  assert.equal(scripts[0].parentNode, env.document.body);
  assert.equal(scripts[1].parentNode, env.document.body);
  assert.equal(scripts[0].textContent, CORE_TEXT, "第 1 段脚本应等于 assets/whale-moe-core.js");
  assert.ok(scripts[1].textContent.length > 1000, "presenter 文本不应为空");
  assert.equal(env.styles().length, 1, "样式只注入一次");
});

/* ------------------------------------------------------------------ *
 * c. 三段资源都经宿主路由
 * ------------------------------------------------------------------ */

test("c1 三段资源全部经宿主路由获取,顺序 css → core → presenter", async () => {
  const { env } = await boot();

  assert.deepEqual(
    env.fetchCalls.map((call) => call.url),
    [`${ROUTE}dsh-whale-moe.css`, `${ROUTE}whale-moe-core.js`, `${ROUTE}dsh-whale-moe.js`],
    "三段资源必须按 样式 → 状态机 → 表现层 的顺序走宿主路由"
  );
  for (const call of env.fetchCalls) {
    assert.equal(call.external, false, `不应有绝对 http(s) 请求:${call.url}`);
    assert.equal(call.served, true, `宿主路由应能服务:${call.url}`);
  }
  assert.equal(env.missingAssets().length, 0, "不应有 404 的资源");
  assert.equal(env.errors().length, 0);
});

test("c2 无外部 http(s) 请求,也无越出宿主路由的请求", async () => {
  const { env } = await boot();

  assert.deepEqual(plain(env.externalFetches()), [], "不得访问任何外部地址");
  for (const call of env.fetchCalls) {
    assert.ok(call.url.startsWith(ROUTE), `请求越出宿主路由:${call.url}`);
  }
});

test("c2b 【桩自检】宿主路由桩确实会把外部请求记为越界", async () => {
  const route = createAssetRouteFetch();
  const external = await route.fetch("https://api.open-meteo.com/v1/forecast?latitude=31");
  const internal = await route.fetch(`${ROUTE}whale-moe-core.js`);
  const missing = await route.fetch(`${ROUTE}does-not-exist.js`);

  assert.equal(external.ok, false, "外部地址不得被服务(证明 c2 的断言有牙齿)");
  assert.equal(plain(route.externalFetches()).length, 1);
  assert.equal(internal.ok, true);
  assert.equal((await internal.text()).length > 1000, true, "宿主路由应真的把 assets 读出来");
  assert.equal(missing.ok, false);
  assert.equal(plain(route.missingAssets()).length, 1);
});

/* ------------------------------------------------------------------ *
 * d. presenter 路径改写
 * ------------------------------------------------------------------ */

test("d1 presenter 的 ASSET_ROOT 已改写为宿主路由", async () => {
  const { env } = await boot();
  const presenter = env.scripts()[1].textContent;
  const literal = 'var ASSET_ROOT = "/assets/generated/";';

  assert.ok(PRESENTER_RAW.includes(literal), `源 presenter 缺少待改写字面量,replace 会静默失效:${literal}`);
  assert.ok(presenter.includes(`var ASSET_ROOT = "${ROUTE}generated/";`), "ASSET_ROOT 未改写为宿主路由");
  assert.equal(presenter.includes(literal), false, "注入文本里仍残留旧的 ASSET_ROOT 字面量");
});

test("d2 presenter 的 peek-calibration.json 已改写为宿主路由", async () => {
  const { env } = await boot();
  const presenter = env.scripts()[1].textContent;
  const literal = 'fetch("/assets/peek-calibration.json")';

  assert.ok(PRESENTER_RAW.includes(literal), `源 presenter 缺少待改写字面量,replace 会静默失效:${literal}`);
  assert.ok(presenter.includes(`fetch("${ROUTE}peek-calibration.json")`), "peek-calibration.json 未改写为宿主路由");
  assert.equal(presenter.includes(literal), false, "注入文本里仍残留旧的 fetch 字面量");
});

/**
 * d3:ANIM_ROOT 死改写已在 lib 侧删除(2026-09-29,lead 按 b1/d3 结论改),
 * 因此这条从「断言改写命中」改成「断言不会再出现死改写 + anim 路径不被引用」。
 * 判断依据:assets/dsh-whale-moe.js 从来没有 ANIM_ROOT 常量,assets/dsh-whale-moe.css
 * 也没有 url() 引用,assets/anim/*.webm(3 个未跟踪实验素材)在客户端侧无人引用。
 * 若将来要启用 anim 资源,必须成对改三处,否则本断言会亮红:
 *   1) presenter 真正引用(定义并读取该常量或直接写宿主路由);
 *   2) lib/client.js 恢复对应的 replace 改写;
 *   3) 本测试恢复「改写命中」断言。assets/anim 目录本身不在本任务写入范围。
 */
test("d3 client.js 不再做 ANIM_ROOT 死改写,且注入文本不引用 /assets/anim/", async () => {
  const { env } = await boot();
  const presenter = env.scripts()[1].textContent;

  // 1) client.js 里不得再有针对 ANIM_ROOT 的 replace(注释里提到 ANIM_ROOT 是允许的,只查 replace 调用)。
  const replaceCalls = [...CLIENT_SOURCE.matchAll(/\.replace\([^\n]*/g)].map((match) => match[0]);
  const animReplace = replaceCalls.filter((call) => call.includes("ANIM_ROOT"));
  assert.deepEqual(animReplace, [], `client.js 仍在对 presenter 里不存在的 ANIM_ROOT 做 replace(死代码):${animReplace.join(" / ")}`);

  // 2) 有效的那两处改写仍在(防止「连好的一起删掉」)。
  assert.ok(replaceCalls.some((call) => call.includes("ASSET_ROOT")), "ASSET_ROOT 改写不应被删掉");
  assert.ok(replaceCalls.some((call) => call.includes("peek-calibration.json")), "peek-calibration 改写不应被删掉");

  // 3) presenter 自身不得引用 ANIM_ROOT(否则运行期 ReferenceError)。
  assert.equal(PRESENTER_RAW.includes("ANIM_ROOT"), false, "presenter 不应引用 ANIM_ROOT 常量");

  // 4) 注入文本里不得出现任何未改写的 anim 资源路径。
  assert.equal(presenter.includes("/assets/anim/"), false, "注入文本不应出现 /assets/anim/ 路径(桌面端会 404)");
});

test("d4 注入的 presenter 文本里没有遗留的 /assets/ 绝对路径", async () => {
  const { env } = await boot();
  const presenter = env.scripts()[1].textContent;
  const leftovers = [...presenter.matchAll(/["'`]\/assets\//g)].map((match) => match[0]);

  assert.deepEqual(leftovers, [], "仍有 /assets/ 绝对路径未被改写(桌面端会 404)");
});

/* ------------------------------------------------------------------ *
 * e. slots 注册契约
 * ------------------------------------------------------------------ */

test("e1 slots 可用时注册 settings.section(id=mascot) 与子 slot settings.mascot.item(id=mascot-prefs)", async () => {
  const { env } = await boot();
  const entries = env.slots.entries();

  assert.equal(entries.length, 2, `应注册 2 条贡献,实际 ${entries.length}`);
  const [section, item] = entries;

  assert.equal(section.name, SECTION_SLOT);
  assert.deepEqual(plain(section.options), {
    name: SECTION_SLOT,
    id: "mascot",
    order: 6,
    label: "看板娘",
    children: { [ITEM_SLOT]: { kind: "list", scope: "root" } },
  });
  assert.equal(typeof section.component, "function", "settings.section 必须带组件");

  assert.equal(item.name, ITEM_SLOT);
  assert.equal(item.options.id, "mascot-prefs");
  assert.equal(item.options.order, 0);
  assert.equal(typeof item.component, "function", "settings.mascot.item 必须带组件");

  assert.notEqual(env.slots.spec(ITEM_SLOT), undefined, "父条目的 children 表应声明 settings.mascot.item");
  assert.equal(env.warnings().length, 0, `注册不应产生告警:${JSON.stringify(env.warnings())}`);
});

test("e2 settings.section 尚未声明时保持挂起,不抛错;宿主声明后自动补注册", async () => {
  const slots = createSlotsService({ declared: {} });
  const env = makeEnv({ services: { slots } });
  env.loadBundle(CLIENT_SOURCE);
  env.materialize(PLUGIN_ID);

  assert.doesNotThrow(() => env.apply(PLUGIN_ID), "slot 未声明不得让插件加载失败");
  await env.idle();

  assert.equal(env.slots.entries().length, 0, "声明缺失时不应发生注册");
  assert.deepEqual(env.slots.pendingInjectKeys().sort(), [ITEM_SLOT, SECTION_SLOT].sort(), "两处 inject 都应处于挂起态");
  assert.equal(env.styles().length, 1, "设置面板挂起不影响桌宠本体注入");

  slots.declare(SECTION_SLOT, { kind: "list", scope: "root" });
  const entries = env.slots.entries();
  assert.equal(entries.length, 2, "宿主声明后两处贡献应自动补注册");
  assert.equal(entries[0].options.id, "mascot");
  assert.equal(entries[1].options.id, "mascot-prefs");
});

test("e3 slots 服务缺失时 apply 不抛错,只告警,桌宠本体照常注入", async () => {
  const env = makeEnv({ services: {} }); // 宿主 ctx 里没有 slots 服务
  env.loadBundle(CLIENT_SOURCE);
  env.materialize(PLUGIN_ID);

  assert.doesNotThrow(() => env.apply(PLUGIN_ID));
  await env.idle();

  assert.ok(env.warnings().length >= 1, "应留下「slots 服务不可用」告警");
  assert.equal(env.errors().length, 0);
  assert.equal(env.styles().length, 1, "增强项失败不得影响样式注入");
  assert.equal(env.scripts().length, 2, "增强项失败不得影响桌宠脚本注入");
});

/* ------------------------------------------------------------------ *
 * f. 重复挂载幂等
 * ------------------------------------------------------------------ */

test("f1 物化即引导且二次物化命中 loadCache:factory 只执行一次", () => {
  const env = makeEnv();
  env.loadBundle(CLIENT_SOURCE);
  const first = env.materialize(PLUGIN_ID);
  const second = env.materialize(PLUGIN_ID);

  assert.equal(first, second, "同一 id 的物化必须记忆化");
  assert.equal(env.moduleSystem.factoryRuns.filter((run) => run.id === PLUGIN_ID).length, 1, "factory 应只执行 1 次");
  // 惰性 CJS 契约(0.2.0-rc.2):引导副作用在 factory 物化期发生,因此仅物化、未 apply 时标志就已置位。
  assert.equal(env.window[BOOT_FLAG], true, "物化即引导:仅物化(未 apply)时 BOOT_FLAG 已置位");
  assert.equal(env.fetchCalls.length, 1, "物化返回时已同步发出第 1 个资源请求");
});

test("f2 二次 apply 不重复注入(window 引导标志幂等)", async () => {
  const { env } = await boot();
  assert.equal(env.window[BOOT_FLAG], true, "引导后应置上 window 级幂等标志");

  const warningsAfterBoot = env.warnings().length;
  assert.doesNotThrow(() => env.apply(PLUGIN_ID), "二次 apply 不得抛错");
  await env.idle();

  assert.equal(env.styles().length, 1, "样式不得二次注入");
  assert.equal(env.scripts().length, 2, "脚本不得二次注入");
  assert.equal(env.fetchCalls.length, 3, "资源不得二次拉取");
  // 真实宿主里二次 apply 只会发生在旧 fiber 已卸载之后(HMR);此处是同一 fiber 的
  // 重复调用,slots 冲突告警属预期,只记录不断言。
  assert.ok(env.warnings().length >= warningsAfterBoot);
});

test("f3 HMR 重注册 + 重新物化 + 再次 apply 仍不重复注入", async () => {
  const { env } = await boot();
  const original = env.moduleSystem.loadCache.get(PLUGIN_ID);

  env.moduleSystem.invalidate(PLUGIN_ID);
  env.loadBundle(CLIENT_SOURCE, { filename: "lib/client.js#hmr-1" });
  const reloaded = env.materialize(PLUGIN_ID);
  assert.notEqual(reloaded, original, "invalidate 后应是新一代模块记录");
  env.apply(PLUGIN_ID);
  await env.idle();

  assert.equal(env.styles().length, 1, "HMR 后不得重复注入样式");
  assert.equal(env.scripts().length, 2, "HMR 后不得重复注入脚本");
  assert.equal(env.fetchCalls.length, 3, "HMR 后不得重复拉资源");
});

/* ------------------------------------------------------------------ *
 * g. 设置面板组件物化
 * ------------------------------------------------------------------ */

function sectionComponent(env) {
  const section = env.slots.entries().find((entry) => entry.name === SECTION_SLOT);
  assert.ok(section, "settings.section 贡献未注册,无法物化面板");
  return section.component;
}

test("g1 无 renderSlot 时设置面板回落到内置面板并物化出元素树", async () => {
  const { env } = await boot();
  const Component = sectionComponent(env);

  const tree = renderElementTree(env.reactSeed.jsxRuntime.jsx(Component, {}), env.reactSeed);
  assert.equal(typeof tree, "object");
  assert.ok(countTags(tree, "div") > 5, `内置面板应产出多个 div,实际 ${countTags(tree, "div")}`);

  const text = renderedText(tree);
  assert.ok(text.includes("如何称呼我"), "内置面板缺少「如何称呼我」行,面板可能渲染成空壳");
  assert.ok(text.includes("鲸鱼娘"), "内置面板缺少开关行文案");
  assert.ok(text.includes("重置养成"), "内置面板缺少重置区");
  assert.equal(env.errors().length, 0, `物化面板不应产生错误:${JSON.stringify(env.errors())}`);
});

test("g2 renderSlot 可用时优先渲染 settings.mascot.item,不回落内置面板", async () => {
  const { env } = await boot();
  const Component = sectionComponent(env);
  const seen = [];

  const element = env.reactSeed.jsxRuntime.jsx(Component, {
    renderSlot: (name) => {
      seen.push(name);
      return "SLOT-CONTENT";
    },
  });
  const tree = renderElementTree(element, env.reactSeed);

  assert.deepEqual(seen, [ITEM_SLOT], "应先向 settings.mascot.item 要内容");
  assert.equal(renderedText(tree), "SLOT-CONTENT");
  assert.equal(renderedText(tree).includes("如何称呼我"), false, "renderSlot 成功时不应回落内置面板");
});

test("g3 renderSlot 抛错时回落到内置面板并告警,面板不空白", async () => {
  const { env } = await boot();
  const Component = sectionComponent(env);

  const element = env.reactSeed.jsxRuntime.jsx(Component, {
    renderSlot: () => {
      throw new Error("harness: deliberate slot failure");
    },
  });
  const tree = renderElementTree(element, env.reactSeed);

  assert.ok(renderedText(tree).includes("如何称呼我"), "renderSlot 抛错后应回落内置面板");
  assert.ok(env.warnings().length >= 1, "应留下回落告警");
});

/* ------------------------------------------------------------------ *
 * s. 桩自检(防止桩自身缺陷导致假阴性)
 * ------------------------------------------------------------------ */

test("s1 【桩自检】DOM 查询/属性/事件/存储语义正确", () => {
  const env = makeEnv();
  const doc = env.document;

  // document 级查询必须能遍历到 body 的后代(曾因 dangling-else 漏掉整棵子树)。
  const outer = doc.createElement("div");
  outer.setAttribute("data-dsh-whale-root", "true");
  const inner = doc.createElement("span");
  inner.setAttribute("data-dsh-whale-mascot", "true");
  outer.appendChild(inner);
  doc.body.appendChild(outer);

  assert.equal(doc.querySelector("[data-dsh-whale-root]"), outer);
  assert.equal(doc.querySelector("[data-dsh-whale-mascot]"), inner, "document 级查询必须递归进后代");
  assert.equal(doc.querySelectorAll("span").length, 1);
  assert.equal(doc.body.children.length, 1);
  assert.equal(doc.body.querySelectorAll("body").length, 0, "元素级查询不应包含自身");
  assert.equal(doc.querySelectorAll("html").length, 1, "document 级查询应包含 documentElement");
  assert.equal(outer.querySelector("[data-dsh-whale-mascot]"), inner);
  assert.equal(inner.getAttribute("data-dsh-whale-mascot"), "true");
  assert.equal(inner.textContent, "");
  inner.textContent = "鲸鱼娘";
  assert.equal(inner.textContent, "鲸鱼娘");

  // 样式/事件/存储桩的基本契约。
  const style = doc.createElement("style");
  style.setAttribute("data-dsh-whale-musume", "css");
  style.textContent = "a{color:red}";
  doc.head.appendChild(style);
  assert.equal(doc.head.children.filter((node) => node.tagName === "STYLE").length, 1);

  let fired = 0;
  const onPrefs = () => {
    fired += 1;
  };
  env.sandbox.addEventListener("whale-moe-prefs-change", onPrefs);
  env.dispatchWindowEvent("whale-moe-prefs-change", { detail: { key: "pet" } });
  env.sandbox.removeEventListener("whale-moe-prefs-change", onPrefs);
  env.dispatchWindowEvent("whale-moe-prefs-change", {});
  assert.equal(fired, 1, "window 事件订阅/退订应生效");

  env.localStorage.setItem("whale-moe:pet", "1");
  assert.equal(env.localStorage.getItem("whale-moe:pet"), "1");
  env.localStorage.removeItem("whale-moe:pet");
  assert.equal(env.localStorage.getItem("whale-moe:pet"), null);

  env.sandbox.setTimeout(() => {}, 10);
  const intervalId = env.sandbox.setInterval(() => {}, 5000);
  assert.equal(env.pendingTimers(), 2, "定时器必须是虚拟的,不得真跑");
  env.runTimers();
  assert.equal(env.pendingTimers(), 1, "timeout 跑完即清除,interval 保留(虚拟队列)");
  env.sandbox.clearInterval(intervalId);
  assert.equal(env.pendingTimers(), 0);
});

/* ------------------------------------------------------------------ *
 * h. 桌面端运行时契约(来自 lead 的 CDP 实测结论,锁成回归断言)
 * ------------------------------------------------------------------ */

/** 完整走一遍:注入 → 执行 bundle → 物化 → apply → 执行注入的 core/presenter。 */
async function bootAndRunPresenter(prepare) {
  const env = makeEnv();
  if (prepare) prepare(env);
  env.loadBundle(CLIENT_SOURCE);
  env.materialize(PLUGIN_ID);
  env.apply(PLUGIN_ID);
  await env.idle();
  env.runInjectedScripts();
  return env;
}

test("h1 【桌面端契约】常驻 role=dialog 弹窗不得把首页误判为设置页(桌宠不得被永久隐藏)", async () => {
  const env = await bootAndRunPresenter((harness) => {
    // 复刻 0.2.0-rc.2 刷新后常驻的「预览版说明」弹窗。
    const dialog = harness.document.createElement("div");
    dialog.setAttribute("role", "dialog");
    harness.document.body.appendChild(dialog);
    harness.markVisible(dialog);
  });

  const debug = plain(env.sandbox.__dshWhaleMoeDebug);
  assert.equal(debug.view, "home", `常驻 role=dialog 被误判成设置页(view=${debug.view}),桌宠会永久隐藏`);
  const root = env.document.querySelector("[data-dsh-whale-root]");
  assert.ok(root, "桌宠根节点必须挂载");
  assert.notEqual(root.style.display, "none", "桌宠不得被 display:none 隐藏(首页误判的直接后果)");
  assert.notEqual(debug.failed, true, "presenter 不得因该误判进入 failed 态");
});

test("h2 【桌面端契约】body[data-ds-dark-theme=\"\"] 时桌宠切暗色(data-wm-theme=dark)", async () => {
  // 真实契约(task-1 审计 + lead 复核):明暗只写在 <body> 的 data-ds-dark-theme 上,
  // 取值恒为空串(存在=暗、不存在=亮、从不写 "true"/"false");<html> 上只有 data-ds-theme-source。
  const env = await bootAndRunPresenter((harness) => {
    harness.document.body.setAttribute("data-ds-dark-theme", "");
    harness.document.documentElement.setAttribute("data-ds-theme-source", "system");
  });

  const root = env.document.querySelector("[data-dsh-whale-root]");
  assert.ok(root, "桌宠根节点必须挂载");
  assert.equal(root.getAttribute("data-wm-theme"), "dark", "0.2.0-rc.2 把暗色写在 body 的空串属性上,未识别则主题永远停在 light");
});

test("h3 【桌面端契约】html data-ds-theme-source 回落:light→亮、dark→暗;旧 html data-ds-dark-theme 仍兼容", async () => {
  const light = await bootAndRunPresenter((harness) => {
    harness.document.documentElement.setAttribute("data-ds-theme-source", "light");
  });
  const lightRoot = light.document.querySelector("[data-dsh-whale-root]");
  assert.ok(lightRoot, "桌宠根节点必须挂载");
  assert.equal(lightRoot.getAttribute("data-wm-theme"), "light", "source=light 且 body 无属性 → 亮色");

  const dark = await bootAndRunPresenter((harness) => {
    harness.document.documentElement.setAttribute("data-ds-theme-source", "dark");
  });
  const darkRoot = dark.document.querySelector("[data-dsh-whale-root]");
  assert.ok(darkRoot, "桌宠根节点必须挂载");
  assert.equal(darkRoot.getAttribute("data-wm-theme"), "dark", "source=dark 且 body 无属性 → 暗色");

  // 兼容分支:若某版本把它写在 <html> 上(含 "true" 写法)也要认。
  const legacy = await bootAndRunPresenter((harness) => {
    harness.document.documentElement.setAttribute("data-ds-dark-theme", "true");
  });
  const legacyRoot = legacy.document.querySelector("[data-dsh-whale-root]");
  assert.ok(legacyRoot, "桌宠根节点必须挂载");
  assert.equal(legacyRoot.getAttribute("data-wm-theme"), "dark", "html 上的 data-ds-dark-theme 兼容路径失效");
});

test("h5 【桌面端契约】body 空串属性与 html source 冲突时 body 优先(暗)", async () => {
  // 真实宿主可能出现 source=system(不表态)而 body 才是权威的组合。
  const env = await bootAndRunPresenter((harness) => {
    harness.document.body.setAttribute("data-ds-dark-theme", "");
    harness.document.documentElement.setAttribute("data-ds-theme-source", "light");
  });

  const root = env.document.querySelector("[data-dsh-whale-root]");
  assert.ok(root, "桌宠根节点必须挂载");
  assert.equal(root.getAttribute("data-wm-theme"), "dark", "body 的 data-ds-dark-theme 必须优先于 html source(即使 source=light)");
});

test("h4 【桌面端契约】冷启动(无任何工具信号)不得判成工作态", async () => {
  const env = await bootAndRunPresenter();
  const debug = plain(env.sandbox.__dshWhaleMoeDebug);

  // 曾经的缺陷:memory.toolGoneAt/thinkingGoneAt 初值 0,首个 reconcile 把它设成 now,
  // 于是 toolActive 判定为真 → 开机头 4 秒(工作台 8 秒)摆 running 姿势并说「工具转起来啦」。
  assert.notEqual(debug.state, "tool", `冷启动误判工作态(state=${debug.state}),桌宠会摆工作姿势并说工具台词`);
  assert.notEqual(debug.pose, "running", "冷启动不应使用 running 立绘");
  assert.equal(debug.toolWasActive, false, "没有工具节点时 toolWasActive 应为 false");
  assert.equal(debug.toolSeenAt, 0, "从未见过工具节点,toolSeenAt 应保持 0");
  assert.ok(debug.toolGoneAt <= 0, `未见过工具时 toolGoneAt 不应被写成时间戳(实际 ${debug.toolGoneAt})`);
});

/* ------------------------------------------------------------------ *
 * i. 0.2.0-rc.2 结构信号 / 输入框 / 设置页选择器契约
 * ------------------------------------------------------------------ */

/** 触发一次防抖 reconcile:清空定时器队列 → 只留 schedule() 注册的那一个 → 等过消抖窗口再跑。 */
async function secondReconcile(env, waitMs = 320) {
  env.clearTimers();
  env.dispatchWindowEvent("whale-moe-prefs-change", { detail: { key: "mode", value: "auto" } });
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  const ran = env.runTimers(4);
  assert.ok(ran >= 1, "schedule() 应注册一次防抖 reconcile 定时器");
  return env;
}

test("i1 【桌面端契约】chat node 内可见的 [data-tool][data-state=running] 必须算工具信号(旧排除逻辑会误过滤)", async () => {
  const env = await bootAndRunPresenter((harness) => {
    harness.localStorage.setItem("whale-moe:mode", "auto");
    const chat = harness.document.createElement("div");
    chat.setAttribute("data-slot", "conversation.chat.node");
    harness.document.body.appendChild(chat);
    harness.markVisible(chat, { width: 600, height: 300 });
    const card = harness.document.createElement("div");
    card.setAttribute("data-tool", "pwsh");
    card.setAttribute("data-state", "running");
    chat.appendChild(card);
    harness.markVisible(card, { width: 300, height: 60 });
  });

  const first = plain(env.sandbox.__dshWhaleMoeDebug);
  assert.ok(first.toolSeenAt > 0, "可见工具卡必须被识别为原始工具信号(toolSeenAt 应被写入)");

  await secondReconcile(env);
  const second = plain(env.sandbox.__dshWhaleMoeDebug);
  assert.equal(second.state, "tool", `工具运行中桌宠应进入工作态,实际 ${second.state}`);
  assert.equal(second.pose, "running", `工作态应使用 running 立绘,实际 ${second.pose}`);
});

test("i2 【桌面端契约】只给 [data-composer-card=true] 也能算出可见 bar 布局", async () => {
  const env = await bootAndRunPresenter((harness) => {
    harness.localStorage.setItem("whale-moe:mode", "auto");
    const card = harness.document.createElement("div");
    card.setAttribute("data-composer-card", "true");
    harness.document.body.appendChild(card);
    harness.markVisible(card, { width: 640, height: 88 });
  });

  const debug = plain(env.sandbox.__dshWhaleMoeDebug);
  const root = env.document.querySelector("[data-dsh-whale-root]");
  assert.equal(debug.view, "home");
  assert.equal(debug.layout, "bar", `auto 模式首页应为 bar 形态,实际 ${debug.layout}`);
  assert.ok(root, "桌宠根节点必须挂载");
  assert.notEqual(root.style.display, "none", "找到 composer 时 bar 布局不得隐藏");
});

test("i3 【桌面端契约】只给 [data-composer-input](contenteditable)也能算出可见 bar 布局", async () => {
  const env = await bootAndRunPresenter((harness) => {
    harness.localStorage.setItem("whale-moe:mode", "auto");
    const bar = harness.document.createElement("div");
    bar.setAttribute("class", "composer-shell");
    harness.document.body.appendChild(bar);
    harness.markVisible(bar, { width: 640, height: 88 });
    const input = harness.document.createElement("div");
    input.setAttribute("data-composer-input", "true");
    input.setAttribute("role", "textbox");
    bar.appendChild(input);
    harness.markVisible(input, { width: 600, height: 40 });
  });

  const debug = plain(env.sandbox.__dshWhaleMoeDebug);
  const root = env.document.querySelector("[data-dsh-whale-root]");
  assert.equal(debug.layout, "bar", "0.2.0-rc.2 输入框是 contenteditable,只认 textarea 会让 bar 布局消失");
  assert.ok(root, "桌宠根节点必须挂载");
  assert.notEqual(root.style.display, "none", "contenteditable 输入框必须能被认成 composer(否则桌宠隐藏)");
});

test("i4 【桌面端契约】仅 [data-shortcut-modal=settings] 即算设置页;onboarding dialog 不算", async () => {
  const viaModal = await bootAndRunPresenter((harness) => {
    const modal = harness.document.createElement("div");
    modal.setAttribute("data-shortcut-modal", "settings");
    harness.document.body.appendChild(modal);
    harness.markVisible(modal, { width: 800, height: 600 });
  });
  const modalDebug = plain(viaModal.sandbox.__dshWhaleMoeDebug);
  assert.equal(modalDebug.view, "settings", "设置面板根(portal 到 body)必须被识别为设置页");
  /* v2.2.0：设置页不再整体隐藏（上游 v2.1.0 的布局约定），而是右下角 mini——
     这里同时钉住「识别正确」与「不因识别而消失」两件事。 */
  const modalRoot = viaModal.document.querySelector("[data-dsh-whale-root]");
  assert.ok(modalRoot, "设置页期间桌宠仍应挂载（mini 形态）");
  assert.notEqual(modalRoot.style.display, "none", "设置页不得把桌宠整体隐藏");
  assert.equal(modalDebug.layout, "mini", "设置页应落到 mini 布局（右下角小尺寸），而不是 hidden");
  /* 只断言 layout 名不够：把 w/h 改成 0 也仍然叫 mini。这里直接钉住真实落地的尺寸。 */
  const miniW = Number.parseInt(modalRoot.style.width, 10);
  const miniH = Number.parseInt(modalRoot.style.height, 10);
  assert.ok(miniW >= 80 && miniW <= 200, `设置页 mini 宽度应为紧凑尺寸，实测 width=${modalRoot.style.width}`);
  assert.ok(miniH >= 80 && miniH <= 200, `设置页 mini 高度应为紧凑尺寸，实测 height=${modalRoot.style.height}`);

  const viaOnboarding = await bootAndRunPresenter((harness) => {
    const dialog = harness.document.createElement("div");
    dialog.setAttribute("role", "dialog");
    harness.document.body.appendChild(dialog);
    harness.markVisible(dialog, { width: 520, height: 380 });
  });
  const onboardingDebug = plain(viaOnboarding.sandbox.__dshWhaleMoeDebug);
  assert.equal(onboardingDebug.view, "home", "只有 role=dialog 的首次引导弹窗不得判成设置页");
  assert.notEqual(onboardingDebug.layout, "mini", "引导弹窗不得让桌宠切到设置页的 mini 形态");
  const onboardingRoot = viaOnboarding.document.querySelector("[data-dsh-whale-root]");
  assert.ok(onboardingRoot, "引导弹窗期间桌宠必须照常挂载");
  assert.notEqual(onboardingRoot.style.display, "none", "引导弹窗不得让桌宠隐藏");
  const homeW = Number.parseInt(onboardingRoot.style.width, 10);
  assert.ok(homeW > 0, `引导弹窗期间桌宠尺寸必须正常（实测 width=${onboardingRoot.style.width}）`);
});

test("i5 【桌面端契约】已完成的工具卡(data-state=ok)不得把桌宠钉在工作态", async () => {
  /* 0.2.0-rc.2 的工具卡完成后仍留在 DOM 里（state 变 ok/error/stopped，
     见 dsh-client-ui-tool:278）。若把「存在 [data-tool]」当忙信号，
     一次工具调用就会让桌宠永远停在 running。 */
  const env = await bootAndRunPresenter((harness) => {
    harness.localStorage.setItem("whale-moe:mode", "auto");
    const chat = harness.document.createElement("div");
    chat.setAttribute("data-slot", "conversation.chat.node");
    harness.document.body.appendChild(chat);
    harness.markVisible(chat, { width: 600, height: 300 });
    for (const state of ["ok", "stopped"]) {
      const card = harness.document.createElement("div");
      card.setAttribute("data-tool", "pwsh");
      card.setAttribute("data-state", state);
      chat.appendChild(card);
      harness.markVisible(card, { width: 300, height: 60 });
    }
  });

  await secondReconcile(env);
  const debug = plain(env.sandbox.__dshWhaleMoeDebug);
  assert.equal(debug.toolSeenAt, 0, "已完成的工具卡不得被识别为原始工具信号");
  assert.notEqual(debug.state, "tool", `历史工具卡不得让桌宠进入工作态，实际 ${debug.state}`);
  assert.notEqual(debug.pose, "running", `历史工具卡不得使用 running 立绘，实际 ${debug.pose}`);
});

test("i6 【桩自检】复合属性选择器必须同时满足两个属性(否则 i1/i5 会假绿)", async () => {
  const env = await bootAndRunPresenter(() => {});
  const { document } = env;
  const onlyTool = document.createElement("div");
  onlyTool.setAttribute("data-tool", "pwsh");
  onlyTool.setAttribute("data-state", "ok");
  document.body.appendChild(onlyTool);
  assert.equal(
    document.querySelectorAll('[data-tool][data-state="running"]').length,
    0,
    "state=ok 的卡片不得被 [data-tool][data-state=running] 命中",
  );
  const running = document.createElement("div");
  running.setAttribute("data-tool", "pwsh");
  running.setAttribute("data-state", "running");
  document.body.appendChild(running);
  assert.equal(
    document.querySelectorAll('[data-tool][data-state="running"]').length,
    1,
    "state=running 的卡片必须被命中",
  );
});

/* ------------------------------------------------------------------ *
 * z. 诊断(不断言,只把观察结果打进 TAP)
 * ------------------------------------------------------------------ */

test("z1 【诊断·不断言】把注入的三段脚本在桩 DOM 里按序执行,观察 presenter 能跑到哪一步", async (t) => {
  const { env } = await boot();
  let failure = null;

  try {
    env.runInjectedScripts();
  } catch (error) {
    failure = error;
  }

  const core = env.sandbox.DshWhaleMoeCore;
  const root = env.document.querySelector("[data-dsh-whale-root]");
  const debug = env.sandbox.__dshWhaleMoeDebug;
  t.diagnostic(
    [
      `core 暴露:${core ? "有" : "无"}`,
      `presenter 顶层执行:${failure ? `抛出「${failure.message}」` : "未抛错"}`,
      `挂载 [data-dsh-whale-root]:${root ? "有" : "无"}`,
      `__dshWhaleMoeDebug:${debug ? JSON.stringify(plain(debug)) : "无"}`,
      `body 视图属性:${env.document.body.getAttribute("data-dsh-whale-view") ?? "未设置"}`,
      `告警:${env.warnings().length} 条${env.warnings().length ? ` ${JSON.stringify(env.warnings().slice(0, 2))}` : ""}`,
      `越界请求:${env.externalFetches().length} 个`,
      `虚拟定时器:${env.pendingTimers()} 个`,
      `注入节点数 style/script:${env.styles().length}/${env.scripts().length}`,
      `body 子节点:${env.document.body.children.length} 个 [${env.document.body.children.map((node) => node.tagName).join(",")}]`,
      `全文档属性节点:${env.document.querySelectorAll("div").length} 个 div`,
    ].join(" | ")
  );
  // 诊断项不做断言:桩 DOM 的覆盖度不足以判定 presenter 行为,失败也不代表 lib 有问题。
  assert.ok(true);
});

/**
 * issue #18：桌宠贴到屏幕左/右边缘时，台词气泡与偏好面板都挂在桌宠中心
 * （left:50% + translateX(-50%)），没有视口钳制 → 弹出层一半在屏幕外；贴顶时
 * 向上弹出也会出屏。修法是按桌宠视口位置写 align/valign 懒标记，CSS 换锚定边。
 * 这里逐一钉住：贴左、贴右、贴顶、居中四种情况，以及居中时必须没有残留标记。
 */
test("i7 【桌面端契约】贴边时弹出层方向校正:写入 align/valign 标记,居中时不得残留", async () => {
  const VIEW_W = 1440;
  const VIEW_H = 900;
  const MASCOT = 200;

  const atPosition = async (floatX, floatY) =>
    bootAndRunPresenter((env) => {
      env.localStorage.setItem("whale-moe:floatX", String(floatX));
      env.localStorage.setItem("whale-moe:floatY", String(floatY));
    });

  const marker = (root) => ({
    align: root.getAttribute("data-dsh-whale-align"),
    valign: root.getAttribute("data-dsh-whale-valign"),
    anchor: root.style.getPropertyValue("--dsh-whale-anchor"),
    left: Number.parseFloat(root.style.left),
    top: Number.parseFloat(root.style.top),
  });

  /* ① 拖到最左：位置被钳在 8px */
  const leftRoot = (await atPosition(-50, 600)).document.querySelector("[data-dsh-whale-root]");
  assert.ok(leftRoot, "贴左时桌宠必须仍然挂载");
  let m = marker(leftRoot);
  assert.equal(m.left, 8, "贴左时桌宠应被钳到距边 8px");
  assert.equal(m.align, "left", "桌宠中心距左边缘小于弹出层半宽时必须写入 align=left");
  assert.equal(m.valign, null, "y=600 上方空间充足,不应写入 valign");
  assert.equal(m.anchor, "108px", `小三角应指回桌宠中心(8+200/2),实测 ${m.anchor}`);

  /* ② 拖到最右：位置被钳在 1440-200-8 = 1232 */
  const rightRoot = (await atPosition(9e9, 600)).document.querySelector("[data-dsh-whale-root]");
  let mr = marker(rightRoot);
  assert.equal(mr.left, VIEW_W - MASCOT - 8, "贴右时应被钳到 1232");
  assert.equal(mr.align, "right", "桌宠中心距右边缘小于弹出层半宽时必须写入 align=right");
  /* 右对齐时面板贴右缘，桌宠中心距面板右缘同样是 100(半宽)+8(边距) = 108，
     与左侧对称——两边小三角都应精确指回桌宠中心，不是"贴到角落"。 */
  assert.equal(mr.anchor, "108px", `右对齐时小三角距右缘应为 108(半宽100+边距8),实测 ${mr.anchor}`);

  /* ③ 贴顶：向上弹出的空间不足，必须改为向下 */
  const topRoot = (await atPosition(600, -50)).document.querySelector("[data-dsh-whale-root]");
  const mt = marker(topRoot);
  assert.equal(mt.top, 8, "贴顶时桌宠应被钳到 8px");
  assert.equal(mt.valign, "below", "顶部距屏幕顶小于 220px 时必须写入 valign=below");
  assert.equal(mt.align, null, "x=600 处于中部,不应写入 align");

  /* ④ 居中：不得留下任何标记（否则会污染正常位置的样式） */
  const centerRoot = (await atPosition(600, 400)).document.querySelector("[data-dsh-whale-root]");
  const mc = marker(centerRoot);
  assert.equal(mc.align, null, "居中位置不得残留 align 标记");
  assert.equal(mc.valign, null, "居中位置不得残留 valign 标记");
  assert.equal(mc.anchor, "", "居中位置不得残留锚点变量");

  /* ⑤ CSS 侧必须真的消费这些标记：规则缺失时上面的标记全是死代码 */
  assert.match(CSS_TEXT, /\[data-dsh-whale-align="left"\][^{]*\[data-dsh-whale-bubble\]/, "CSS 缺少 align=left 的气泡规则");
  assert.match(CSS_TEXT, /\[data-dsh-whale-align="right"\][^{]*\[data-dsh-whale-prefs\]/, "CSS 缺少 align=right 的面板规则");
  assert.match(CSS_TEXT, /\[data-dsh-whale-valign="below"\][^{]*\[data-dsh-whale-prefs\]/, "CSS 缺少 valign=below 的面板规则");
  assert.match(CSS_TEXT, /--dsh-whale-anchor/, "CSS 未使用 --dsh-whale-anchor 变量");
  assert.equal(VIEW_H > 0, true);
});
