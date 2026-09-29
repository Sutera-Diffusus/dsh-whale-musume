# v2.2.0 — DeepSeek Harness 桌面端适配（DSH 0.2.0-rc.2）

本版在 **v2.1.0 之上叠加桌面端适配**，上游功能（MiMo TTS 台词播报、弹窗可见性修复、`slots` inject、余额币种修复）全部保留；旧版 Web（0.1.x）行为不变。**两者都支持。**

## ✨ 适配

- **客户端模块惰性 CJS 契约**：引导时机移到 factory 物化期（`boot()` 从 `apply()` 移入 factory 体内），`apply()` 只保留 MiMo TTS 桥接与设置面板注册。
- **DOM 契约更新**（选择器只增不减，旧宿主行为不受影响）
  - 工具卡：`[data-tool]`（值 = 工具名）+ 同元素 `data-state`，其中只有 `running` / `preparing` 算「正在工作」—— 卡片完成后仍留在 DOM 里（`ok` / `stopped` / `error`），按存在性匹配会让桌宠被历史卡片**永久钉在工作态**。
  - 新增会话运行标记 `[data-chat-running]`；终端块 `[data-terminal]`；输入框是 contenteditable `[data-composer-input]`（不再是 `textarea`）。
- **主题属性**：桌面端明暗写在 `body[data-ds-dark-theme]`（**属性值为空串表示暗色**），主题来源在 `html[data-ds-theme-source]`（`light` / `dark` / `system`）；旧版 `data-theme` / `dark` class 识别保留为回落。
- **设置面板判据**：改用 `[data-shortcut-modal="settings"]`。
- **兼容性声明**：`dsh.compatibility.dshReleases` 新增 `0.2.0-rc.2: "compatible"`。

## 🐛 修复

- **桌面端首页被误判为设置页**：刷新后常驻的引导弹窗（OnboardingModal）同样是 `role="dialog"`，旧判据会误命中；配合 v2.1.0 起的右下角 mini 形态（不再整体隐藏），本版把判据收敛到真正打开的面板根。
- **冷启动头几秒误判工作态**：`toolGoneAt` 初值 `0` 会被「首次下沿」分支当作刚消失的工作信号，导致首屏摆出 running 并念工具台词；初值改为远期过去（`-1`）。
- **清理死代码**：删除永不命中的 `ANIM_ROOT` 资源路径改写。

## 🧪 测试与文档

- 单元测试 **108 → 142 全绿**（新增 34 项桌面端契约与回归断言，跑 `npm test`）。
- 新增文档：`docs/desktop-0.2.0-rc.2-contract.md`（契约审计，逐条带证据）、`docs/desktop-0.2.0-rc.2-deploy.md`（部署/回滚/卸载手册）、`docs/desktop-0.2.0-rc.2-acceptance.md`（验收报告）。
- 新增验收工具：`tools/dom-stub.mjs`（零浏览器 DOM 桩）、`tools/cdp-verify-whale.mjs`、`tools/cdp-contract-whale.mjs`、`tools/asar.mjs`。

## ✅ 验收方式

在**隔离 profile**（自建 QA home，端口 19388，不触碰生产数据）上完成安装、加载与 DOM 契约验收；一次性 headless CDP：**基础 16/16 + 契约 10/10** 全绿，零控制台错误、零外部网络请求。

## ⚠️ 桌面端注意

桌面端主窗口的文档 origin 是 `dsh-app://app`（不是 `http://127.0.0.1:<端口>`），与旧版 Web 的 `localStorage` **不互通**，因此桌面端首次打开是全新状态（悬浮位置 / 养成数据 / 开关偏好 / 成长日记不会自动迁移）。安装或更新后需重启桌面端（或由 HMR 接住）。

安装步骤见 [docs/desktop-0.2.0-rc.2-deploy.md](docs/desktop-0.2.0-rc.2-deploy.md)。

## 📦 安装

```powershell
# 桌面端（Electron 壳）
$Desktop = "D:\DeepseekHarnessDesktop"
$Cli = "$Desktop\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js"
$env:ELECTRON_RUN_AS_NODE = "1"
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop add github:Sutera-Diffusus/dsh-whale-musume
```

```powershell
# 旧版 Web profile
dsh plugin --profile web add github:Sutera-Diffusus/dsh-whale-musume
```

**完整变更**：[CHANGELOG.md](CHANGELOG.md) · **契约与迁移细节**：[docs/desktop-0.2.0-rc.2-contract.md](docs/desktop-0.2.0-rc.2-contract.md) · **版本更新栏**：[README › 版本更新](README.md#版本更新)

---

## What's Changed

* 适配 DeepSeek Harness 桌面端（DSH 0.2.0-rc.2）：惰性 CJS 引导时机、DOM 契约、主题属性、设置面板判据 by @Sutera-Diffusus in `6b2d752`
* 修复首屏误判工作态（`toolGoneAt` 初值）与历史工具卡钉住忙态 by @Sutera-Diffusus in `6b2d752`
* 单元测试 108 → 142 全绿；新增桌面端契约文档与零浏览器/一次性 CDP 验收工具 by @Sutera-Diffusus in `6b2d752`
* README 增加「版本更新 / Version History」栏与桌面端章节 by @Sutera-Diffusus in `6076947`
* 新增 `.github/release.yml`：Release 更新日志分类规则 by @Sutera-Diffusus in `6076947`

**Full Changelog**: https://github.com/Sutera-Diffusus/dsh-whale-musume/compare/v2.1.0...v2.2.0
