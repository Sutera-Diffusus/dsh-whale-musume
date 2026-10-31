/**
 * DSH 0.2.1 兼容性声明回归。
 *
 * 自 0.2.1-alpha.4 起，安装与 profile 启动优先用顶层 engines.dsh
 * （semver，includePrerelease: true）；未声明才回落 @deepseek-ai/dsh* peer。
 * 本包没有 DSH peer，不声明 engines.dsh 就等于「任何版本都放行」。
 *
 * 下面的比较器只覆盖本包这一条范围的语法（`||`、精确版本、`>=A <B`），
 * 预期真值表用 semver@7.8.5（与 dsh-v0.2.1-rc.2 的 app-boot 相同主版本）
 * 在 includePrerelease: true 下核对过。改范围时两张表必须一起改。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const presenter = readFileSync(new URL("../assets/dsh-whale-moe.js", import.meta.url), "utf8");
const client = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

const RANGE = ">=0.1.0-rc.6 <0.2.0-rc.1 || 0.2.0-rc.2 || 0.2.1-rc.1 || 0.2.1-rc.2 || 0.2.1-rc.3";

/** @returns {{major:number,minor:number,patch:number,pre:string[]|null}|null} */
function parse(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] === undefined ? null : match[4].split("."),
  };
}

function cmpIdent(left, right) {
  const leftNum = /^[0-9]+$/.test(left);
  const rightNum = /^[0-9]+$/.test(right);
  if (leftNum && rightNum) {
    const diff = Number(left) - Number(right);
    return diff < 0 ? -1 : diff > 0 ? 1 : 0;
  }
  if (leftNum !== rightNum) return leftNum ? -1 : 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function cmp(left, right) {
  const a = parse(left);
  const b = parse(right);
  if (a === null || b === null) return null;
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  if (a.pre === null && b.pre === null) return 0;
  if (a.pre === null) return 1;
  if (b.pre === null) return -1;
  const length = Math.max(a.pre.length, b.pre.length);
  for (let i = 0; i < length; i += 1) {
    if (i >= a.pre.length) return -1;
    if (i >= b.pre.length) return 1;
    const diff = cmpIdent(a.pre[i], b.pre[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 与 DSH `semver.satisfies(version, range, { includePrerelease: true })` 对齐的子集。 */
function satisfies(version, range) {
  if (parse(version) === null) return false;
  return range.split("||").some((part) => {
    const clause = part.trim();
    const pair = /^>=(\S+)\s+<(\S+)$/.exec(clause);
    if (pair) {
      const lower = cmp(version, pair[1]);
      const upper = cmp(version, pair[2]);
      return lower !== null && upper !== null && lower >= 0 && upper < 0;
    }
    return cmp(version, clause) === 0;
  });
}

test("package 版本是 2.5.0，且 engines.dsh 是字符串范围", () => {
  assert.equal(pkg.version, "2.5.0");
  assert.equal(typeof pkg.engines?.dsh, "string", "engines.dsh 不是字符串时，0.2.1 会把整个清单判为格式错误并拒绝安装");
  assert.equal(pkg.engines.dsh, RANGE);
  assert.equal(pkg.dsh.client.platform, "web");
  assert.deepEqual(pkg.dsh.client.inject, ["slots"]);
});

test("dshReleases 保留旧矩阵，并标明 0.2.1-rc.1 / rc.2 / rc.3", () => {
  const releases = pkg.dsh.compatibility.dshReleases;
  assert.equal(releases["0.1.1-rc.2"], "compatible");
  assert.equal(releases["0.1.2-alpha.4"], "unknown");
  assert.equal(releases["0.1.2-alpha.5"], "unknown");
  assert.equal(releases["0.1.2-rc.1"], "compatible");
  assert.equal(releases["0.2.0-rc.2"], "compatible");
  assert.equal(releases["0.2.1-rc.1"], "compatible");
  assert.equal(releases["0.2.1-rc.2"], "compatible");
  assert.equal(releases["0.2.1-rc.3"], "compatible");
  assert.match(pkg.dsh.compatibility.note, /尚未在真实 Electron/);
});

test("engines.dsh 放行已支持的 0.1.x、0.2.0-rc.2 与 0.2.1 rc", () => {
  for (const version of [
    "0.1.0-rc.6",
    "0.1.0",
    "0.1.1-rc.1",
    "0.1.1-rc.2",
    "0.1.2-alpha.4",
    "0.1.2-alpha.5",
    "0.1.2-rc.1",
    "0.1.7-rc.2",
    "0.2.0-rc.2",
    "0.2.1-rc.1",
    "0.2.1-rc.2",
    "0.2.1-rc.3",
  ]) {
    assert.equal(satisfies(version, pkg.engines.dsh), true, `${version} 应被 engines.dsh 放行`);
  }
});

test("engines.dsh 拒绝未核对的相邻版本，避免把未知宿主标成可装", () => {
  for (const version of [
    "0.1.0-rc.5",
    "0.2.0-rc.1",
    "0.2.0",
    "0.2.1-alpha.1",
    "0.2.1-alpha.5",
    "0.2.1",
    "0.2.2",
    "0.3.0",
  ]) {
    assert.equal(satisfies(version, pkg.engines.dsh), false, `${version} 不应被 engines.dsh 放行`);
  }
  assert.equal(satisfies("0.2.2.0", pkg.engines.dsh), false, "非法版本串按不满足处理");
});

test("0.2.1 复核过的 DOM 标记仍在表现层，且没有改去注册模型名 slot", () => {
  for (const marker of [
    '[data-shortcut-modal="settings"]',
    '[data-slot="conversation.chat.node"]',
    "[data-chat-running]",
    "[data-terminal]",
    '[data-tool][data-state="running"]',
    '[data-tool][data-state="preparing"]',
    "[data-composer-input]",
    "data-ds-dark-theme",
  ]) {
    assert.ok(presenter.includes(marker), `表现层丢掉了 0.2.1 仍有效的标记 ${marker}`);
  }
  assert.equal(
    (presenter.match(/conversation\.input\.model\.label/g) ?? []).length,
    1,
    "模型名 slot 只允许出现在「本插件不注册」的注释里，不能进选择器",
  );
  assert.doesNotMatch(presenter, /inject\(["']conversation\.input\.model\.label/);
  assert.match(client, /name:\s*"settings\.section"/);
  assert.match(client, /id:\s*"mascot"/);
  assert.equal(client.includes("conversation.input.model.label"), false);
});
