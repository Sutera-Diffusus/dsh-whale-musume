# v2.5.1 · 兼容 DSH 0.2.1-rc.3～0.2.2-rc.1 + 修透明隐身

发布时间：2026-11-06 · [完整改动](https://github.com/Sutera-Diffusus/dsh-whale-musume/compare/v2.5.0...v2.5.1)

---

## 为什么有这个版本

DSH 在 v2.5.0（10-22）之后连发了 `0.2.1-rc.3`（10-23）、`rc.4`（10-28）、`rc.5`（10-30）和 `0.2.2-rc.1`（11-04）。鲸鱼娘的安装门禁还停在 `0.2.1-rc.2`，于是：

- 装 `0.2.1-rc.3` 之后的任何一个 DSH，插件市场/`dsh plugin add` 都会报「引擎不匹配」——[#32](https://github.com/Sutera-Diffusus/dsh-whale-musume/issues/32) 里 [@MaizioO123](https://github.com/MaizioO123) 拿两台机器实测证明 rc.3 上完全可用，只是被门禁挡住；之后 [#36](https://github.com/Sutera-Diffusus/dsh-whale-musume/issues/36) 又有人报了 rc.5，评论里已经出现「去 PR 里自己拉取来改吧」。
- npm 上只有 `2.5.0` 一个正式版本，没有低版本可回退；也就是说**所有装新 DSH 的用户，安装成功率是 0**。

这个版本就干两件事：把门禁改成按版本线放行，并修掉一个用户已经定位到代码行的 bug。

## 兼容性

`engines.dsh`：

```text
>=0.1.0-rc.6 <0.2.0-rc.1 || 0.2.0-rc.2 || >=0.2.1-rc.1 <0.2.3-0
```

| 宿主 | 2.5.1 的态度 |
|---|---|
| 旧版 Web `0.1.0-rc.6` 起的 `0.1.x` | 继续放行（`0.1.1-rc.2`、`0.1.2-rc.1` 仍为 `compatible`） |
| 桌面端 `0.2.0-rc.2` | 继续放行；这是隔离 profile 上实机验收过的版本 |
| `0.2.1` 全线（`rc.1`～`rc.5`，以及未来的 `rc.6` / 正式版） | `compatible`（rc.1 / rc.2 为此前静态契约结论；rc.3～rc.5 依据上游发布说明 + tag 源码核对 + 单元测试） |
| `0.2.2` 全线（`alpha.2` / `alpha.3` / `rc.1`，以及未来的 rc/final） | 放行；`rc.1` 标 `compatible`（本机 `app.asar` DOM 标记扫描），两个 alpha 标 `unknown` |
| `0.2.3` 起的未知线 | `engines.dsh` 拒绝 |

> 说明：`compatible` 的依据是**静态契约核对 + 单元测试（0.2.2-rc.1 另加本机 app.asar 扫描）**，不是真实 Electron 桌面端的视觉复跑。`0.2.3-alpha` 被刻意挡在 `<0.2.3-0` 之外，避免下一个大版本 alpha 在未核对时被自动放进来。

## 修复：关掉看板娘再打开，角色透明隐身

[discussion #34](https://github.com/Sutera-Diffusus/dsh-whale-musume/discussions/34)（[@ysss110](https://github.com/ysss110)）给了精确的复现与定位：齿轮菜单里把「看板娘」关掉再打开，只剩一个透明线框，只有拖拽进入 pick-up 姿势时才闪一下。

根因在两处模块级状态与 DOM 脱节：

1. `removeRoot()` 只摘 DOM，没有复位 `layerState`。重新打开时 `ensureRoot()` 生成全新的 `<img>`，但 `setPose()` 看到 `layerState.loaded[active] === src`（旧缓存）就直接 `return`，新节点永远拿不到 `src` 与 `dsh-whale-active`。
2. 即使不经过 `removeRoot()`，宿主/调试工具直接摘掉根节点后重挂，也会命中同一个早退。

修法：

- `removeRoot()` 里复位 `layerState`（`active`、`loaded`、`pendingSwap`、`pendingSince`），并让 `gen` 自增，作废旧换图动画的完成回调；
- `setPose()` 的早退条件增加 DOM 复核：缓存说「已加载」时，还要确认当前活动层真的带同样的 `src` 和 `dsh-whale-active`，否则重放一次。

新增 2 项零浏览器回归测试（`test/v251-fixes.test.mjs`）：关闭再打开、宿主强删根节点后重挂载。两项在未修复版本上都会失败，修复后通过。

## 文档与素材

- README 中英文首屏换成待机动图，GIF 由 [@kingOfSoySauce](https://github.com/kingOfSoySauce) 录制（[PR #37](https://github.com/Sutera-Diffusus/dsh-whale-musume/pull/37) / [#38](https://github.com/Sutera-Diffusus/dsh-whale-musume/issues/38)），已收进仓库 `docs/images/preview-idle-loop.gif`。原 PR 把整份 README 从 CRLF 重写成 LF 且外链到第三方仓库，这里只取动图本身，重排与热链都不合入。
- 兼容表与 npm 核验版本号同步更新。

## 验证

- `npm test`（`node --test test/*test.mjs`）**205/205 通过**（203 → 205，新增 2 项重挂载回归）。
- `test/dsh-engines.test.mjs` 同步更新：放行 `0.2.1-rc.3` / `rc.4` / `rc.5` / `0.2.1` 正式版 / `0.2.2-alpha.2` / `alpha.3` / `rc.1` / `rc.2` / `0.2.2`，拒绝 `0.2.3-alpha.1` / `0.2.3` / `0.3.0`。
- **没有**在真实 Electron 桌面端做视觉复跑；0.2.2-rc.1 的契约结论来自本机 `D:\DeepSeekHarnessDesktop\resources\app.asar` 的 DOM 标记扫描。

## 升级

```powershell
# 桌面端：先 remove 再 add（add 不覆盖已安装版本）
$env:ELECTRON_RUN_AS_NODE = "1"
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop remove dsh-whale-musume
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop add dsh-whale-musume
```

装完**重启桌面端应用**（不是刷新页面）。养成数据在宿主 origin 的 `localStorage` 里，重装不丢。

npm 包页：<https://www.npmjs.com/package/dsh-whale-musume>。也可以直接用本页资产 `dsh-whale-musume-plugin-v2.5.1.zip` 按本地路径安装。

> 镜像同步提示：npmmirror 上可能短暂显示 `0.0.0-stage`（发布占位版本），不要装它；在插件管理器把 Registry 切到 **npm 官方源**，或等镜像同步。官方源核验：`npm view dsh-whale-musume version --registry=https://registry.npmjs.org` 应为 `2.5.1`。

## English

v2.5.1 is a compatibility + bugfix release.

- **Install gate relaxed to version lines**: `engines.dsh` is now `>=0.1.0-rc.6 <0.2.0-rc.1 || 0.2.0-rc.2 || >=0.2.1-rc.1 <0.2.3-0`. v2.5.0 stopped at `0.2.1-rc.2`, so every user on DSH `0.2.1-rc.3` / `rc.4` / `rc.5` / `0.2.2-rc.1` was blocked at install time (issue #32 / #36), and npm only had `2.5.0`. The compatibility matrix now covers `0.2.1-rc.3`–`rc.5` and `0.2.2-rc.1`; the two `0.2.2-alpha` builds are allowed by the range but marked `unknown`.
- **Fix: mascot turned invisible after toggling it off and on** (discussion #34). `removeRoot()` never reset the module-level `layerState`, so after remounting `setPose()` early-returned on a stale cache entry and the new `<img>` never received a `src`. `removeRoot()` now resets the cache (and bumps `gen` to invalidate in-flight swap callbacks), and `setPose()` additionally validates the live DOM before early-returning. Two zero-browser regression tests were added.
- README hero image replaced with an idle-loop GIF recorded by [@kingOfSoySauce](https://github.com/kingOfSoySauce) (PR #37) and vendored into the repo; the PR's CRLF→LF rewrite and external hotlink were not merged.

`npm test`: **205/205**. No live Electron visual re-run; the 0.2.2-rc.1 contract conclusion comes from scanning the local `app.asar`.

MIT, local-first, no telemetry.
