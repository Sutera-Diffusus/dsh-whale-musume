import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* issue #23：右键菜单贴底被窗口边缘裁掉。
   原实现把高度写死成 160（真实高度 268 / 204），现在改为量真实尺寸 + 翻转 + 钳制。
   这里切出真正的 placeMenu 实现来跑。 */
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(rootDir, "assets", "dsh-whale-moe.js"), "utf8");

function extractRegion(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `could not extract region ${startMarker}`);
  return source.slice(start, end);
}

const region = extractRegion("  var MENU_MARGIN = 8;", "  function showContextMenu(x, y) {");
const placeMenu = new Function(`${region}\nreturn placeMenu;`)();

const VIEW = { w: 1000, h: 800 };

test("空间充足时按光标位置摆放", () => {
  assert.deepEqual(placeMenu(120, 200, 180, 204, VIEW.w, VIEW.h), { left: 120, top: 200 });
});

test("贴右下角右键（issue #23 复现路径）：菜单整体留在视口内", () => {
  const spot = placeMenu(980, 700, 180, 268, VIEW.w, VIEW.h);
  assert.equal(spot.left, VIEW.w - 180 - 8, "右侧收进 8px 边距");
  assert.equal(spot.top, 700 - 268 - 8, "下方放不下就翻到光标上方");
  assert.ok(spot.top + 268 <= VIEW.h, "菜单底部不再越界");
});

test("下方放不下且上方也放不下时，底部对齐视口（仍然完整可见）", () => {
  const spot = placeMenu(40, 100, 180, 268, 1000, 300);
  assert.equal(spot.top, 300 - 268 - 8);
  assert.ok(spot.top >= 8 && spot.top + 268 <= 300);
});

test("菜单高度随开关变化：6 项 / 9 项 / 10 项都不会越界（旧常量 160 会裁掉 44-180px）", () => {
  for (const height of [204, 306, 340]) {
    const spot = placeMenu(980, 790, 180, height, VIEW.w, VIEW.h);
    assert.ok(spot.top + height <= VIEW.h, `height ${height} 越界: top=${spot.top}`);
    assert.ok(spot.top >= 8, `height ${height} 顶到上边缘: top=${spot.top}`);
  }
});

test("极小视口下仍受 8px 边距钳制，不会出现负坐标", () => {
  const spot = placeMenu(5, 5, 180, 268, 200, 120);
  assert.ok(spot.left >= 8 && spot.top >= 8, JSON.stringify(spot));
});

test("量不到尺寸（stub / 未挂载）时回落到 180x340 保守值", () => {
  const spot = placeMenu(980, 790, 0, 0, VIEW.w, VIEW.h);
  assert.ok(spot.top + 340 <= VIEW.h, "回落高度按最坏情况（开小游戏 + 尺寸项 10 项）处理");
  assert.equal(spot.left, VIEW.w - 180 - 8);
});

test("源码层面：不再写死 160/180，改为量真实尺寸", () => {
  assert.equal(source.includes("root.innerHeight - 160"), false, "旧的写死高度必须消失");
  assert.equal(source.includes("root.innerWidth - 180"), false, "旧的写死宽度必须消失");
  assert.ok(source.includes("menu.getBoundingClientRect()"), "菜单必须量真实尺寸后再定位");
  assert.ok(source.includes("placeMenu(x, y,"), "定位必须走 placeMenu");
});
