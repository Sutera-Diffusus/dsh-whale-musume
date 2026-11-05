/**
 * v2.5.0 接线自检：只做「源码/资产/常量是否真的连上」的断言，
 * 翻牌与存档的纯逻辑分别由 whale-moe-memory / whale-moe-portable 覆盖。
 * 这里不启动浏览器、不联网。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCore } from "./load-core.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const core = loadCore();
const presenter = fs.readFileSync(path.join(rootDir, "assets", "dsh-whale-moe.js"), "utf8");
const client = fs.readFileSync(path.join(rootDir, "lib", "client.js"), "utf8");
const css = fs.readFileSync(path.join(rootDir, "assets", "dsh-whale-moe.css"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

test("v2.5.0 成就总数为 45：39 项既有 + 翻翻乐 4 + 百天/一年 2", () => {
  assert.equal(core.ACHIEVEMENTS.length, 45);
  const ids = core.ACHIEVEMENTS.map((item) => item.id);
  for (const id of ["memory-first", "memory-clear", "memory-perfect", "memory-combo6", "day100", "day365"]) {
    assert.ok(ids.includes(id), `缺少成就 ${id}`);
  }
  assert.equal(new Set(ids).size, ids.length, "成就 id 不允许重复");
});

test("翻翻乐面池全部有对应立绘文件", () => {
  assert.ok(core.MEMORY_FACES.length >= core.MEMORY.PAIRS);
  for (const face of core.MEMORY_FACES) {
    const file = path.join(rootDir, "assets", "generated", "dsh-whale-state-" + face + ".webp");
    assert.ok(fs.existsSync(file), `面池里的 ${face} 没有立绘文件`);
  }
});

test("presenter：翻翻乐面板、右键入口、结算与存档热重载都接上了", () => {
  for (const needle of [
    'data-dsh-whale-memory',
    'function openMemoryGame',
    'function endMemoryGame',
    'function renderMemoryPanel',
    '小游戏：鲸鱼翻翻乐',
    'core.memoryNewState',
    'core.memoryFlip',
    'core.memoryTick',
    'core.memoryResult',
    'core.evaluateMemoryAchievements',
    'save-import',
    'growth-reset',
    '__dshWhaleMoeVersion = "2.5.1"',
    '{ id: "day100", days: 100 }',
    '{ id: "day365", days: 365 }',
    'readStoredNumber("mood"',
    'readStoredNumber("satiety"'
  ]) {
    assert.ok(presenter.includes(needle), `presenter 缺少 ${needle}`);
  }
  assert.equal(presenter.includes('Number(root.localStorage.getItem("whale-moe:mood")) ||'), false, "0 值不能被 `|| 默认值` 吞掉");
});

test("client：设置面板有跨端迁移入口，导入后广播 save-import", () => {
  for (const needle of [
    'MascotPortableCard',
    '跨端迁移',
    '导出存档',
    '导入存档',
    '复制迁移码',
    '导入迁移码',
    'portableBuild',
    'portableParse',
    'portableCode',
    'save-import',
    'memory-first',
    'day100'
  ]) {
    assert.ok(client.includes(needle), `client 缺少 ${needle}`);
  }
});

test("CSS：翻翻乐棋盘具备翻转/配对/暂停/结算与减弱动效样式", () => {
  for (const needle of [
    '[data-dsh-whale-memory]',
    '[data-dsh-whale-memory-grid]',
    'dsh-whale-memory-flipped',
    'dsh-whale-memory-matched',
    '[data-dsh-whale-memory-paused]',
    '[data-dsh-whale-memory-overlay]',
    'prefers-reduced-motion',
    'forced-colors'
  ]) {
    assert.ok(css.includes(needle), `css 缺少 ${needle}`);
  }
});

test("版本号与迁移 schema 对齐", () => {
  assert.equal(pkg.version, "2.5.1");
  assert.equal(core.PORTABLE.SCHEMA, "dsh-whale-musume/save");
  assert.equal(core.PORTABLE.VERSION, 1);
});
