# 桌面端适配验收报告（dsh-whale-musume v2.2.0 × DSH 0.2.0-rc.2）

**日期**：2026-09-29
**被测对象**：`dsh-whale-musume` v2.2.0（本项目；代码基线 = 上游 v2.1.0 + 本次桌面端适配）
**宿主**：DeepSeek Harness Desktop（Electron 壳，内嵌 DSH **0.2.0-rc.2**，desktop profile，GUI `127.0.0.1:19387`）
**验收环境**：隔离 profile（`.qa/home/profiles/web`，自建、端口 19388，**不触碰 `D:\DeepseekHarness_Data`**）
**结论**：✅ 通过 —— 桌宠在 0.2.0-rc.2 上完成安装、加载、可见、可交互、零控制台错误；单元测试 **142 项全绿**（上游 108 + 桌面端契约回归 34）；两轮一次性 headless 浏览器验收 25/25 全绿。

---

## 1. 验收项与结果

| # | 验收项 | 方法 | 结果 |
|---|---|---|---|
| 1 | 包能被 0.2.0-rc.2 接受并装入 profile | `pnpm add <tarball>`（等价 CLI `plugin add`） | ✅ 装入 `node_modules`，`bundles` 含 `dsh-whale-musume` |
| 2 | 客户端 bundle 进入宿主启动图 | 拉取 index，解析 `window.__DSH_BOOT__` | ✅ 行 `{"id":"dsh-whale-musume","url":"plugins/??dsh-whale-musume/client.js&rev=…"}` |
| 3 | bundle 可获取且仍是「只注册 factory」 | HTTP GET 该 URL | ✅ 200 / `text/javascript` / 34,783 B / 含 `__ModuleLoader__.load` |
| 4 | 三段资源经宿主只读路由供给 | HTTP GET `/api/dsh-whale-musume/assets?f=…` | ✅ css 23,719 / core 100,862 / presenter 139,913（v2.1.0 打包后）/ calibration 498 全部 200 |
| 5 | 立绘（webp）经同一路由供给 | HTTP GET `…f=generated/…webp` | ✅ 200 / `image/webp` / 191,986 B |
| 6 | 桌宠真的挂到宿主 DOM 上 | CDP：`[data-dsh-whale-root]` | ✅ 1 个，`.dsh-whale-layer` 2 层，立绘 `img.complete && naturalWidth>0` |
| 7 | 桌宠可见且尺寸正常 | CDP：`getBoundingClientRect` / `display` | ✅ 200×200、`display:block`、`position:fixed` |
| 8 | 状态机与表现层都起来 | CDP：`DshWhaleMoeCore` / `__dshWhaleMoeStarted` / `__dshWhaleMoeDebug` | ✅ `state:"idle"`、`pose:"idle-cute"`、`view:"home"` |
| 9 | 零控制台错误 / 零未捕获异常 | CDP `Runtime.consoleAPICalled` + `exceptionThrown` | ✅ 全程 0 |
| 10 | 无外部网络请求（无遥测承诺） | CDP `performance.getEntriesByType('resource')` 过滤跨域 | ✅ 0 条 |
| 11 | 主题跟随（桌面端新契约） | CDP：改 `body[data-ds-dark-theme]` / `html[data-ds-theme-source]` | ✅ 空串→`data-wm-theme=dark`；移除+`light`→`light` |
| 12 | 设置面板打开时的行为 | CDP：注入/移除 `[data-shortcut-modal="settings"]` | ✅ `view=settings` 切到右下 mini（上游 v2.1.0 约定，不再整体隐藏）→ 关闭后 `view=home` 恢复正常尺寸 |
| 13 | 工具运行联动（工作姿态） | CDP：注入 `[data-tool][data-state=running]` | ✅ `state:"tool"`、`pose:"running"`；移除后保持窗口内不闪回，随后回 `idle` |
| 14 | 单元测试 | `npm.cmd test` | ✅ **142 / 142 pass，0 fail，0 skip** |
| 15 | 离线契约断言（零浏览器） | `node --test test/desktop-client.test.mjs` | ✅ 32 / 32 pass |

浏览器验收明细：`tools/cdp-verify-whale.mjs` **16/16**、`tools/cdp-contract-whale.mjs` **9/9**（合计 25/25）。

---

## 2. 本轮修掉的三个真问题（都是 0.2.0-rc.2 上实测复现的）

### 2.1 首页被误判成设置页 → 桌宠永久隐藏（严重）

- **现象**：CDP 首轮验收 `view:"settings"`、`display:none`、尺寸 0×0 —— 她在桌面端**根本不出现**。
- **根因**：0.2.0-rc.2 在「无主会话 / 主会话空白」时会自动弹出一个引导弹窗（OnboardingModal，`role="dialog"`）。旧选择器 `VIEW_SELECTORS.settings = '[role="dialog"], [data-slot="settings.header"]'` 把它当成设置页，而 `resolveLayout()` 在 `view === "settings"` 时直接返回 `{hidden:true}`。
- **证据**：`dsh-client-ui-settings-models/lib/client.js` 渲染 `primitives.Modal`（`role="dialog" aria-modal="true"`，无 `data-shortcut-modal`）；真正的设置面板根是 `dsh-client-ui-settings-general/lib/client.js:290` 的 `data-shortcut-modal="settings"`。
- **修法**：`settings` 判据改为 `[data-shortcut-modal="settings"], [data-slot="settings.header"]`。
- **回归保护**：单测 h1 / i4（含「还原旧选择器即复现 `view:"settings"`」的牙齿验证）。

### 2.2 冷启动头几秒误判「工作态」（体验）

- **现象**：页面刚加载时 `state:"tool"`、`pose:"running"`，并说出工具台词（首轮 CDP 与 DOM 桩都复现）。
- **根因**：`memory.toolGoneAt` 初值 `0`，首个 reconcile 走 `collectSignals()` 的「首次下沿」分支 `if (wasRawTool || !memory.toolGoneAt) memory.toolGoneAt = now;`，于是 `now - toolGoneAt < goneHold(4s/8s)` 恒真。
- **修法**：`toolGoneAt` / `thinkingGoneAt` 初值改为 `-1`（远期过去），首屏稳定停在待机。
- **回归保护**：单测 h4。

### 2.3 无效的资源路径改写（卫生）

- **现象**：`lib/client.js` 对 presenter 做 `var ANIM_ROOT = "/assets/anim/";` 的 `replace`，但 presenter 从来没有 `ANIM_ROOT` 常量 —— 永不命中的死代码（`assets/anim/*.webm` 三个未跟踪实验素材无人引用）。
- **修法**：删除该 `replace`，保留说明注释；`ASSET_ROOT` 与 `peek-calibration.json` 两处有效改写保留。
- **回归保护**：单测 d3。

### 2.4 顺带修正的契约（不修也不会崩，但会导致姿势/markup 猜错）

- 工具信号：`[data-role="tool"]` / `[data-tool="true"]` / `[data-tool-card="true"]` 在 0.2.0-rc.2 **全库 0 命中** → 改用 `[data-tool]`（值=工具名）+ 同元素 `data-state`，并新增活信号 `[data-chat-running]`。
- 删掉 `toolVisible()` 里「chat node 内的 `data-state="running"` 视为历史卡片」的排除：该语义已反转（现在只有正在跑的推理块才带 `running`，收尾会翻 `ok`），旧排除会把**所有运行中的工具卡过滤掉**并降级成 thinking。
- 输入框：`[data-slot="conversation.composer.bar"] textarea` → contenteditable `[data-composer-input]`（保留 `[data-composer-card="true"]` 锚点与旧 textarea 兜底）。
- 主题：明暗只写在 `body[data-ds-dark-theme]`（**空串**表示暗），`html[data-ds-theme-source]` 取 `light|dark|system`；旧 `data-theme` / dark class / 系统偏好全部保留为回落。
- 引导时机：`boot()` 从 `apply(ctx)` 移进 factory 物化期，符合 0.2.0-rc.2「惰性 CJS：副作用在物化时发生」的契约。

---

## 3. 已知差异与不迁移项（不是缺陷）

1. **桌面端 origin 是 `dsh-app://app`**，与旧 Web（`http://127.0.0.1:3080`）的 `localStorage` 不互通。桌面端第一次打开是全新养成数据；本版**未提供**旧数据迁移工具。
2. **外观与旧版 Web 有一点差异**：桌面端把 `<html>` / `<body>` 的主题属性命名改了（见 2.4），已适配；但宿主侧 token（`--dsw-*`）如有调整，气泡/菜单配色会跟随宿主，属预期。
3. **未在真实 desktop profile 上执行安装**：按用户指示，先在隔离 profile 完成验证；真实 desktop profile 的安装与重启由用户决定时机（步骤见 `docs/desktop-0.2.0-rc.2-deploy.md`）。
4. **未做长时间 soak**（旧版 `npm run qa:soak` 需要浏览器与长跑）：本轮以两轮一次性 CDP 验收替代，未覆盖 60s 压测。
5. `npm run qa`（`motion-qa` / `cdp-whale-moe`）仍指向旧版 0.1.x 宿主的假设，**未在桌面端重跑**；桌面端验收由新增的 `tools/cdp-verify-whale.mjs` 与 `tools/cdp-contract-whale.mjs` 承担。

---

## 4. 复现步骤

```powershell
# 1) 单元测试（零浏览器/零服务器）
Set-Location D:\DeepseekHarness_WorkSpace\Project_dsh_musume
npm.cmd test                                        # 期望 142/142

# 2) 起隔离宿主（不碰生产数据）
$env:ELECTRON_RUN_AS_NODE = "1"
$env:DSH_HOME = "D:\DeepseekHarness_WorkSpace\Project_dsh_musume\.qa\home"
& "D:\DeepseekHarnessDesktop\DeepSeek Harness.exe" --expose-internals .qa\boot-host.mjs web 19388
# 打印 READY <url with token>

# 3) 一次性 headless 验收（单实例、前台、跑完 taskkill 整树 + 删临时 profile）
node tools/cdp-verify-whale.mjs   --url "<上一步的 url>" --timeout 90000   # 期望 16/16
node tools/cdp-contract-whale.mjs "<上一步的 url>"                        # 期望 9/9
```

---

## 5. 资源纪律自检（R8）

- 浏览器：全程 **2 个 headless Edge 实例的 3 次前台运行**（每轮单实例、前台、自带硬超时；收尾 `taskkill /PID <pid> /T /F` 整树 + 删 `%TEMP%\dsh-whale-*` 临时 profile）。中期由队友发现一组我遗留的孤儿（snapshot 脚本的 PID 归属根进程），**已整树清掉并删除其固定名 profile**，随后把该脚本改为时间戳 profile + 退出钩子。
- 后台 job 峰值：2（QA 宿主 1 + 会话内其他操作），未超 R7 上限。
- 本地服务器：仅 1 个隔离 QA 宿主（19388），验收结束后关闭。
- 未启动任何生产进程、未杀 DSH 本体、未动 `D:\DeepseekHarness_Data` 任何文件。
- 进程计数（收工）：`chrome` 8 / 581 MB（OMP 守护，非本任务）、`msedge` 23 / ~2.0 GB（用户自身浏览器）、`msedgewebview2` 12 / 844 MB（GUI 基线）、`node` 1。
