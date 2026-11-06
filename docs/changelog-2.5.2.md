## v2.5.2 (2026-11-06)

### 新增

- **手机 / 触屏支持**：触摸拖拽（每次拖拽只量一次包围盒，移动时 `preventDefault`，手机上不再卡顿）；长按 500ms 打开右键菜单，移动超过阈值或抬手取消；窄屏（≤600px）默认 130px。
- **桌宠大小**：设置 → 看板娘 → 桌宠大小，80–240px 滑块；「自适应」恢复默认（窄屏 130 / 桌面 200）。仅悬浮形态生效，设置面板打开时桌宠固定 120px，关掉设置就能看到新尺寸。右键菜单同时新增「桌宠尺寸 ⇄ 切换」。
- 关闭触摸长按时的浏览器原生图片菜单（`-webkit-touch-callout` / `-webkit-user-drag`）。

### 修复

- **长按在手机上几乎不可用**（[PR #35](https://github.com/Sutera-Diffusus/dsh-whale-musume/pull/35) 合入后的复查修复）：计时器会被任意一次 `pointermove` 清掉（手指轻微抖动就再也弹不出菜单）；非悬浮形态（auto / bar / side / mini）没有 `dragState`，长按完全没有菜单入口。现在只在移动超过阈值时取消，并补齐所有形态的入口与 `pointerup` / `pointercancel` 清理，多指时只认主指针。
- **尺寸读取不再裸读 localStorage**：存储被禁（SecurityError）时，表现层与设置面板都回落到默认尺寸，不会把桌宠打进 failed 态；自定义值统一限制在 80–240（此前设置面板与表现层允许到 300，与滑块上限 240 不一致）。
- 右键菜单的保守高度从 306 更新到 340（新增「桌宠尺寸」项）。

### 工程

- 桌宠尺寸解析抽成 core 的纯函数 `resolveFloatSize(rawSize, viewportWidth)`，表现层与设置面板共用同一套边界。
- **205 → 209 项测试**：新增 4 项（轻微抖动仍能长按 / 非悬浮形态长按可用 / 拖动超过阈值取消 / `resolveFloatSize` 真值表）。

### 社区

- 感谢 [@ymf2317-tech](https://github.com/ymf2317-tech) 的触屏支持（[PR #35](https://github.com/Sutera-Diffusus/dsh-whale-musume/pull/35)），合入后补了长按与尺寸的修正。
