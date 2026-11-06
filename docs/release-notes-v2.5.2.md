# v2.5.2 · 手机触屏支持 + 桌宠大小

发布时间：2026-11-06 · [完整改动](https://github.com/Sutera-Diffusus/dsh-whale-musume/compare/v2.5.1...v2.5.2)

---

## 这个版本做了什么

v2.5.1 修的是「装不上」和「隐身」，这个版本把社区 PR [#35](https://github.com/Sutera-Diffusus/dsh-whale-musume/pull/35) 的触屏支持收进来，并在合入后补了一轮修正。

### 1. 手机 / 触屏

- **触摸拖拽**：每次拖拽只量一次包围盒，移动时 `preventDefault`，手机上不再因为逐帧 reflow 而卡顿。
- **长按菜单**：长按 500ms 打开右键菜单（手机没有右键）；手指移动超过阈值或抬手就取消，不会误触。
- **窄屏尺寸**：≤600px 的视口默认 130px，桌宠不再占掉半屏。
- 关掉了长按触发的浏览器原生图片菜单（`-webkit-touch-callout` / `-webkit-user-drag`）。

### 2. 桌宠大小可调

设置 → 看板娘 → **桌宠大小**：80–240px 滑块，「自适应」恢复默认（窄屏 130 / 桌面 200）。右键菜单也新增「桌宠尺寸 ⇄ 切换（小/中/大/自适应）」。

两点已知行为，免得以为是 bug：

- **仅悬浮形态生效**。auto / bar / side / mini 是按宿主布局自动排的，尺寸由布局决定。
- 设置面板打开时桌宠固定 120px（设置页约定），**关掉设置后**才能看到新尺寸。

### 3. 合入 PR #35 后补的修正

审查发现原实现有两个会直接毁掉触屏体验的问题，已在本版修掉：

- **长按被抖动吃掉**：`onDrag` 里无条件 `clearTimeout`，哪怕手指只抖 1px、甚至 pointermove 坐标没变，500ms 长按也永远到不了。
- **非悬浮形态没有菜单入口**：长按回调依赖 `dragState`，而 `dragState` 只在悬浮形态创建；auto / bar / side / mini 下手机用户完全打不开菜单。
- 另外：尺寸读取此前裸读 `localStorage`（存储被禁时会把桌宠打进 failed 态），且设置面板/表现层允许 300 与滑块上限 240 不一致。现在统一为 80–240，并抽出 core 纯函数 `resolveFloatSize`，存储异常一律回落默认。

## 兼容性

`engines.dsh` 与 2.5.1 完全一致：

```text
>=0.1.0-rc.6 <0.2.0-rc.1 || 0.2.0-rc.2 || >=0.2.1-rc.1 <0.2.3-0
```

| 宿主 | 态度 |
|---|---|
| `0.2.1` 全线（rc.1～rc.5 及以后） | 放行，`compatible`（静态契约 + 单测） |
| `0.2.2-rc.1` | 放行，`compatible`（本机 `app.asar` DOM 标记扫描） |
| `0.2.2-alpha.2` / `alpha.3` | 放行但标 `unknown` |
| 旧版 Web `0.1.x` | 放行（`0.1.0-rc.6` 起） |
| `0.2.3` 起的未知线 | 拒绝 |

## 验证

- `npm test`（`node --test test/*test.mjs`）**209/209 通过**（205 → 209）。
- 新增 4 项零浏览器回归：轻微抖动仍能长按 / 非悬浮形态长按可用 / 拖动超过阈值取消 / `resolveFloatSize` 真值表。
- **没有**在真实手机或 Electron 桌面端做触摸视觉验收；长按与尺寸的结论来自 DOM 桩上的事件与时序断言。

## 升级

```powershell
# 桌面端：先 remove 再 add（add 不覆盖已安装版本）
$env:ELECTRON_RUN_AS_NODE = "1"
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop remove dsh-whale-musume
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop add dsh-whale-musume
```

装完**重启桌面端应用**（不是刷新页面）。养成数据在宿主 origin 的 `localStorage` 里，重装不丢。

npm 包页：<https://www.npmjs.com/package/dsh-whale-musume>。也可以直接用本页资产 `dsh-whale-musume-plugin-v2.5.2.zip` 按本地路径安装。

## English

v2.5.2 ships the community touch support from PR [#35](https://github.com/Sutera-Diffusus/dsh-whale-musume/pull/35), plus fixes found during review.

- **Mobile / touch**: touch dragging (bounding box sampled once per drag, `preventDefault` while moving), 500 ms long-press opens the context menu (cancelled by movement or release), and a 130 px default size on ≤600 px viewports.
- **Mascot size**: Settings → Mascot → Mascot size, an 80–240 px slider with an "auto" reset (130 px on narrow screens, 200 px on desktop). Floating mode only; the settings page keeps the mascot at 120 px, so close Settings to see the new size. Also available from the right-click menu.
- **Fixes after PR #35**: any `pointermove` used to clear the long-press timer (a 1 px jitter was enough to kill it); non-floating modes (auto / bar / side / mini) had no menu entry at all for touch users; the size was read from `localStorage` without a guard and the settings slider allowed up to 300 while the presenter allowed 300 too — both now share an 80–240 range through `core.resolveFloatSize`.
- `npm test`: **209/209**. No live phone or Electron visual check; behaviour is covered by DOM-stub event/timing tests.

MIT, local-first, no telemetry.
