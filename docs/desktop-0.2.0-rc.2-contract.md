# DSH 0.2.0-rc.2 桌面端契约审计（鲸鱼娘适配事实清单）

> 审计对象：`D:\DeepseekHarnessDesktop\resources\app.asar`（桌面壳 `@deepseek-ai/dsh-desktop@0.2.0-rc.2`，内嵌 `dsh` 运行时）
> 用途：为 `lib/client.js`（客户端插件半边）、`lib/index.js`（宿主半边）、`assets/dsh-whale-moe.js`（DOM 呈现层）的适配提供**可直接照做**的事实依据
> 审计方式：纯静态读 asar（`tools/asar.mjs` + `_reference/desktop-0.2.0-rc.2/_audit/{rd,scan,ctxscan}.mjs` 内存扫描），零浏览器、零服务器
> 证据约定：`包名/文件:行号` = asar 内该文件的行号；`@偏移` = 压缩单行文件内的字符偏移

---

## 0. 结论速查

| # | 契约项 | 结论 | 一句话 |
|---|---|---|---|
| 1.1 | `dsh.client.platform` 必须为 `"web"` | ✅ 仍有效 | 取值不等于 `"web"` 的包被直接跳过 |
| 1.2 | `exports["./client"]` 必需 | ✅ 仍有效 | 缺则启动即抛错 |
| 1.3 | 必须预构建 `lib/client.js` 实体文件 | ✅ 仍有效 | 宿主启动时同步 `readFileSync` 快照 |
| 1.4 | `window.__ModuleLoader__.load({id,factory})` 唯一注册入口 | ✅ 仍有效 | 且 `id` 必须等于包名 |
| 1.5 | `require("react")` / `require("react/jsx-runtime")` | ✅ 可用 | 平台种子表里有 |
| 1.6 | 第三方插件可被 `dsh-client-modules` 扫到 | ✅ 可以 | 扫的是 Loader 条目，与厂商无关 |
| 1.7 | `dsh.compatibility.dshReleases` 兼容性声明 | ❌ 失效 | 本版本代码零引用；门在 `peerDependencies` |
| 1.8 | 鲸鱼娘在 desktop profile 已安装 | ❌ 没有 | `profiles/desktop` 的 bundles 里没有它 |
| 2.1 | `settings.section` slot | ✅ 仍有效 | 现在由 `dsh-client-ui-settings-general` 声明并渲染 |
| 2.2 | `settings.mascot.item`（插件自声明子 slot） | ✅ 模式仍有效 | 与宿主 `settings.general.item` 完全同构 |
| 2.3 | `slots.inject(name, cb)` | ✅ 仍有效 | 声明感知，塌缩会销毁、再声明会重跑 |
| 2.4 | `slots.register(options, component)` | ⚠️ 形状微变 | list 必填 `id`；同名二次声明**抛错**；`label` 可为函数 |
| 2.5 | settings 面板渲染包 | ⚠️ 换包 | `ui-settings` 退化为领域底座，面板壳在 `ui-settings-general` |
| 2.6 | `dsh-client-ui-settings-shell` 的语义 | ⚠️ 完全变了 | 现在是「终端执行器」设置页，不是设置面板壳 |
| 2.7 | `[data-slot="sidebar.settings"]` | ✅ 仍在 | 但内部按钮已变成账户菜单 |
| 2.8 | `[data-slot="settings.trigger"]` | ❌ 桌面端不渲染 | `settings.launcher` 被 AccountMenu 占用 |
| 2.9 | 「设置面板已打开」判据 | ❌ `[role="dialog"]` 不可用 | 唯一可靠 = `[data-shortcut-modal="settings"]`（引导弹窗是同款 `role=dialog`） |
| 3.1 | `[data-slot="conversation.chat.node"]` | ✅ 仍有效 | 每个聊天气泡/工具的 outlet 锚点 |
| 3.2 | `[data-slot="conversation.composer.bar"] textarea` | ❌ 输入框不是 textarea | 换成 `[data-composer-input][contenteditable]` |
| 3.3 | `[data-slot="sidebar.settings"] button` | ⚠️ 语义变了 | 现在是账户菜单按钮 |
| 3.4 | `[data-running]` | ✅ 仍有效 | `[data-terminal][data-running]` = 终端块运行中 |
| 3.5 | `[data-state="ongoing"]` | ✅ 仍有效 | `StateDot` 转圈点（含终端运行中） |
| 3.6 | `[data-state="running"]` | ⚠️ 语义反转 | 0.2.0-rc.2 里结束会翻成 `"ok"`，**是**可用的活信号 |
| 3.7 | `[aria-busy="true"]` | ⚠️ 窄化 | 只剩回合导航轨的忙碌刻度 |
| 3.8 | `[data-status="pending"\|"running"\|"error"\|"success"]` | ❌ 基本失效 | 只剩 Todo 面板 `pending\|in_progress\|completed` |
| 3.9 | `[data-role="tool"]` / `[data-tool="true"]` / `[data-tool-card="true"]` | ❌ 全失效 | 替代：`[data-tool]`（值=工具名） |
| 3.10 | `pre` | ✅ 仍有效 | 命令卡与 markdown 代码块 |
| 3.11 | `[data-slot="terminal"]` | ❌ 不存在 | 替代：`[data-terminal]` |
| 3.12 | `[data-phase="session"]` | ❌ 失效 | `data-phase` 的值是 `settling\|hero\|active` |
| 3.13 | `[class*="stream" i]` | ❌ 失效 | 替代：`[data-streaming]` / `[data-shimmer]` |
| 3.14 | 新增可用：`[data-chat-running]` | ➕ 最佳活信号 | 会话运行中才挂载 |
| 3.15 | 新增可用：`[data-tool][data-state="running"\|"preparing"]` | ➕ 工具运行中 | 精确到工具名 |
| 3.16 | 新增可用：`[data-turn-process]` | ⚠️ 反向语义 | **回合结束后**才出现，不能当忙碌信号 |
| 4.1 | `data-theme` 属性 | ❌ 不存在 | 明暗 = `body[data-ds-dark-theme]` |
| 4.2 | 主题根元素约定 | ⚠️ 变了 | `html[data-ds-theme-source=light\|dark\|system]` + `body[data-ds-dark-theme]`（值恒为空串） |
| 4.3 | localStorage 命名空间 | ⚠️ origin 变了 | 桌面端 origin = `dsh-app://app`，旧 Web 的 `whale-moe:*` 不会带过来 |
| 5.0 | 插件路由前缀 | ❌ 不能落在 `/assets/` | 壳内 dist 抢答，永远到不了 webServer；鲸鱼娘的 `/api/…` 安全 |
| 5.1 | `webServer.register({kind:'exact',path,handler})` | ✅ 仍有效 | handler 是 `(req,res)` |
| 5.2 | `ctx.inject(['webServer'], ...)` | ✅ 仍有效 | `dsh-client-modules` 自己就这么用 |
| 5.3 | 桌面端真的启用了 webServer | ✅ 是 | `--port 19387`，并 `collectIndexInjections()` |

---

## 1. 运行环境事实基线

| 事实 | 值 | 证据 |
|---|---|---|
| 桌面壳包名/版本 | `@deepseek-ai/dsh-desktop` `0.2.0-rc.2` | `/package.json:2,4`（asar 根） |
| 桌面壳入口 | `lib/main.js`（Electron 主进程，490 KB） | `/package.json:8` |
| 内嵌 dsh 运行时根 | asar 内 `/dsh`，其 `package.json` 为 dsh 本体 | `/dsh/package.json`，`dsh-package.json.full` |
| DSH home | `D:\DeepseekHarness_Data\.dsh`（`DSH_HOME`） | `.dsh\profiles\{acp,desktop,headless,web}` 存在 |
| 桌面 profile 名 | `desktop` | `dsh-desktop-host/lib/index.js:225` |
| 桌面侧启动参数 | `["--no-open","--port","19387"]` | `dsh-desktop-host/lib/index.js:231-235` |
| 宿主 URL | `http://127.0.0.1:${ctx.webServer.port}`（带认证 token） | `dsh-desktop-host/lib/index.js:337` |
| **渲染载体 origin** | **`dsh-app://app`**（自定义 scheme，不是 `http://127.0.0.1:19387`） | `/lib/main.js`：`protocol.registerSchemesAsPrivileged([{scheme:"dsh-app",privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true,codeCache:true}}])` @435928；`protocol.handle("dsh-app", …)` @456515 |
| `/assets/**` 的去向 | **由壳内打包的 dist 直接服务，不经过 webServer** | `/lib/main.js` @456515：`url.hostname === "app"` 且 pathname 为 `/`、`/index.html`、`/assets/**`、`/favicon.svg`、`/manifest.webmanifest` → `serveWebDocument(request, <dsh-web-frontend>/dist)`；其余 → `forwardWebRequest(request, hostUrl, hostCookie)` 反代到 webServer |
| 反代来源校验 | `origin` 必须是 `dsh-app://app`（否则 403） | `/lib/main.js` `forwardWebRequest` @305946 |
| 窗口 session | Electron 默认 session（主窗口未指定 `partition`） | `/lib/main.js` `function createWindow(preload, show = false, primary = false)` @438554，`webPreferences` 无 `partition` |
| 桌面 profile 的 bundles | `@deepseek-ai/dsh-base`、`dsh-web-app`、`dsh-experimental-agent-team-profile`、`dsh-experimental-auto-review` | `D:\DeepseekHarness_Data\.dsh\profiles\desktop\package.json:7-12` |
| 鲸鱼娘是否在桌面 profile | **不在** | 同上（用户 patch 层 `cordis.patch.yml` 也没有它的条目） |
| 旧 web profile（对照） | 把 `dsh-whale-musume` 写进了 `dependencies` 与 `dsh.profile.bundles` | `.dsh\profiles\web\package.json:7,17` |

> 桌面端的「Web 载体」与旧版 Web 是同一套客户端代码：`dsh-web-app` bundle 挂 `frontend-static` 的 fallback 座位，用 `ctx.webServer.renderIndex()` 渲染 index（`dsh-web-app/lib/index.js:8,32`；`dsh-host-frontend-static/lib/index.js:81-97`）。所以「Web 版能跑」的插件机制在桌面端原则上都还在，**变的是包名分工、DOM 标记和主题属性**。
>
> ⚠️ 但**文档 origin 变了**：主窗口加载的是 `dsh-app://app/…`，壳通过 `protocol.handle("dsh-app", …)` 把非 `/assets/**` 的请求反代到 `http://127.0.0.1:<port>`（见上表）。对本插件的三条硬影响：
> 1. `localStorage` 的 key 空间挂在 `dsh-app://app` 下 → 旧 Web origin 的 `whale-moe:*` **不会**带过来（见 §5.3）。
> 2. 插件的路由路径**不能落在 `/assets/` 前缀下** —— 那条前缀被壳内打包的 dist 吞掉，永远到不了 `webServer`。鲸鱼娘用 `/api/dsh-whale-musume/assets` → ✅ 安全。
> 3. 反代会校验 `Origin: dsh-app://app`，同源 `fetch("/api/…")` 天然满足；`privileges.stream:true` 也保证了流式响应可用。

---

## 2. 客户端插件装入契约（对应任务问题 1）

### 2.1 `dsh.client` 字段形状 ✅ 仍有效

**唯一校验器**（宿主与 roster 生成器共用）：

```js
// dsh-client-modules/lib/index.js:61-75
function parseDshClient(pkgName, value) {
  if (value === void 0) return void 0;
  if (typeof value !== "object" || value === null) throw ...
  if (typeof decl.platform !== "string") throw new Error(`client-modules: ${pkgName} dsh.client.platform must be a string`);
  const inject = optionalStringArray(pkgName, "dsh.client.inject", decl.inject);
  const external = optionalStringArray(pkgName, "dsh.client.external", decl.external);
  if (decl.immediately !== void 0 && typeof decl.immediately !== "boolean") throw ...
  return { platform, inject?, external?, immediately? };
}
```

形状与现版**完全一致**：`{ platform: string, inject?: string[], external?: string[], immediately?: boolean }`。

**`platform` 必须恰好是 `"web"`**，否则整个包装作非客户端包被静默跳过：

```js
// dsh-client-modules/lib/index.js:713-717
const decl = parseDshClient(packageName, dsh !== null && typeof dsh === "object" ? dsh.client : void 0);
if (decl === void 0 || decl.platform !== "web") { this.pkgMeta.set(sourceKey, null); return null; }
```

鲸鱼娘现状 `package.json:34-36` `"client": { "platform": "web" }` → ✅ 无需改动。

- `inject`：额外的包 id 列表，强制先到达（`dsh-client-modules/lib/client.js:656-659`）。
- `external`：构建期外部依赖声明，请求别的包的行（`:650-655`）；**不能声明自己**（`lib/index.js:426-428` 会抛错）。
- `immediately`：`true` 进「立即预取档」，由外壳 `prefetchImmediateTier()` 提前拉（`dsh-web-frontend/dist/assets/index-5SrrfWpU.js` @630925）。

### 2.2 `exports["./client"]` 必需 ✅ 仍有效

```js
// dsh-client-modules/lib/index.js:170-180
function clientExportOf(pkgName, exportsField) {
  const client = exportsField["./client"];
  if (client === void 0) return void 0;
  if (typeof client === "string") return client;
  if (typeof client === "object" && client !== null) { const fallback = client.default; ... }
  throw new Error(`client-modules: ${pkgName} exports["./client"] must be a string or an object with a string default`);
}
// :718-719
const clientRel = clientExportOf(packageName, pkg.exports);
if (clientRel === void 0) throw new Error(`client-modules: ${packageName} declares dsh.client but exports no "./client" bundle`);
```

鲸鱼娘 `package.json:15` `"./client": "./lib/client.js"` → ✅ 无需改动（字符串形式被接受）。

### 2.3 必须预构建 `lib/client.js` 实体文件 ✅ 仍有效

宿主在**注册表构造期**同步读整个 bundle 进内存（不是按 URL 懒读）：

```js
// dsh-client-modules/lib/index.js:811-817
initialBundleSnapshot(pkgName, clientPath) {
  try { const baseline = this.captureArtifactBaseline(clientPath); return { bundle: readFileSync(clientPath), baseline }; }
  catch (error) { if (error.code !== "ENOENT") throw error; ... }
}
```

缺失 → `MissingClientBundleError` → 归入组合失败并**整体 loud throw**（`:135`、`:542-544`）。所以「临时编译/TS 源码」不行，必须是现成的 JS 产物。鲸鱼娘 `lib/client.js`（37 KB，手写 CJS 风格）满足。

bundle 内容本身也有硬约束（`:168-169`）：只接受 `client.<hash>.js` 这类相对 chunk 名做按需加载。

### 2.4 `window.__ModuleLoader__.load({id, factory})` 仍是唯一注册入口 ✅

宿主往 `<head>` 注入的 queue facade 原文：

```js
// dsh-client-modules/lib/index.js:453-475
window.__ModuleLoader__={
  mode:"queue", pendingQueue,
  load(registration){pendingQueue.push(registration)},
  create(options){ ... const index=pendingQueue.findIndex(r=>r.id==="@deepseek-ai/dsh-client-modules") ... }
}
```

客户端执行 bundle 后**逐个校验「这个 URL 是否用 `__ModuleLoader__.load` 注册了 id」**，否则判失败：

```js
// dsh-client-modules/lib/client.js:625
failures.push(`${url}: loaded without registering "${id}" via __ModuleLoader__.load`);
// :739
if (!this.factories.has(id)) throw new Error(`client-modules: bundle ${url} loaded without registering "${id}" via __ModuleLoader__.load`);
```

约定原文见 `dsh-client-modules/lib/client.js:17`：「…factory (`window.__ModuleLoader__.load({id, factory})`); every module body…」。

⚠️ **`id` 必须是包名，不能是自定义别名。** 图行 id 取自 `packageName`（`lib/index.js:720-728`），且 `require("<id>/client")` 会剥掉 `/client` 后缀再查表（`:98-100`）：

```js
function stripClientSuffix(spec) { return spec.endsWith("/client") ? spec.slice(0, -7) : spec; }
```

鲸鱼娘 `lib/client.js:15` `id: "dsh-whale-musume"` 与 `package.json:2` `name` 一致 → ✅ 无需改动。

### 2.5 `factory(require)` 能 require 到什么 ✅

`require` 的解析顺序（`dsh-client-modules/lib/client.js:698-706`）：平台种子表 → 已物化模块 → 已注册包工厂 → 抛错。

**平台种子表**（外壳 Vite bundle 里的 `rM()`，`dsh-web-frontend/dist/assets/index-5SrrfWpU.js` @628285，原文）：

```js
function rM(){return{
  "react":Ef, "react/jsx-runtime":If, "react-dom":Rf, "react-dom/client":Df,
  "@deepseek-ai/cordis":sf, "@deepseek-ai/dsh-client-store":lh,
  "@deepseek-ai/dsh-client-ui-slots":hh, "@deepseek-ai/dsh-client-ui-primitives":sE,
  "@deepseek-ai/dsh-client-ui-dockkit":XS
}}
```

→ 鲸鱼娘 `lib/client.js:20-23` 的 `require("react")`、`require("react/jsx-runtime")` ✅ 可用。
→ 想用 UI 原语，应 `require("@deepseek-ai/dsh-client-ui-primitives")`（该包**没有** `lib/client.js`，是共享库名，见 `_reference/…/dsh-client-ui-primitives/package.json`）。

### 2.6 第三方插件能否被 `dsh-client-modules` 扫到 ✅ 能

扫的**不是**某张内置白名单，而是 **Cordis Loader 的全部条目**：

```js
// dsh-client-modules/lib/index.js:525-544
constructor(ctx) {
  super(ctx, "clientModules");
  ctx.on("internal/plugin", (fiber) => {            // 运行期新增插件也会进 dirty 集合
    const entryName = fiber.entry?.options.name;
    if (entryName === void 0) return;
    this.dirty.add(entryName); ... this.flush(...);
  });
  for (const entry of ctx.loader.entries()) this.dirty.add(entry.options.name);   // ← 启动期全量扫
  this.composed = this.compose();
  ...
  if (failures.length > 0) throw new ClientPackageCompositionError(failures);
```

包清单定位走 Loader 解析（`locatePkgJson`，`:743-773`），既支持包名 specifier，也支持路径 / `file:`（`nearestPackage` 向上找最近的 `package.json`，`:774-790`；`exactPackageSpecifier` 只接受裸包名，`:82-88`）。

**结论**：只要第三方插件作为 Loader 行真的被挂载（`dsh.profile.bundles` 或 profile `cordis.patch.yml` 的 `insert`），且 manifest 满足 2.1–2.3，它的客户端半边就会被扫到、组合进 `window.__DSH_BOOT__` 并加载。

### 2.7 兼容性门槛 ⚠️ 换了字段（重要）

`dsh.compatibility.dshReleases`（鲸鱼娘 `package.json:37-44` 声明了 `0.1.1-rc.2 / 0.1.2-alpha.4 / 0.1.2-alpha.5 / 0.1.2-rc.1`）在 0.2.0-rc.2 **全代码库零引用**（对 `_reference/desktop-0.2.0-rc.2/**` 全量 grep `dshReleases` / `dsh.compatibility` → 0 命中）。

真正的门是 **`peerDependencies`**：

```js
// dsh-app-boot/lib/index.js:286-302
function evaluatePluginCompatibility(manifest, exemptions = {}, runtimeVersion = getDshRuntimeVersion()) {
  if (!Object.hasOwn(fields, "peerDependencies")) return void 0;      // ← 没有 peer 依赖 = 不设门
  for (const [name, range] of Object.entries(dependencies)) {
    if (name !== "@deepseek-ai/dsh" && !name.startsWith("@deepseek-ai/dsh-")) continue;
    ... if (!semver.satisfies(runtimeVersion, requirement, { includePrerelease: true })) peers[name] = range;
  }
```

豁免落在 **profile 目录的 `compatibility.json`**（`dsh-app-boot/lib/index.js:328` `PROFILE_COMPATIBILITY_FILENAME = "compatibility.json"`，读取 `:404-410`，写入 `:421-441`；`dsh plugin allow-version` / 插件管理器可授权）。

**适配动作**：
- 鲸鱼娘当前**没有** `peerDependencies` → `evaluatePluginCompatibility` 返回 `undefined` → 不阻塞加载。✅
- 但请在 `package.json` 里补 `peerDependencies: { "@deepseek-ai/dsh": "^0.2.0-rc.2" }` 之类的显式声明，让「装错版本」在启动时 loud 失败，而不是运行时炸；同时删掉已失效的 `dsh.compatibility.dshReleases`（或保留但注明无效）。
- 桌面 profile 的 `compatibility.json` 目前**不存在**，需要豁免时用 `dsh plugin allow-version` 生成。

### 2.8 装入方式（桌面端）✅ 双面包模型未变

鲸鱼娘 `cordis.patch.yml` 只做一件事：

```yaml
# cordis.patch.yml:7-9
- insert:
    - id: dsh-whale-musume
      name: dsh-whale-musume
```

宿主半边（`lib/index.js`，`main` 字段）与客户端半边（`exports["./client"]`）由**同一个包名**两个面提供 —— 这正是 `dsh-client-modules` 文档里说的 "dual-face package"（`lib/index.js:104-105`）。

桌面端要装上，二选一：
1. 在 `%DSH_HOME%\profiles\desktop\package.json` 的 `dependencies` 加上包，并把包名追加进 `dsh.profile.bundles`（与 `profiles/web/package.json:7,17` 同构）；bundle 的 `cordis.patch.yml` 会被自动叠加（`dsh-app-boot/lib/index.js:468-481,920-955`）。
2. 或直接在 `%DSH_HOME%\profiles\desktop\cordis.patch.yml` 追加同一条 `insert` 条目（该文件已是用户的 patch 层，现有 7 处 `- id:/name:` 条目可照抄格式）。

---

## 3. slot 契约（对应任务问题 2）

### 3.1 `slots.register(options, component)` 的 options 形状 ⚠️ 微变

```js
// dsh-client-ui-slots/lib/index.js:163-243（纯核心；运行时包装在 ui-renderer）
register(options, component) {
  const rec = this.records.get(options.name);
  if (!rec?.spec) throw new Error(`slot "${options.name}" is not declared (a parent entry's children table must declare it)`);
  switch (spec.kind) {
    case "single": ... throw new Error(`single slot "${options.name}" already has a registration ...`);
    case "keyed":  if (options.key === void 0) throw ... ; // 同 key 同 priority 重复 → 抛错
    case "list":   if (options.id  === void 0) throw new Error(`list slot "${options.name}" requires options.id`);
    case "chain":  if (options.select === void 0) throw ...;
  }
  if (options.children) for (const childKey of Object.keys(options.children)) {
    const childRec = this.records.get(childKey);
    if (childRec?.spec) throw new Error(`slot "${childKey}" is already declared (by ${childRec.declaredBy ?? "an unknown entry"})`);
  }
```

- 认可的字段：`name`（必填）、`key`（keyed 必填）、`id`（list 必填）、`order`、`label`、`priority`、`select`（chain 必填）、`inject`、`children`、`store`、`locale`、`registrant`（`:204-219`）。
- `label` **可以是函数**（跟随 locale），读数用 `resolveSlotLabel`（`:27-29`）。
- list 排序 = `priority` 升序 → `order` 升序（`:221`）。
- **⚠️ 新增的硬约束**：`options.children` 里声明一个**已被声明过**的键会抛错（`:191-194`，`registerFactory` 同规则 `:78-81`）。鲸鱼娘自声明的 `settings.mascot.item` 是私有键，不冲突；但**不要**试图声明宿主的键（例如 `settings.trigger`）来抢渲染权。
- 运行时包装：`register = ctx.effect(() => this._register(options, component), "slots.register()")`（`dsh-client-ui-renderer/lib/client.js:1788-1791`）→ 注册随 fiber 卸载自动回收。

### 3.2 `slots.inject(name, cb)` ✅ 语义一致且更明确

```js
// dsh-client-ui-renderer/lib/client.js:1343-1402（要点）
inject(key, callback) {
  const disposeController = ctx.effect(() => {
    ...
    const reconcile = () => {
      const spec = this._core.specDynamic(key);
      const epoch = this._core.declarationEpoch(key);
      if (active !== void 0 && activeEpoch === epoch) return;
      dispose?.(); if (spec === void 0) return;
      const disposeEffect = ctx.effect(callback, `slots.inject(${JSON.stringify(key)}): declaration`);
      ...
    };
    unsubscribe = this._core.subscribeDeclaration(key, changed);
    try { reconcile(); } catch (error) { stop(); throw error; }   // 已声明 → 同步执行
```

- 声明已存在 → **同步**执行 callback；未声明 → 等声明；**声明塌缩 → 销毁 contribution；再声明 → 重跑**。
- 所以「声明 + 注册」两步都写 `slots.inject` 是**正确且推荐**的写法（宿主的 `ui-settings-general` 全程这么写）。

### 3.3 组件能拿到 `props.renderSlot` 的条件 ✅ 与现版一致

组件 props 的「child-render share」只在**自身注册时声明了 `children`** 才注入：

```js
// dsh-client-ui-renderer/lib/client.js:732-740
if (entry.children !== void 0) {
  kit["renderSlot"] = boundRenderSlot(host, entry);
  if (Object.values(entry.children).some((spec) => spec.kind === "chain")) kit["renderSlotChain"] = ...;
  if (Object.values(entry.children).some((spec) => spec.scope !== "root")) { ... kit["SessionProvider"] = ...; }
}
```

调用时校验归属，越权抛 `SlotOwnershipError`：

```js
// dsh-client-ui-renderer/lib/client.js:331-333
const declared = entry.children?.[key];
if (declared === void 0) throw new SlotOwnershipError(`slot '${key}' is not declared by this entry's children`);
```

鲸鱼娘 `lib/client.js:463-465` 用 `children: { "settings.mascot.item": { kind: "list", scope: "root" } }` 声明、`lib/client.js:446` 用 `props.renderSlot("settings.mascot.item", {})` 渲染 → ✅ **模式完全有效**，且与宿主 `settings.general.item` 的写法逐字同构：

```js
// dsh-client-ui-settings-general/lib/client.js:1177-1180
children: { "settings.general.item": { kind: "list", scope: "root" } }
// :638
children: renderSlot("settings.general.item", {})
```

### 3.4 `settings.section` ✅ 仍存在（但归属包变了）

```js
// dsh-client-ui-settings-general/lib/client.js:1171-1181
ctx.slots.inject("settings.section", () => ctx.slots.register({
  name: "settings.section",
  id: "general",
  order: 0,
  label: () => t("general.nav"),
  locale: NS,
  children: { "settings.general.item": { kind: "list", scope: "root" } }
}, GeneralSection));
```

该 slot 的 spec 声明在 `sidebar.settings` 占用者的 children 表里：

```js
// dsh-client-ui-settings-general/lib/client.js:1111-1146
const disposeSlot = ctx.slots.register({
  name: "sidebar.settings", locale: NS, store: shellStore,
  children: {
    "settings.launcher": { kind: "single", scope: "root" },
    "settings.trigger":  { kind: "single", scope: "root" },
    "settings.header":   { kind: "single", scope: "root" },
    "settings.action":   { kind: "list",   scope: "root" },
    "settings.close":    { kind: "single", scope: "root" },
    "settings.section":  { kind: "list",   scope: "root" },
    "settings.onboarding": { kind: "list", scope: "root" }
  },
  inject: shellInjected
}, SettingsRoot);
```

导航行只投影 `id / order / label` 三个字段：

```js
// dsh-client-ui-settings-general/lib/client.js:1023-1028
rows = ctx.slots.entries("settings.section").map((e) => ({
  id: e.options.id ?? "", order: e.options.order ?? 0,
  label: resolveSlotLabel(e.options.label) ?? ""
})).sort((a, b) => a.order - b.order);
```

内容区**同一时刻只渲染被选中的那一节**：

```js
// dsh-client-ui-settings-general/lib/client.js:337
children: active !== void 0 && renderSlot("settings.section", { close: onClose }, { only: active })
```

### 3.5 `settings.mascot.item` ⚠️ 不是宿主内置键，但模式合法且推荐

宿主 0.2.0-rc.2 的 SlotMap 中**没有** `settings.mascot.item`（全量 slot 键枚举见附录 A）。它是鲸鱼娘**自声明**的子 slot，靠 3.1/3.3 的 `children` 机制成立 —— 这套机制在 0.2.0-rc.2 依然完整。

**结论**：`settings.mascot.item` 无需改名，可原样保留。真正的变化是**父席位**（`settings.section`）现在由 `dsh-client-ui-settings-general` 声明，而它仍然声明在 `sidebar.settings` 的 children 里、仍以 `{ only: active }` 渲染 —— 与旧版行为一致。

### 3.6 settings 面板由哪个包渲染 ⚠️ 换包（易踩）

| 包 | 0.2.0-rc.2 的真实职责 | 证据 |
|---|---|---|
| `dsh-client-ui-settings` | **领域底座**，只有宿主半边（`lib/index.js` 20 行，`ctx.settings.configure`），**没有客户端面板** | `dsh-client-ui-settings/lib/index.js:14-18`；`package.json` 无 `dsh.client` |
| **`dsh-client-ui-settings-general`** | **设置面板壳**：`sidebar.settings` 占用者、`SettingsRoot`/`SettingsPanel`、`settings.header/trigger/action/close/section/onboarding` 的声明方、通用页 | `lib/client.js:1058-1181`、`:280-341` |
| `dsh-client-ui-settings-shell` | **不是**设置面板壳！是「终端执行器」设置页（`NS="settings.shell"`，注册进 `plugins.item`） | `lib/client.js:159-190`（`ShellCardController`、`timeoutMs`/`maxOutputBytes`） |
| `dsh-client-ui-settings-plugins` | 「插件」分区宿主，渲染 `settings.plugins.tab` | `lib/client.js:68,124` |
| `dsh-client-ui-settings-account` | 占据 `settings.launcher`（侧边栏底部账户菜单）+ 注册 `settings.section id="account"` | `lib/client.js:4496-4511,1636-1788` |

> 只解出 `dsh-client-ui-settings` / `-shell` 两个包会得出「设置面板壳没了」的错误结论。**面板壳在 `-settings-general`**，该包已解到 `_reference/desktop-0.2.0-rc.2/dsh-client-ui-settings-general/`。

### 3.7 侧边栏设置入口的 DOM ❌ 选择器需重写

结构（`dsh-client-ui-sidebar/lib/client.js:399-408`，spec `:511-514` kind=single/scope=root）：

```html
<div class="…footArea">
  <div class="…footerActions"><div data-slot="sidebar.footer.action" style="display:contents">…</div></div>
  <div class="…settingsArea"><div data-slot="sidebar.settings" style="display:contents">…</div></div>
</div>
```

`sidebar.settings` 的占用者是 `SettingsRoot`（settings-general），它渲染 `settings.launcher` 并带 fallback：

```js
// dsh-client-ui-settings-general/lib/client.js:432-463
renderSlot("settings.launcher", { wide, settingsOpen: open, openSettings: actions.open, ... },
  { fallback: jsx(Tooltip, { label: t("trigger"), children: jsx("button", {
      type: "button", "aria-label": t("trigger"), "aria-haspopup": "dialog", "aria-expanded": open,
      children: renderSlot("settings.trigger", { wide })
  }}) })
```

**但 desktop profile 下 `settings.launcher` 被占用了**：

```js
// dsh-client-ui-settings-account/lib/client.js:4496-4500（无条件注册）
ctx.slots.inject("settings.launcher", () => ctx.slots.register({
  name: "settings.launcher", locale: "settings.account", inject: () => operations
}, AccountMenu));
```

而 `AccountMenu` 注册时**没有** `children` → 它无法渲染 `settings.trigger`；同时 fallback 按钮整体不挂载 → **`[data-slot="settings.trigger"]` 在 desktop profile 下不渲染**。

> 前提已核实：`settings-account` 确实在客户端花名册里 —— `dsh-web-app/cordis.patch.yml:137-138` 载入 `@deepseek-ai/dsh-client-ui-settings-account`（同文件 `:291-292` 载入 `ui-settings-general`），而 `dsh-web-app` 是桌面 profile 的 bundle 之一（`profiles/desktop/package.json:9`）。

AccountMenu 的实际 DOM：

```js
// dsh-client-ui-settings-account/lib/client.js:1707-1726
anchor: jsx("button", {
  type: "button", "data-collapsed": !wide, "data-signed-out": !signedIn,
  "aria-label": t("menu"), "aria-haspopup": "menu", "aria-expanded": open, ...
})
```

点开后弹出的菜单项（`items` 里 `id: "settings"`，`:1728-1733`）由 `Menu` 渲染为 `button[role="menuitem"]`（`dsh-client-ui-primitives/lib/index.js:4203,4237,4247,4250`，`role="menu"` 容器）。

**可替代的确定标记**：

| 用途 | 0.2.0-rc.2 可用选择器 | 元素/语义 |
|---|---|---|
| 侧边栏设置席位容器（恒在） | `[data-slot="sidebar.settings"]` | `SlotOutlet` 锚点 `<div style="display:contents">` |
| 底部账号/设置菜单按钮 | `[data-slot="sidebar.settings"] button[aria-haspopup="menu"]` | AccountMenu 触发按钮（`data-signed-out` 可判登录态） |
| 设置面板（打开后） | **`[data-shortcut-modal="settings"]`**（唯一判据） | 面板根 `<div role="dialog" aria-modal="true" data-shortcut-modal="settings">` |
| 设置面板头部席位 | `[data-slot="settings.header"]` | 面板内的 outlet（仅面板打开时存在） |
| 打开设置 | 键盘 `Ctrl+,`（desktop 默认绑定） | `dsh-client-ui-settings-general/lib/client.js:1065-1110` 注册 `settings.open` |
| 菜单里的「设置」项（点开后） | `button[role="menuitem"]`，按 textContent 匹配 | Menu 行 |

⚠️ `[data-slot="sidebar.settings"] button` 会**同时匹配** `ConnectionIndicator` 的重连按钮与 `DesktopUpdateIndicator`（settings-general:464-479），必须加 `[aria-haspopup]` 收窄。

---

## 4. DOM 信号契约（对应任务问题 3 · 最关键）

### 4.1 总原则：`data-slot` 仍由渲染器统一发出 ✅

每一个 slot outlet 都会被包一层锚点 div：

```js
// dsh-client-ui-renderer/lib/client.js:1094-1104
const ANCHOR_STYLE = { display: "contents" };
function SlotOutlet({ slotKey, ownerProps, opts }) {
  ...
  return jsx("div", { "data-slot": slotKey, style: ANCHOR_STYLE, children: renderOutletContent(...) });
}
// :1217-1219（root 同构）
return jsx("div", { "data-slot": "root", style: ANCHOR_STYLE, ... });
```

即：**只要某个 `renderSlot("<key>")` 被渲染，DOM 里就一定有 `<div data-slot="<key>" style="display:contents">`**（哪怕该 slot 暂无注册项）。

⚠️ 注意 `display:contents`：锚点自身**没有盒**，`getComputedStyle(el).display === "contents"`，鲸鱼娘的 `isVisible()` 判定「`display === "none"` 才算不可见」→ 锚点会被判为可见 ✅；但 `offsetWidth/offsetHeight` 恒为 0，**不要**用宽高判可见。

### 4.2 逐条核对 `assets/dsh-whale-moe.js:26-42`

现版原文：

```js
// assets/dsh-whale-moe.js:26-43
var VIEW_SELECTORS = Object.freeze({
  settings: '[role="dialog"], [data-slot="settings.header"]',
  workbench: '[data-slot="conversation.chat.node"], [data-phase="session"]'
});
var SIGNAL_BANKS = Object.freeze({
  thinking: ['[aria-busy="true"]', '[data-status="pending"]', '[data-state="loading"]', '[data-slot="conversation.chat.node"] [class*="stream" i]'],
  tool: ['[data-role="tool"]', '[data-tool="true"]', '[data-tool-card="true"]', '[data-status="running"]', '[data-running]', '[data-state="ongoing"]', '[data-state="running"]'],
  error: ['[data-state="error"]:not([class*="turnErrorDot"])', '[data-status="error"]', '[aria-invalid="true"]'],
  success: ['[data-state="success"]', '[data-status="success"]'],
  code: ['pre', '[data-slot="terminal"]', '[data-role="log"]', '[data-terminal]'],
  chat: ['[data-slot="conversation.chat.node"]']
});
```

#### `[data-slot="conversation.chat.node"]` ✅ 仍有效

槽声明与渲染：

```js
// dsh-client-ui-chat/lib/client.js:12390-12407（声明：keyed / session）
ctx.slots.inject("conversation.view", () => ctx.slots.register({
  name: "conversation.view", id: "chat", order: 0, locale: NS,
  children: {
    "conversation.chat.node": { kind: "keyed", scope: "session", inject: CHAT_NODE_INJECT },
    "conversation.message.images": { kind: "single", scope: "session" }
  }, store: chatStore, inject: ...
}));
// :1770（渲染：每个 flow item 一个 key）
children: renderSlot("conversation.chat.node", routedOwner, { ... })
```

**并额外确认：工具卡就在这些节点内部**（这决定了下一条的修法）：

```js
// dsh-client-ui-tool/lib/client.js:4554-4564
ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
  name: "conversation.chat.node", key: "tool-call", locale: CONVERSATION_NS,
  children: { "tool.call.toolview": { kind: "keyed", scope: "session", ... } },
  inject: toolInject
}, ToolCallTree));
```

**适配动作**：保留该选择器作为「workbench 视图」判据。但注意它现在是**数量型**指标（每个已挂载的节点一个锚点），不要把它当「有一条新消息」的可靠计数（见 §7.3）。

#### `[data-slot="conversation.composer.bar"] textarea` ❌ 输入框不是 `<textarea>`

0.2.0-rc.2 的输入框是 **Lexical contenteditable div**：

```js
// dsh-client-ui-conversation/lib/client.js:16565-16573
return jsx("div", {
  ref, contentEditable: editor !== null && editable,
  suppressContentEditableWarning: true,
  role: "textbox", "aria-multiline": "true",
  "data-composer-input": true, ...rest
});
```

外层（真正的「输入区」，带 phase/placeholder）与滚动容器：

```js
// dsh-client-ui-conversation/lib/client.js:16611-16631
jsx("div", { ref: scrollRef, className: css.scroll, "data-input-scroll": true, children:
  jsxs("div", { className: css.grow, children: [
    jsx(ComposerContentEditable, { editor, editable, className: ..., "data-phase": phase,
        "aria-disabled": editorDisabled || void 0, "data-placeholder": placeholderText,
        "aria-label": ariaLabel, ... }),
    showPlaceholder && jsx("div", { "aria-hidden": true, "data-composer-placeholder": true, children: placeholderText }),
    jsx(DecoratorPortals, { editor })
  ]})})
```

composer.bar 这个 slot 本身**仍然存在**，只是里面没有 textarea：

```js
// dsh-client-ui-conversation/lib/client.js:16287-16300（渲染）
const inputBar = renderSlot("conversation.composer.bar", { variant: hero ? "hero" : "composer", ... });
// :18294 附近（声明，见 :18159-18329 的 children 表）
name: "conversation.composer.bar"
```

整棵 composer DOM 骨架：

```js
// dsh-client-ui-conversation/lib/client.js:16322-16335
composerSeat = jsx("div", { "data-composer-seat": "", "data-conversation-region": "composer", children: composer });
// 外层
jsx("div", { "data-conversation-content": "", "data-conversation-session": sessionId,
             "data-conversation-region": "chat", "data-content-phase": phase, children: [
  jsx("div", { "data-conversation-scroll": "", children: [...] }) ]})
```

输入卡片根（**鲸鱼娘 `findComposerSurface()` 的首选分支仍然命中**）：

```js
// dsh-client-ui-conversation/lib/client.js:17441-17444
jsxs("div", { ref: cardRef, className: clsx(css.card, ...), "data-composer-card": true, ... })
```

**可替代的确定标记**（元素 / 语义）：

| 目标 | 0.2.0-rc.2 选择器 | 元素 / 语义 |
|---|---|---|
| 输入卡片（挂桌宠悬浮锚点） | `[data-composer-card="true"]` | `<div>`，整个输入卡片（含附件、工具栏、输入区） |
| 可编辑输入面 | `[data-composer-input]` | `<div contenteditable role="textbox" aria-multiline="true">`，Lexical 根 |
| 输入滚动区 | `[data-input-scroll]` | `<div>`，输入区滚动容器 |
| 输入区当前 phase | `[data-composer-input][data-phase]` | 值来自 `DraftEditor` 的 `phase` prop |
| 占位文案 | `[data-composer-placeholder]` | `aria-hidden` 的占位 div（文案同时镜像到 `data-placeholder`） |
| composer 席位 | `[data-composer-seat]` / `[data-conversation-region="composer"]` | `<div>` |
| 聊天区根 | `[data-conversation-region="chat"]` | `<div>`，同时带 `data-content-phase` |

⚠️ `[data-composer-card="true"]` 只在 conversation 包里出现 1 次（`dsh-client-ui-conversation`），是全 app 唯一的输入卡片锚点，**优先用它**。

**适配动作**：把 `findComposerSurface()` 实现改为

```js
var card = firstVisible('[data-composer-card="true"]');
if (card) return card;
var surface = firstVisible('[data-composer-input]');
return surface && surface.closest ? surface.closest("form, [class]") : null;
```

（`assets/dsh-whale-moe.js:114-119`）

#### `[data-slot="sidebar.settings"] button` ⚠️ 语义已变

见 §3.7。仍在的锚点是 `[data-slot="sidebar.settings"]`；里面的 `<button>` 现在是**账户菜单**按钮（`aria-haspopup="menu"`），不再是「设置」按钮。设置项变成了菜单里的一行（`button[role="menuitem"]`，label = 「设置」）。

**适配动作**（`assets/dsh-whale-moe.js:583-592` 的齿轮入口定位）：

```js
var host = doc.querySelector('[data-slot="sidebar.settings"]');
var btn = host && host.querySelector('button[aria-haspopup]');   // 账户/设置菜单按钮
if (!btn) btn = doc.querySelector('[data-shortcut-modal="settings"]') ? doc.querySelector('[data-slot="sidebar.settings"] button') : null;
```

并把「点击直接开设置」改为「点击打开菜单 → 再点 `button[role="menuitem"]`（文本含『设置』）」，或直接派发键盘 `Ctrl+,`（宿主已注册 `settings.open` 命令，`dsh-client-ui-settings-general/lib/client.js:1065-1110`）。

#### `[data-slot="settings.trigger"]` ❌ 桌面端不渲染

见 §3.7 的推导。它**不是**「被改名」，而是**整条 fallback 分支不挂载**。

**替代**：`[data-slot="sidebar.settings"] button[aria-haspopup]`（见上）。若需要检测「设置面板是否打开」，用 `[data-shortcut-modal="settings"]`。

#### `[data-running]` ✅ 仍有效（且语义更干净）

```js
// dsh-client-ui-primitives/lib/index.js:9369-9373（TerminalBlock 根）
return jsxs("div", {
  className: clsx(css.block, className),
  "data-terminal": "",
  "data-running": running ? "" : void 0,
  "data-body": body ? "" : void 0, ... });
```

`data-running` 是**存在性布尔**（运行时存在、结束时整个属性移除）→ 完美的活信号。

**但要注意可达范围**：`TerminalBlock` 被打进三个 bundle（`dsh-client-ui-tool`、`dsh-client-ui-jobs`、`dsh-client-ui-plugin-manager`；扫描 71 个 client bundle 得到）。终端块出现在 bash 工具卡（`dsh-client-ui-tool/lib/client.js:2505`）与 jobs 面板。

**适配动作**：把 `[data-running]` 提级为 tool bank 的**首选**信号，并优先用 `[data-terminal][data-running]` 收窄语义。

#### `[data-state="ongoing"]` ✅ 仍有效

```js
// dsh-client-ui-primitives/lib/index.js:3060-3094（StateDot）
function StateDot({ state, size, className, appearance = "dot" }) {
  const edge = size ?? (state === "ongoing" ? 14 : 10);
  if (state === "ongoing") return jsx("svg", {
    ref: syncSpinner, className: clsx(css.spinner, className),
    "data-state": "ongoing", width: edge, height: edge, viewBox: "0 0 24 24", "aria-hidden": "true", ...
  });
  return jsx("span", { className: ..., "data-state": state, ... });   // done / warning / error / idle
}
```

`state` 取值由 `props.state` 决定，文档注释写明：`done, warning, ongoing, error, idle`（`:3054`）。
`ongoing` 的实际触发点（静态可证的）：
- 终端运行中 —— `runState()` 返回 `{ state: "ongoing" }`（`primitives:9317-9327`），TerminalBlock 把它喂给 StateDot（`:9385-9388`）。
- Todo 项 `in_progress` —— `statusDotState("in_progress") === "ongoing"`（`dsh-client-ui-conversation/lib/client.js:17654-17662`），渲染于 `:17730`。
- 连接中 —— `primitives:5372`。

⚠️ 它是**小 svg 点**（`aria-hidden`），不是块级标记；`[data-state="ongoing"]` 只能回答「当前页面上有没有正在进行的活动」，不能区分类型。

**适配动作**：保留在 tool bank，但降为兜底；`thinking` 不要用它。

#### `[data-state="running"]` ⚠️ 语义**反转**（旧注释已过时）

旧注释（`assets/dsh-whale-moe.js:30-35`）说「data-state=running 不是活的 DSH 状态，历史步骤卡永久带着它」。**这在 0.2.0-rc.2 是错的**：reasoning 块会明确翻回 `"ok"`：

```js
// dsh-client-ui-chat/lib/client.js:5832-5837（ReasoningRow 根）
return jsxs("div", {
  className: ReasoningRow_module_css_default.root,
  "data-variant": "think",
  "data-state": running ? "running" : "ok",
  "data-expanded": expanded || void 0,
  "data-preview": preview || void 0, children: [...] });
```

工具卡同理，结束时变成 `"ok"` / `"error"` / `"stopped"`（见下条）。

**适配动作**：把 `[data-state="running"]` 从 `tool` bank 里**升级为首选**并**删除** `assets/dsh-whale-moe.js:1623-1625` 那条「含 `conversation.chat.node` 就跳过」的排除规则 —— 因为 0.2.0-rc.2 的**工具卡本身就在 `conversation.chat.node` 内部**（§4.2 第 1 条），那条排除会**把所有运行中的工具全部过滤掉**。

#### `[aria-busy="true"]` ⚠️ 窄化

全 71 个 client bundle 里只有一处产生 `aria-busy="true"`：

```js
// dsh-client-ui-chat/lib/client.js:3611-3618（回合导航轨的一个刻度按钮）
jsx("button", { ref: registerElement, "data-index": index, type: "button", className: classes.join(" "),
  "aria-label": t(...), "aria-current": active ? "true" : void 0,
  "aria-busy": busy ? "true" : void 0, "aria-describedby": previewId, ... })
```

（另一处 `aria-busy` 是 `dsh-client-ui-settings-plugin-inventory/lib/client.js:432` 的布尔值 `state.status === "loading"`，React 会序列化成 `aria-busy="true"|"false"`。）

**结论**：`[aria-busy="true"]` 仍在，但代表「回合导航轨上某个回合正在忙」——不是通用的「AI 正在思考」。**不要**把它当 thinking 的首选。

**替代（thinking）**：
- `[data-chat-running]`（最佳，见下）
- `[data-shimmer]`（流式文本，见下）
- `[data-streaming]`（见下）
- `[data-variant="think"][data-state="running"]`

#### `[data-status="pending"|"running"|"error"|"success"]` ❌ 基本失效

全量扫描：只有两处 `data-status`，值都不是这组语义。

```js
// dsh-client-ui-conversation/lib/client.js:17721-17725（Todo 面板展开后的 <li>）
jsx("ul", { className: ..., children: todos.map((item) => jsxs("li", {
  className: TodoPanel_module_css_default.item,
  "data-status": item.status,        // status ∈ completed | in_progress | pending
  children: [...] })) })
```

（另一处 `dsh-client-ui-workflow-run` 的 `data-status`，属工作流运行视图。）

**替代**：
- 「有任务在跑」→ `[data-chat-running]`
- 「工具在跑」→ `[data-tool][data-state="running"]` / `[data-tool][data-state="preparing"]`
- 「出错」→ `[data-tool][data-state="error"]`、`[data-error]`
- 「待办待处理」→ `[data-status="pending"]` 仍可命中 Todo 项（但 Todo 面板默认折叠、且只在 plan 模式下存在 —— 不要依赖）

#### `[data-role="tool"]` / `[data-tool="true"]` / `[data-tool-card="true"]` ❌ 全部失效

全 71 个 client bundle 里**没有** `data-role`、没有 `data-tool="true"`、没有 `data-tool-card`（`data-role-icon` / `data-role-kind` 是 trajectory 面板的无关属性）。

**替代（这是本次最重要的一条）**：`[data-tool]`，值 = **工具名**。

```js
// dsh-client-ui-tool/lib/client.js:1716-1720（通用工具卡根 div）
return jsxs("div", {
  className: ToolRow_module_css_default.root,
  "data-variant": variant,
  "data-tool": toolName,
  "data-state": state, children: [...] });
// :1977-1981（ask_user_question 专用卡，同构）
jsxs("div", { className: ToolRow_module_css_default.root,
  "data-variant": "others", "data-tool": "ask_user_question", "data-state": state, children: [...] });
```

`data-variant` 取值为工具分类（`bash` / `code` / `others` …，见 `:1718`、`:2467`、`:1979`、`:6083`）。

`data-state` 的**唯一计算式**：

```js
// dsh-client-ui-tool/lib/client.js:273-294（toolRowModel）
const done = "kind" in block;
const state = !done
  ? (block.phase === "preparing" ? "preparing" : "running")
  : (block.error?.code === "interrupted" ? "stopped" : block.isError ? "error" : "ok");
```

→ `[data-tool]` 的 `data-state` ∈ `{ preparing, running, stopped, error, ok }`，**结束后一定离开 running/preparing**。

**这是 0.2.0-rc.2 里最精确的工具信号**，同时给了工具名（可用来做工具姿势细分，直接替代鲸鱼娘 `assets/dsh-whale-moe.js:1918-1935` 的文本关键词猜测）。

#### `pre` ✅ 仍有效

`pre` 仍出现在：命令卡展开体（`dsh-client-ui-chat/lib/client.js:6072-6075`）、markdown 代码块（`dsh-client-ui-primitives/lib/index.js:10823`、`:10866`、`:11354`、`:12039`）。markdown 代码块结构为 `pre > code.language-*`（`:11354`）。

⚠️ 用 `countVisible(SIGNAL_BANKS.code)` 当「代码量」时注意：`[data-terminal]` 现在覆盖终端块（`primitives:9371`），而终端块内部也可能含 `pre`；两个选择器会**重复计数同一个 DOM**（鲸鱼娘用 `Set` 去重，见 `assets/dsh-whale-moe.js:99-106`，仅同选择器内去重，跨选择器仍会重复）→ 建议 code bank 只保留 `[data-terminal], pre`。

#### `[data-slot="terminal"]` ❌ 不存在这个槽

全量 slot 键枚举（附录 A）中没有任何以 `terminal` 结尾的 slot；`renderSlot` 的实参集合里也没有。

**替代**：`[data-terminal]`（TerminalBlock 根 div 的存在性属性，`primitives:9371`）。语义 = 「一个终端块」。配套：`[data-terminal][data-running]` = 正在跑；`[data-terminal][data-body]` = 有输出体。

#### `[data-phase="session"]` ❌ 失效

`data-phase` 在 0.2.0-rc.2 有三个来源，值都不是 `"session"`：

| 位置 | 取值 | 证据 |
|---|---|---|
| 会话主面板根 | `"settling" \| "hero" \| "active"` | `dsh-client-ui-conversation/lib/client.js:16011-16020` |
| 输入区可编辑面 | `DraftEditor` 传入的 `phase` | `:16622` |
| 连接指示器 | 内部渲染相位 | `dsh-client-ui-primitives/lib/index.js:5366` |

会话面板根的原文：

```js
// dsh-client-ui-conversation/lib/client.js:16011-16020
const shellPhase = session === void 0 || conversation === void 0 ? "blank" : conversationPhase(session, conversation);
const hero = sessionId === void 0 || shellPhase === "blank" && (openState === "open" || summaryBlank === true);
const phase = settling ? "settling" : hero ? "hero" : "active";
return jsxs("div", { className: ..., "data-phase": phase, children: [...] });
```

**替代（workbench 判据）**：
- `[data-slot="conversation.chat.node"]`（已在用，仍有效）
- `[data-conversation-region="chat"]`（聊天区根，`conversation:16334`）
- `[data-conversation-session="<id>"]`（当前会话 id 落在 DOM 上，`:16333` —— 新增能力）
- `[data-composer-seat]` / `[data-conversation-region="composer"]`（输入区，`:16325-16326`）

#### `[class*="stream" i]` ❌ 失效（胶囊里那条）

0.2.0-rc.2 的 CSS 是 CSS-Modules 哈希类名（`xz4KEq_*`、`_3GBCTG_*`、`v5IAXa_*`、`ToolRow_*`…），全量扫描 71 个 client bundle 的 CSS 文本，**类名含 `stream` 的定义 0 条**。

**替代**：

| 语义 | 选择器 | 证据 |
|---|---|---|
| 思考文本流式中 | `[data-variant="think"][data-state="running"]` | `dsh-client-ui-chat/lib/client.js:5834-5835` |
| 推理摘要流式（折叠态） | `[data-streaming]`（在 `…_summary` span 上） | `:5812` |
| 助手正文流式 | `[data-streaming]`（在 AssistantMarkdown 根 div 上） | `:5955-5957` |
| 任意活动 shimmer | `[data-shimmer]`（`TextShimmer` 根 span，`active` 时才输出该属性） | `dsh-client-ui-primitives/lib/index.js:3116-3146`（`:3124` `"data-shimmer": active || void 0`） |
| 思考块（含已结束） | `[data-variant="think"]` | `chat:5834` |
| 工具卡 | `[data-tool]` | `dsh-client-ui-tool/lib/client.js:1719` |

#### `[data-runnning]` 之外新增：`[data-chat-running]` ➕ 最佳「AI 在干活」信号

```js
// dsh-client-ui-chat/lib/client.js:3898-3920（RunningStatus 组件）
/** Show live elapsed time after the current Turn's content without announcing ticks.
 *  @returns the blue running indicator; mount only while the Session is running. */
const RunningStatus = memo(function RunningStatus({ startTime, t }) {
  ...
  return jsxs("div", { className: ChatView_module_css_default.running, "data-chat-running": true, children: [...] });
});
// 使用点
// :5307
running && jsx(RunningStatus, { ... })
```

**语义**：仅当**当前会话正在运行**时挂载；回合结束即从 DOM 移除。这是**存在性布尔**，也是**唯一一个由宿主明确表述「会话运行中」的标记**。

#### `[data-turn-process]` ⚠️ 反向语义（不要当忙碌信号）

```js
// dsh-client-ui-chat/lib/client.js:6225-6229（TurnProcessNodeView）
const TurnProcessNodeView = memo(function TurnProcessNodeView({ node, turnProcess, t }) {
  const open = !turnProcess.foldable || turnProcess.open;
  const turn = ...;
  if (turn?.status !== "closed") return null;          // ← 只有回合 closed 才渲染
  ...
  return jsxs(Fragment, { children: [..., jsxs("button", {
    "data-open": open || void 0,
    "data-turn-process": node.data.turn,               // 值 = 回合序号
    "data-turn-process-messages": node.data.messageCount,
    "data-turn-process-tool-calls": node.data.toolCallCount,
    "data-turn-process-subagents": node.data.subagentCount, ... })
```

**`[data-turn-process]` = 「这一回合已经结束」的总结行**。用它当 busy 会把「忙碌」判成「空闲」。可用于「回合完成」的**新增节点**检测（配合基线比对），不能做存在性判定。

#### `[data-step-process]` ➕ 过程分组（含随附子标记）

```js
// dsh-client-ui-chat/lib/client.js:2345-2354（ChatGroupSeat 根）
return jsxs("div", {
  ref: rootRef, className: ...,
  "data-chat-group-key": groupKey,
  "data-chat-flow-key": groupKey,
  "data-chat-anchor-key": `group:${groupKey}`,
  "data-chat-turn": turn,
  "data-chat-paging-anchor": grouped && !open || void 0,
  "data-step-process": true,
  "data-group-expanded-mode": !grouped || void 0, children: [...] });
```

配套：`[data-step-process-body]`、`[data-step-process-content]`、`[data-step-process-icon]`、`[data-step-process-chevron]`、`[data-process-activity]`（值 = `thinking|tools|…`，`:2262`）。

⚠️ `data-step-process` 本身**不带状态**（历史与实时都有）。要判实时，用它内部的 `[data-shimmer]`（`TextShimmer active={!data.closed}`，`:2279-2285`）。

#### `[data-error]` ➕ 通用错误标记（替代 partly）

`data-error` 出现在 chat(2)、cordis、deliverables、skill、tool、trajectory：

```js
// dsh-client-ui-chat/lib/client.js:6063-6066（命令卡摘要）
jsx("span", { className: ..., "data-error": state === "error" || void 0, children: jsx(TextShimmer, { children: summary }) })
// :6072-6075（展开态 <pre>）
jsx("pre", { className: ..., "data-error": state === "error" || void 0, children: body })
```

#### `[data-state="error"]` / `[aria-invalid="true"]` ⚠️/❓

- `[data-state="error"]`：仍是有效标记（工具卡 `state === "error"`、命令卡 `data-variant="others"` 的 `data-state: state`，`chat:6084`）。
- `[aria-invalid="true"]`：全 71 个 client bundle 里 **0 命中** → ❌ 失效（该选择器当前只会空转，不会误报，可删）。
- `[data-state="error"]:not([class*="turnErrorDot"])`：`:not` 部分已无意义（哈希类名里没有 `turnErrorDot`），但保留无害；建议简化为 `[data-state="error"]`。

#### `[data-state="success"]` / `[data-status="success"]` ❌ 失效

- `data-state="success"`：0 命中（工具成功态是 `"ok"`，见 `dsh-client-ui-tool/lib/client.js:278`）。
- `data-status="success"`：0 命中。
- `data-success` 只在 `dsh-client-ui-deliverables` 出现 3 次（deliverables 内部状态条）。

**替代**：没有「一次成功的存在性标记」。可用两种方式：
1. **新增节点法**（推荐）：维护 `[data-tool][data-state="ok"]` 的节点基线，只有**新出现**的 ok 节点才算一次成功（与现有 error 的 baseline 机制同构，见 `assets/dsh-whale-moe.js:1555-1614`）。
2. **回落启发式**（现有代码已在用）：workbench 视图下 `toolWasActive → !toolActive` 即记一次成功（`assets/dsh-whale-moe.js:1670`）。0.2.0-rc.2 下这条依然成立且更准，因为 `[data-chat-running]` 一旦消失就是明确的回合结束。

#### `[data-slot="settings.header"]` ✅（VIEW_SELECTORS.settings 的第二分支）

只在设置面板打开时存在（面板内容的 nav 标题位），`dsh-client-ui-settings-general/lib/client.js:302`。**它是安全的第二判据**（引导弹窗是 `headless: true`，没有这个 outlet），但首选仍是 `[data-shortcut-modal="settings"]`。❌ 不要再用 `[role="dialog"]`（见 §4.4，它会被「预览版说明」引导弹窗持续命中）。

### 4.3 建议的新 SIGNAL_BANKS（可直接替换 `assets/dsh-whale-moe.js:36-43`）

```js
var VIEW_SELECTORS = Object.freeze({
  settings:  '[data-shortcut-modal="settings"], [data-slot="settings.header"]',
  workbench: '[data-slot="conversation.chat.node"], [data-conversation-region="chat"]'
});

var SIGNAL_BANKS = Object.freeze({
  /* 会话级「正在干活」——存在即忙，回合结束即消失 */
  running:  ['[data-chat-running]'],
  /* 工具执行——精确到工具名与生命周期 */
  tool:     ['[data-tool][data-state="preparing"]',
             '[data-tool][data-state="running"]',
             '[data-terminal][data-running]',
             '[data-state="ongoing"]'],
  /* 思考/流式文本 */
  thinking: ['[data-variant="think"][data-state="running"]',
             '[data-streaming]',
             '[data-shimmer]'],
  /* 失败 */
  error:    ['[data-tool][data-state="error"]',
             '[data-state="error"]',
             '[data-error]'],
  /* 代码/终端体量 */
  code:     ['[data-terminal]', 'pre'],
  /* 聊天节点计数 */
  chat:     ['[data-slot="conversation.chat.node"]']
});
```

配套必须同步修改的三处：

1. `assets/dsh-whale-moe.js:1623-1625` —— **删除**「`[data-state="running"]` 若在 `conversation.chat.node` 内则跳过」的排除（工具卡就在里面）。
2. `assets/dsh-whale-moe.js:1670` —— success 回落逻辑改为基于 `[data-chat-running]` 的下降沿。
3. `assets/dsh-whale-moe.js:1555-1614` —— error 基线机制保留，`[class*="dshLogCluster"]` 那条例外（`:1570`）在 0.2.0-rc.2 已无对应类名（哈希类名），可删。

### 4.4 「设置面板确实打开」的唯一判据 ✅ `[data-shortcut-modal="settings"]`

**问题**：0.2.0-rc.2 里**常驻**有很多 `role="dialog"`，最典型的是「预览版说明」/「DeepSeek 官方登录」这类**引导弹窗**——它们在「无会话」或「主会话为空白」时**自动出现**，把 `[role="dialog"]` 判成设置页会让桌宠隐藏。

自动弹出的机制（静态可证）：

```js
// dsh-client-ui-settings-general/lib/client.js:363-367
const onboardingActive = useSessions((state) => {
  const main = Object.values(state.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0);
  return state.phase === "ready" && (main === void 0 || main.blank);     // ← 无会话 / 空白会话 = true
});
const onboardingStep = requestedOnboarding !== void 0
  ? onboardingSteps.find((step) => step.id === requestedOnboarding)
  : onboardingActive ? onboardingSteps.find((step) => !completedOnboarding.has(step.id)) : void 0;
// :489-496  → 只要有 step 就渲染，与设置面板是否打开完全无关
onboardingStep !== void 0 && renderSlot("settings.onboarding", { stepId: onboardingStep.id, ... }, { only: onboardingStep.id })
```

被选中的第一个 step 是 `welcome-notice`（`order: -100`，`dsh-client-ui-settings-models/lib/client.js:4076-4081`），次选 `deepseek-official`（`:4082-4091`）。两者都经同一个 `OnboardingModal` 渲染成标准的模态：

```js
// dsh-client-ui-settings-models/lib/client.js:2425-2458
function OnboardingModal({ title, focusTitle = false, children }) {
  ... const appRoot = document.getElementById("root"); appRoot.inert = true; ...
  return jsx(_deepseek_ai_dsh_client_ui_primitives.Modal, {
    open: true, title, onClose: ignoreImplicitDismiss, headless: true,
    className: OnboardingModal_module_css_default.dialog,     // → "Yf9_hG_dialog"（:2399、:2411）
    children: ...
  });
}
```

```js
// dsh-client-ui-primitives/lib/index.js:5210-5261（Modal）
function Modal({ open, onClose, title, closeLabel, description, children, footer, className, contentClassName, onKeyDownCapture, headless = false, backdropBlur = true, shortcutModal }) {
  ...
  return createPortal(jsxs("div", { className: css$18.root, role: "presentation", children: [
    jsx("div", { className: css$18.mask, "aria-hidden": "true", onClick: onClose }),
    jsx("div", {
      ref: dialog, tabIndex: -1,
      "data-shortcut-modal": shortcutModal,          // ← 未传则为 undefined → 属性不输出
      className: clsx(css$18.dialog, className),     // → "_dialog_o6lrb_33 Yf9_hG_dialog"
      role: "dialog", "aria-modal": "true", "aria-label": title, children: ...
    })
  ]}), document.body);
}
```

→ 于是**引导弹窗与设置面板的 DOM 特征高度重合**：都是 `createPortal(..., document.body)` 出来的 `[role="dialog"][aria-modal="true"]`，class 里都带 `…_dialog_…`。区别只有一处：

| 弹窗 | `data-shortcut-modal` | 其它特征 |
|---|---|---|
| **设置面板** | **`"settings"`** | 自带 `<nav>`（内含 `[data-slot="settings.header"]`）+ 右上角关闭按钮 + `[data-slot="settings.section"]`；`headless` 未用 |
| 引导/预览版弹窗 | **无此属性** | `headless: true`（没有默认 header/close），且 `document.getElementById("root").inert === true` |
| 快捷键编辑弹窗 | `"shortcut-edit"` | `dsh-client-ui-shortcuts/lib/client.js:396` |

全量扫描确认 `data-shortcut-modal` 在 71 个 client bundle 里**只出现 2 次**（settings-general:290 与 shortcuts:396），所以：

```js
/* 唯一可靠的「设置页已打开」判据 */
const settingsOpen = document.querySelector('[data-shortcut-modal="settings"]') !== null;

/* 若还想兼容「面板头部渲染出来了」这一弱信号 */
const settingsOpen2 = document.querySelector('[data-slot="settings.header"]') !== null;
```

**适配动作**（`assets/dsh-whale-moe.js:26-28`）：

```js
var VIEW_SELECTORS = Object.freeze({
  settings:  '[data-shortcut-modal="settings"], [data-slot="settings.header"]',
  workbench: '[data-slot="conversation.chat.node"], [data-conversation-region="chat"]'
});
```

❌ 绝对不要再用 `[role="dialog"]`：它现在会命中引导弹窗、快捷键编辑、登录/登出对话框、审批弹窗、代码预览等至少 9 处（`role: "dialog"` 在 71 个 client bundle 里共 9 次命中，分布于 chat/conversation/schedule/settings-account/settings-general/sidebar-documentpreview/agent-team）。

**设置面板打开后渲染到哪里**：`SettingsPanel` 自己 `createPortal(…, document.body)`（`dsh-client-ui-settings-general/lib/client.js:280,341`）——**不是**渲染在 `[data-slot="sidebar.settings"]` 内部。所以 `[data-slot="sidebar.settings"]` 打开前后都不会变，不能用来判开关。

**入口点击链**（desktop profile）：`[data-slot="sidebar.settings"] button[aria-haspopup="menu"]`（AccountMenu）→ 弹出 `[role="menu"]`，其中 `button[role="menuitem"]`（文本「设置」）→ 触发 `openSettings()` → 挂载 `[data-shortcut-modal="settings"]`。全局快捷键 `Ctrl+,` 走 `ctx.shortcuts` 注册的 `settings.open` 命令（`dsh-client-ui-settings-general/lib/client.js:1065-1110`），**不依赖任何 DOM**，是最稳的程序化开启方式。

---

## 5. 主题契约（对应任务问题 4）

### 5.1 明暗主题：不是 `data-theme`，是 `body[data-ds-dark-theme]` ❌/⚠️

**首帧**（index 注入的 body script，在任何应用脚本之前执行）：

```js
// dsh-client-ui-theme/lib/index.js:47-57
function bootThemeBodyScript(preference, fontSize) {
  return `(() => {
  const preference = ${JSON.stringify(preference)}
  const systemDark = preference === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = preference === 'dark' || systemDark
  document.documentElement.dataset.dsThemeSource = preference
  document.body.toggleAttribute('data-ds-dark-theme', dark)
  document.body.style.setProperty('--dsh-content-font-size', ${JSON.stringify(`${fontSize}px`)})
})()`;
}
// 注入通道
// :92-94
ctx.on("webserver/index-inject", (table) => { table.push(...bootThemeInjections(config.preference.get(), config.fontSize.get())); }, { prepend: true });
```

**运行期**（唯一写入者）：

```js
// dsh-client-ui-layout/lib/client.js:498-548（ThemePresenter）
const DARK_ATTRIBUTE = "data-ds-dark-theme";              // :499
const THEME_SOURCE_ATTRIBUTE = "data-ds-theme-source";    // :509
const CONTENT_FONT_SIZE_VARIABLE = "--dsh-content-font-size";  // :511
apply(snapshot) {
  const scheme = snapshot.active.colorScheme;
  document.documentElement.style.colorScheme = scheme;
  document.documentElement.setAttribute(THEME_SOURCE_ATTRIBUTE, snapshot.preference === "system" ? "system" : scheme);
  const body = document.body;
  if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, ""); else body.removeAttribute(DARK_ATTRIBUTE);
  body.style.setProperty(CONTENT_FONT_SIZE_VARIABLE, `${snapshot.fontSize}px`);
  for (const name of this.appliedTokens) body.style.removeProperty(name);
  this.appliedTokens = []; for (const [name, value] of Object.entries(snapshot.active.tokens)) body.style.setProperty(name, value);
  ...
}
```

**结论与适配动作**（逐条钉死）：

| 问题 | 确定答案 | 证据 |
|---|---|---|
| 明暗由什么表达？ | **只有** `body[data-ds-dark-theme]`；**没有** `data-theme`、**没有** `html.dark`、**没有** `body.dark`、**没有** `classList.add("dark")` | 全库扫 `\[data-theme` / `html\.dark` / `classList\.add\(.dark` → **0 命中**；写入点仅 `dsh-client-ui-layout/lib/client.js:537-538` 与 `dsh-client-ui-theme/lib/index.js:55` |
| `data-ds-dark-theme` 的取值？ | **空字符串 `""`**（属性存在 = 暗色，属性不存在 = 亮色）。**从不**是 `"true"`/`"false"` —— 两处写入分别是 `toggleAttribute(attr, dark)` 与 `setAttribute(attr, "")` | `dsh-client-ui-theme/lib/index.js:55`；`dsh-client-ui-layout/lib/client.js:537`（`body.setAttribute(DARK_ATTRIBUTE, "")`）/:538（`body.removeAttribute(DARK_ATTRIBUTE)`） |
| 它挂在哪个元素？ | **`document.body`**，不是 `<html>`（旁证：桌面 preload 的 `MutationObserver` 明确 `observe(document.body, { attributeFilter: ["data-ds-dark-theme", "style"] })`） | `/lib/preload-app.cjs` @27668 |
| `data-ds-theme-source` 的取值域？ | `"light" \| "dark" \| "system"`（`system` 时保持字面量 `system`，不解析成 light/dark） | `dsh-client-ui-theme/lib/index.js:50-54`（boot script）；`dsh-client-ui-layout/lib/client.js:535`（`snapshot.preference === "system" ? "system" : scheme`） |
| 它挂在哪个元素？ | **`document.documentElement`（`<html>`）** | `theme/lib/index.js:54` `document.documentElement.dataset.dsThemeSource = preference`；`layout/lib/client.js:535` `document.documentElement.setAttribute(...)`；preload 也 `observe(document.documentElement, { attributeFilter: [THEME_SOURCE_ATTRIBUTE] })`（`/lib/preload-app.cjs` @3924 区域） |
| 主题变化时被改写的元素有哪些？ | ① `<html>`：`data-ds-theme-source` + inline `style.color-scheme`；② `<body>`：`data-ds-dark-theme`、inline `--dsh-content-font-size`、以及**每个主题 token 的 inline CSS 变量**（上一轮写入的会被逐个 `removeProperty` 回收）；③ `<head>` 里的 `<meta name="theme-color">`（content 取 body 计算后的背景色） | `dsh-client-ui-layout/lib/client.js:532-547`（`apply(snapshot)` 全文）、`:553-562`（`dispose()` 的回撤清单） |
| 是"某个元素的 class"吗？ | **不是**。`<html class>` 与 `<body class>` 都与主题无关（body 上只可能出现插件自己的或样式包的类） | 同上；主题令牌全部走 CSS 变量 + `body[data-ds-dark-theme]` 选择器（`dsh-client-ui-theme/lib/client.js:1148,1154,1160,1163` 的 token 样式表原文） |

> 若在 DevTools 的 Elements 面板里"同时"看到两个属性挂在 `<html>` 上：那是因为 `<body>` 是 `<html>` 的子节点，展开后属性会连排显示。用 `document.documentElement.getAttribute("data-ds-dark-theme") === null && document.body.hasAttribute("data-ds-dark-theme")` 一句话即可证伪/证实（见 §8 探针 ②）。

| 想要 | 0.2.0-rc.2 正确写法 |
|---|---|
| 判暗色 | `document.body.hasAttribute("data-ds-dark-theme")` |
| 判主题来源 | `document.documentElement.dataset.dsThemeSource` ∈ `light\|dark\|system` |
| 监听主题切换 | `MutationObserver` 同时观察 `document.body`（`attributeFilter: ["data-ds-dark-theme"]`）与 `document.documentElement`（`["data-ds-theme-source"]`）；**没有** `theme/change` DOM 事件（`theme/change` 是 Cordis 事件，`dsh-client-ui-theme/lib/client.js:1595`） |
| 内容字号 | `getComputedStyle(document.body).getPropertyValue("--dsh-content-font-size")` |
| CSS 里写暗色样式 | `body[data-ds-dark-theme] .my-thing { … }`（注意是 **body** 前缀，不是 `html`） |
| ❌ 不要用 | `[data-theme="dark"]`、`html.dark`、`body.dark`、`html[data-ds-dark-theme]`、把 `data-ds-dark-theme` 的值当 `"true"` 比较 |

补充的平台属性（布局层写，可用于桌面端特化）：`html[data-platform="darwin"|"win32"|…]`、`html[data-windows-titlebar]`、`html[data-fullscreen]`（`dsh-client-ui-layout/lib/client.js:241,319,322-327`；CSS 见 `:73` 的内联样式文本）。

### 5.2 第三方主题注册 API ➕（值得用，替代 DOM 改样式）

```js
// dsh-client-ui-theme/lib/client.js:1446-1457
register(definition) {
  if (definition.id === "system") throw new Error("\"system\" is a preference, not a registrable theme id");
  if (this.themes.some((t) => t.id === definition.id)) throw new Error(`theme "${definition.id}" is already registered`);
  this.themes = [...this.themes, definition]; this.publish(); return () => {...};
}
// :1474-1486
overrideTokens(source, tokens) {  // tokens: token 名 → { light, dark }
  ...
}
// :1581-1582
const theme = new ThemeRuntime(ctx, ctx.configForms.get(THEME_SETTINGS_NAMESPACE));
ctx.provide("theme", theme);
```

用法：客户端插件 `ctx.inject(["theme"], (c) => c.effect(() => c.theme.overrideTokens("dsh-whale-musume", { "--dsw-alias-brand-primary-new-colorprimary-new-color": { light: "#4da3ff", dark: "#7aaaff" } })))`。

这比在 DOM 里注入 `<style>` 更稳（不会被 CSS-Modules 哈希或层叠顺序打乱），且宿主保证「移除层即恢复」。

### 5.3 localStorage 命名空间 ⚠️ origin 变了（数据不会迁移）

宿主自身只用了两个键，**没有统一命名空间前缀**：

```js
// dsh-client-ui-conversation/lib/client.js:3166
const CONVERSATION_STORE_KEY = "dsh.conversation";
// :3207
const raw = localStorage.getItem(`${CONVERSATION_STORE_KEY}.${sessionId}`);
// :15839
const WIDTH_PREF_KEY = "dsh.conversation.contentWidth";
```

→ 结论：**`whale-moe:*` 前缀没有任何冲突风险**，宿主不会碰它，也不需要改名。

⚠️ **但真有数据的丢失风险来自 origin**：桌面壳的主窗口加载的是自定义 scheme 文档 `dsh-app://app/…`（`/lib/main.js` @456515 `protocol.handle(SCHEME, …)` + @435928 `registerSchemesAsPrivileged([{scheme:"dsh-app", privileges:{standard:true, secure:true, …}}])`），**不是** `http://127.0.0.1:19387`。`standard: true` 意味着这个 origin 有自己独立的持久化存储分区。

→ 旧 Web 版跑在 `http://127.0.0.1:3080`，与 `dsh-app://app` **不同源** → 旧 `whale-moe:*`（好感度、成就、日记、签到、小游戏纪录…）**不会自动带过来**。

**适配动作**（产品决策，需用户确认）：
- 方案 A：接受重置，在桌宠首次启动时按「新用户」初始化。
- 方案 B：提供一次「从旧 origin 导入」的手动流程（需在旧端口页面导出 JSON，再在桌面端页面导入）——纯前端可做，零侵入。
- 若走方案 B，建议统一用 `whale-moe:export` / `whale-moe:import` 两个键传递，不新建命名空间。

---

## 6. 资源路由与宿主半边（对应任务问题 5）

### 6.1 `webServer.register({kind:'exact', path, handler})` ✅ 仍成立

```js
// dsh-host-webserver/lib/index.js:177-184
register(route) {
  const table = route.kind === "exact" ? this.exact : this.prefixes;
  if (table.has(route.path)) throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`);
  table.set(route.path, route);
  return () => { table.delete(route.path); };
}
```

- `kind === "exact"` → exact 表；**任何其他值**（如 `"prefix"`）→ prefix 表。
- 匹配顺序：exact 精确命中 → prefix 最长优先（`:322-332`）。
- handler 签名 = 经典 node:http `(req, res)`：

```js
// dsh-host-webserver/lib/index.js:235
await route.handler(req, res);
```

- 重复 `(kind, path)` 抛错（组合级契约）。

鲸鱼娘 `lib/index.js:33-60` 的 `ctx.inject(["webServer"], …)` + `kind:"exact"` + `(req,res)` handler → ✅ **逐字有效，零改动**。

### 6.2 `ctx.inject(['webServer'], ...)` ✅ 仍成立（且是官方推荐写法）

`dsh-client-modules` 自己就这么挂路由：

```js
// dsh-client-modules/lib/index.js:545-552
const registerWebCarrier = (webCtx) => {
  webCtx.effect(() => webCtx.webServer.register({
    kind: "prefix",
    path: PLUGIN_ROUTE,                // "/plugins"（:201）
    handler: this.serveBundle
  }), "client-modules: bundle route");
};
ctx.inject(["webServer"], registerWebCarrier);
```

⚠️ 注意 `wctx.effect(() => disposer, label)` 的用法 —— 路由注销绑到 fiber。鲸鱼娘 `lib/index.js:61` 已正确这么写。

### 6.3 桌面端真的启用了 webServer ✅

桌面宿主启动代码：

```js
// dsh-desktop-host/lib/index.js:215-245
/** Launch the Desktop profile through the Web application and report its URL to Electron. */
async function main() {
  const runtimeDir = process.argv[2]; const projectDir = process.argv[3];
  installOfficeEngineResolution(runtimeDir);
  const installAnchor = join(runtimeDir, "node_modules", "@deepseek-ai", "dsh", "package.json");
  const profile = loadProfileDirectory("dsh", projectDir, installAnchor);
  reportSkippedBundles("dsh", profile);
  const application = runProfile({
    environment: loadLayeredEnv("dsh"),
    profile: "desktop",
    resolvedProfile: { profile, installAnchor },
    patchFiles: [],
    args: ["--no-open", "--port", "19387"],     // ← 真的要监听端口
    ...
```

```js
// dsh-desktop-host/lib/index.js:337-344
const url = ctx.connection.authenticatedUrl(`http://127.0.0.1:${String(ctx.webServer.port)}`);
if (process.connected) process.send?.({ type: "ready", url, injections: ctx.webServer.collectIndexInjections() }, ...);
```

`ctx.webServer.port` 与 `ctx.webServer.collectIndexInjections()` 都被使用 → webServer fiber 一定存在且已 listen。

### 6.4 index 注入通道（顺带确认）✅

```js
// dsh-host-webserver/lib/index.js:344-354
collectIndexInjections() {
  const table = [];
  this.ctx.emit("webserver/index-inject", table);
  return table;
}
// :220-224
tapIndex(transform) { this.indexTaps.push(transform); return () => {...}; }
// :361-363
renderIndex(html) { return this.applyIndexTaps(renderIndexInjections(html, this.collectIndexInjections())); }
```

桌面端 index 由 `dsh-web-app` 挂的 `frontend-static` fallback 渲染（`dsh-web-app/lib/index.js:8,32`；`dsh-host-frontend-static/lib/index.js:84-96`，含 `connection.authorizeIndex` 鉴权）。桌面壳把 `injections` 行经 IPC 交给 Electron 渲染 —— **注入链完整**。

⚠️ 但鲸鱼娘**不应该**用 index 注入来挂自己的资源：`index-inject` 的行模型是 `{kind, placement, src|text}`，适合样式/脚本标签；鲸鱼娘的 `fetch` + 动态 `<style>/<script>` 路线更可控（且 `data-plugin` / `data-plugin-css` 命名空间被 `dsh-client-modules` 用来做 HMR 清理，`dsh-client-modules/lib/client.js:196,494-496` —— 鲸鱼娘自己插的 `<style data-dsh-whale-musume="css">` 不在那个命名空间里，不会被误清，✅ 保持现状即可）。

### 6.5 路由前缀禁区：`/assets/**` ❌

桌面的 `dsh-app` 协议处理器在转发之前先抢答这几条路径：

```js
// /lib/main.js @456515
protocol.handle(SCHEME, (request) => {
  const url = new URL(request.url);
  if (url.hostname === "shell") return serveWebDocument(request, join(app.getAppPath(), "renderer"));
  if (url.hostname === "app") {
    if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname.startsWith("/assets/") ||
        ["/favicon.svg", "/manifest.webmanifest"].includes(url.pathname))
      return serveWebDocument(request, join(resources.dsh, "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist"));   // ← 本地 dist，不经 webServer
    if (backend.host === void 0 || hostUrl === void 0 || hostCookie === void 0) return new Response(null, { status: 503 });
    return forwardWebRequest(request, hostUrl, hostCookie);                                                                 // ← 其余才反代
  }
  return new Response(null, { status: 404 });
});
```

→ **任何以 `/assets/` 开头的插件路由在桌面端都永远到不了 `webServer.register()`**（会被打包 dist 的 404 吃掉）。
→ 鲸鱼娘用的是 `/api/dsh-whale-musume/assets?f=…`（`lib/index.js:37`）—— 前缀是 `/api/`，**安全**；这也解释了为什么当初把 `ASSET_ROOT` 从 `/assets/generated/` 改成 `BASE + "generated/"` 是对的，适配时必须保持。
→ 另外注意 `serveWebDocument(..., renderer)` 里的 `renderer/` 目录：壳自己的 `dsh-app://shell/*` 文档（更新对话框等）与主文档互不干扰。

---

## 7. 适配动作清单（按文件）

### 7.1 `package.json`

| 动作 | 说明 |
|---|---|
| 保留 `dsh.client.platform = "web"` | ✅ 必须逐字 `"web"` |
| 保留 `exports["./client"]` | ✅ 字符串形式可用 |
| 保留 `dsh.bundle.patch` | ✅ 桌面端 profile 的 bundle 层仍读它 |
| **新增** `peerDependencies: { "@deepseek-ai/dsh": "^0.2.0-rc.2" }` | 让不兼容显式 loud 失败（新的兼容门） |
| **删除或标注** `dsh.compatibility.dshReleases` | 0.2.0-rc.2 零引用，已死字段 |
| `main` / `files` 不变 | ✅ |

### 7.2 `lib/index.js`（宿主半边）

**零改动**。§6.1、§6.2 逐条验证通过。

唯一可选增强：`ctx.logger?.info?.` 在桌面端可用（宿主 logger 存在），无需改。

### 7.3 `assets/dsh-whale-moe.js`（呈现层）

| 行 | 现状 | 动作 |
|---|---|---|
| 26-28 | `VIEW_SELECTORS.settings = '[role="dialog"], [data-slot="settings.header"]'` | ⚠️ 改为 `'[data-shortcut-modal="settings"], [data-slot="settings.header"]'`（`[role="dialog"]` 会误匹配登录/登出框） |
| 27 | `workbench` 含 `[data-phase="session"]` | ❌ 删掉该分支，保留 `[data-slot="conversation.chat.node"]`，可加 `[data-conversation-region="chat"]` |
| 36-43 | `SIGNAL_BANKS` | ⚠️ 按 §4.3 整体替换 |
| 114-119 | `findComposerSurface()` | ⚠️ 把 `… textarea` 换成 `[data-composer-input]`（`[data-composer-card="true"]` 分支保留且优先） |
| 583-592 | 齿轮菜单定位 `[data-slot="sidebar.settings"] button` → `[data-slot="settings.trigger"]` → 按文本找按钮 | ⚠️ 重写：`[data-slot="sidebar.settings"] button[aria-haspopup]`；「打开设置」改走 `Ctrl+,` 或菜单项 |
| 1623-1625 | `data-state="running"` 在 chat node 内则跳过 | ❌ **删掉**（会让所有运行中的工具卡失效） |
| 1570 | `closest('[class*="dshLogCluster"]')` 例外 | ❌ 删掉（该类名在 0.2.0-rc.2 不存在，永远不命中） |
| 1670 | `toolWasActive && !toolActive` 记成功 | ⚠️ 改为以 `[data-chat-running]` 下降沿为主，或新增 `[data-tool][data-state="ok"]` 基线法 |
| 1918-1935 | `detectToolPose()` 用 `[data-role="tool"], [data-tool="true"], [data-tool-card="true"], …` + 文本关键词 | ⚠️ 改为 `doc.querySelectorAll('[data-tool]')` 取最后一个，用 **`getAttribute("data-tool")`**（工具名）直接映射姿势，删掉文本关键词猜测 |
| 2090-2099 | 用 `countVisible(SIGNAL_BANKS.chat)` 增量记「消息数」 | ⚠️ 见下方注意事项 |
| 2093 / 2134 / 2573 | 关键词扫描读 `[data-slot="conversation.chat.node"]` 的 `textContent` | ✅ 仍可用（但注意这是「已挂载节点」，不是全部历史） |

**`countVisible(chat)` 的计数风险（⚠️ 需注意，非阻塞）**：`[data-slot="conversation.chat.node"]` 的数量 = **当前已挂载**的聊天节点数。0.2.0-rc.2 的回合导航轨区分「已加载 / 未加载」回合（`dsh-client-ui-chat/lib/client.js:4039` `kind: "unloaded"`，`:3607,3616` 的 `chat.turnNavigation.jumpLoad`），跳转旧回合会**额外挂载**历史节点 → 计数看起来「新增了消息」，实际只是把历史加载进来。

建议（择一）：
- 用 `[data-slot="conversation.chat.node"]` 的**节点身份集合**（WeakSet）去重后再增量；
- 或只在 `[data-conversation-session]` 未变化时计数（会话切换重算基线）；
- 或干脆改为 `[data-chat-turn]` 的最大值变化作为「回合数」。

### 7.4 `lib/client.js`（客户端插件半边）

| 行 | 现状 | 动作 |
|---|---|---|
| 14-15 | `__ModuleLoader__.load({ id: "dsh-whale-musume", … })` | ✅ 不变（id 必须 = 包名） |
| 20-23 | `require("react")` / `require("react/jsx-runtime")` | ✅ 不变（平台种子表里有） |
| 25 | 资源路由 `BASE = "/api/dsh-whale-musume/assets?f="` | ✅ 不变 |
| 42-59 | `boot()`：fetch CSS/JS → 注入 | ✅ 不变；`fetch` 是**同源相对路径**（`/api/dsh-whale-musume/assets?f=…`），在 `dsh-app://app` 文档里会被壳反代到 webServer —— 相对路径写法天然正确，**不要**改成绝对 `http://127.0.0.1:…`（会被 `forwardWebRequest` 的 origin 校验挡下） |
| 457-471 | `registerSettings(ctx)` 用 `ctx.get("slots")` | ⚠️ 建议改为 `ctx.inject(["slots"], (sctx) => { const slots = sctx.slots; … })` —— `slots` 服务在 0.2.0-rc.2 由 `ui-renderer` 在 boot 中后期 `install()`，`ctx.get` 存在时序机会（当前有 try/catch 兜底，不致命但会静默丢面板） |
| 463-466 | 注册 `settings.section`（id `mascot`, order 6, label「看板娘」, children `settings.mascot.item`） | ✅ 模式有效；`label` 允许字符串 |
| 467-470 | 注册 `settings.mascot.item` 条目 | ✅ 有效 |
| 442-455 | `MascotSection` 用 `props.renderSlot("settings.mascot.item", {})` | ✅ 有效（`renderSlot` 只在声明了 children 时注入，已声明） |
| 64-65 | 用 `--dsw-alias-*` CSS 变量做内联样式 | ✅ 变量在 0.2.0-rc.2 仍由 theme 包的 token 样式表提供（`dsh-client-ui-theme/lib/client.js:1148+` 的 `body{--dsw-static-…}` 与 `body[data-ds-dark-theme]{…}`） |

**新增可选增强**：`lib/client.js` 可以把宿主 `ctx` 里可用的 `theme` 服务接上：

```js
ctx.inject(["theme"], (tctx) => tctx.effect(() => tctx.theme.overrideTokens("dsh-whale-musume", { /* token → {light, dark} */ })));
```

---

## 8. 只能运行时确认的项 + 探测表达式

以下项静态代码可推到 90% 但**存在分支依赖**（例如某个 slot 是否被别的插件占用），建议在桌面端实际跑一次时用下面的表达式确认。**这些是探测用表达式，不需要起服务器或浏览器自动化 —— 直接在 GUI 的 DevTools 控制台粘贴即可。**

```js
/* ① 关键锚点是否在 DOM（全部应 > 0） */
[
  '[data-slot="conversation.chat.node"]',
  '[data-conversation-region="chat"]',
  '[data-composer-card="true"]',
  '[data-composer-input]',
  '[data-slot="sidebar.settings"]',
  '[data-slot="sidebar.settings"] button[aria-haspopup]',
  '[data-slot="settings.trigger"]',          // 预期 0（被 settings.launcher 占用）
  '[data-slot="settings.header"]'            // 预期 0（面板未开）
].map((s) => s + " → " + document.querySelectorAll(s).length);

/* ② 主题属性（一句话钉死 html / body 各挂什么、值是什么） */
({
  html__dsDarkTheme: document.documentElement.getAttribute("data-ds-dark-theme"),   // 预期 null
  body__dsDarkTheme: document.body.getAttribute("data-ds-dark-theme"),             // 预期 ""（暗色）
  body__hasDark: document.body.hasAttribute("data-ds-dark-theme"),
  html__themeSource: document.documentElement.getAttribute("data-ds-theme-source"), // 预期 light|dark|system
  html__className: document.documentElement.className,                              // 预期 ""
  body__className: document.body.className,
  html__colorScheme: document.documentElement.style.colorScheme,
  fontSize: getComputedStyle(document.body).getPropertyValue("--dsh-content-font-size").trim(),
  platform: document.documentElement.dataset.platform,
  anyDataThemeAttr: document.querySelector("[data-theme]") !== null,                // 预期 false
  anyDarkClass: !!document.querySelector("html.dark, body.dark")                    // 预期 false
});

/* ②b 主题切换时到底改了谁（切一次主题，看日志里哪个元素冒泡） */
new MutationObserver((records) => records.forEach((r) =>
  console.log("THEME-MUT", r.target.nodeName, r.attributeName))
).observe(document.documentElement, { subtree: true, attributes: true,
  attributeFilter: ["data-ds-dark-theme", "data-ds-theme-source", "style", "class"] });

/* ②c 桌面壳 origin / 反代前提 */
({
  origin: location.origin,                 // 预期 "dsh-app://app"
  protocol: location.protocol,             // 预期 "dsh-app:"
  hasDshDesktop: "dshDesktop" in globalThis,
  protocolVersion: globalThis.dshDesktop?.protocolVersion
});

/* ③ 忙碌/成功/失败信号实时性（发一条会调用工具的消息，观察） */
new MutationObserver(() => console.log({
  chatRunning: !!document.querySelector("[data-chat-running]"),
  tools: [...document.querySelectorAll("[data-tool]")].map((n) => n.getAttribute("data-tool") + ":" + n.getAttribute("data-state")),
  terminal: document.querySelectorAll("[data-terminal][data-running]").length,
  ongoing: document.querySelectorAll('[data-state="ongoing"]').length,
  streaming: document.querySelectorAll("[data-streaming]").length,
  shimmer: document.querySelectorAll("[data-shimmer]").length,
  turnProcess: document.querySelectorAll("[data-turn-process]").length
})).observe(document.body, { subtree: true, attributes: true, childList: true });

/* ④ 弹窗/设置面板判别（刷新后立刻跑：应看到 0 个 settings、可能 1 个引导弹窗） */
({
  allDialogs: [...document.querySelectorAll('[role="dialog"]')].map((n) => ({
    cls: n.className, shortcutModal: n.getAttribute("data-shortcut-modal"),
    label: n.getAttribute("aria-label")
  })),
  settingsOpen: document.querySelector('[data-shortcut-modal="settings"]') !== null,  // 唯一判据
  shortcutEditOpen: document.querySelector('[data-shortcut-modal="shortcut-edit"]') !== null,
  onboardingUp: document.getElementById("root")?.inert === true,                      // OnboardingModal 的特征
  settingsHeader: document.querySelectorAll('[data-slot="settings.header"]').length,
  sidebarSeat: document.querySelectorAll('[data-slot="sidebar.settings"]').length,
  sidebarTrigger: document.querySelector('[data-slot="settings.trigger"]'),           // 桌面端预期 null
  accountMenuButton: !!document.querySelector('[data-slot="sidebar.settings"] button[aria-haspopup]')
});

/* ⑤ 打开设置面板后再跑同一段（用 Ctrl+, 打开） */
({
  settingsOpen: document.querySelector('[data-shortcut-modal="settings"]') !== null,  // 预期 true
  panelParentIsBody: document.querySelector('[data-shortcut-modal="settings"]')?.parentElement
                       ?.parentElement === document.body,                             // 预期 true（portal）
  sectionNavButtons: [...document.querySelectorAll('[data-shortcut-modal="settings"] nav button')]
                       .map((b) => b.textContent.trim()),                             // 应含「看板娘」
  mascotOutlet: document.querySelectorAll('[data-slot="settings.mascot.item"]').length
});

/* ⑤ slot 台账（需要能拿到 ctx.slots；在插件内部或 devtools 里） */
/* ctx.slots.snapshot() 会打印完整声明树 —— 里面应能看到 settings.mascot.item 挂在 settings.section 下 */
```

**预期结果与「需要回填」的分支**：
- ② 的 `html__dsDarkTheme` 应为 `null`、`body__dsDarkTheme` 应为 `""` —— 若两者都有值，说明还有第三方在 `<html>` 上写它（当前静态扫描未发现），需回填到 §5.1。
- ②c 的 `origin` 应为 `dsh-app://app`；若为 `http://127.0.0.1:19387`，则 §1 / §5.3 的 origin 结论需改成"浏览器直达"分支。
- ④ 的 `settingsOpen` 在刷新后应为 `false`，而 `allDialogs` 可能非空（引导弹窗）—— 这正是要修 `[role="dialog"]` 的直接证据。
- ④ 的 `onboardingUp === true` 时，说明当前是"无会话/空白会话"自动引导态，桌宠应保持 `home` 视图而不是 `settings`。
- ⑤ 的 `sectionNavButtons` 应包含「看板娘」；若不含，说明 `settings.section` 的导航投影没拿到 label（检查 `label` 是否为字符串或返回字符串的函数）。
- ⑤ 的 `mascotOutlet === 0`：说明 `settings.mascot.item` 未被渲染，通常是该 entry 的 `children` 声明丢失，或面板切片未激活（`renderSlot("settings.section", …, { only: active })` 只渲染被选中的那一节）。
- ① 的 `[data-slot="sidebar.settings"] button[aria-haspopup]` 为 0：说明 `settings-account` 未激活（无账户上下文 / 非 desktop carrier），此时 settings-general 的 fallback 按钮会渲染、`[data-slot="settings.trigger"]` 反而存在 → 齿轮逻辑需要写成「两个选择器都试」。

---

## 附录 A：0.2.0-rc.2 完整 SlotMap（从 71 个 client bundle 的 `name: "<key>"` 静态枚举去重）

顶层/无点键：`root`（框架内置）、`main`、`sidebar`、`rightbar`、`plugins.item`

```
conversation.approval.detail            conversation.input.activity
conversation.chat.assistant-actions     conversation.input.attachments
conversation.chat.commandview           conversation.input.dock
conversation.chat.node                  conversation.input.left
conversation.chat.turnTail              conversation.input.model
conversation.composer                   conversation.input.overlay
conversation.composer.bar               conversation.input.permission
conversation.composer.dock              conversation.input.plan
conversation.content                    conversation.input.right
conversation.header                     conversation.message.images
conversation.header.leading             conversation.plan-review.actions
conversation.hero.agentPreset           conversation.session
conversation.hero.brand.mark            conversation.session.header
conversation.hero.workspace             conversation.session.header.actions
conversation.hero.workspace.directoryF… conversation.session.header.corner
conversation.trajectory.images          conversation.session.header.lineage
conversation.view                       conversation.session.header.utilities

main.conversation                       sidebar.brand.mark
settings.action                         sidebar.brand.name
settings.close                          sidebar.chat.conversation
settings.general.item                   sidebar.footer.action
settings.header                         sidebar.panellist
settings.launcher                       sidebar.right.pane.tab(+.title)
settings.models.sign-in                 sidebar.right.tab.document(+.action/.actions/.office.pdf/.unpreviewable)
settings.models.footer                  sidebar.right.tab.files.actions
settings.models.provider-card           sidebar.right.tab.guide(+.entry)
settings.onboarding                     sidebar.right.tab.menu.item
settings.plugins.tab                    sidebar.session.row.hover
settings.section                        sidebar.session.row.leading
settings.trigger                        sidebar.settings
shell.leading                           sidebar.toggle.badge
shell.overlay                           sidebar.workspaces(+.session.menu.item/.session.row.action/.directoryF…)
shell.quota-notice                      tool.call.images
dsh.open-in-app.choice                  tool.call.toolview
dsh.plugin-manager.install-registry     tool.view.cordis
dsh.sessions.current
dsh.trajectory.duration / dsh.trajectory.jsonS…
deliverables.file.actions               deliverables.review.file.actions
plugins.bundle.activation               plugins.bundle.config
plugins.detail.actions                  plugins.detail.badge
plugins.detail.section                  plugins.row.config
rightbar.session
```

**没有** `terminal`、**没有** `settings.mascot.item`（后者由本插件自声明）。`settings.section` **在**。

## 附录 B：0.2.0-rc.2 与鲸鱼娘相关的 `data-*` 全量清单（节选，按用途分组）

**忙碌/状态**：`data-chat-running`、`data-tool`(值=工具名)、`data-variant`(bash/code/others/think)、`data-state`(preparing/running/stopped/error/ok/done/warning/idle/ongoing)、`data-streaming`、`data-shimmer`、`data-running`、`data-terminal`、`data-body`、`data-error`、`data-process-activity`、`data-step-process(+body/content/icon/chevron)`、`data-turn-process(+messages/tool-calls/subagents/answer/hidden/inline/member)`、`data-turn-tail`、`data-turn-trigger`

**聊天流**：`data-chat-flow`、`data-chat-flow-key`、`data-chat-flow-kind`、`data-chat-group-key`、`data-chat-group-part`、`data-chat-anchor-key`、`data-chat-node-key`、`data-chat-paging-anchor`、`data-chat-turn`、`data-chat-following-tail`、`data-chat-call-id`、`data-group-expanded-mode`

**会话/输入**：`data-conversation-content`、`data-conversation-scroll`、`data-conversation-session`、`data-conversation-region`、`data-content-phase`、`data-composer-card`、`data-composer-input`、`data-composer-placeholder`、`data-composer-seat`、`data-composer-chip`、`data-composer-composing`、`data-composer-stats`、`data-composer-text-ref`、`data-input-scroll`、`data-queue-dock`、`data-pending-steering`、`data-submission-echo`

**布局/平台**：`data-platform`、`data-ds-dark-theme`、`data-ds-theme-source`、`data-windows-titlebar`、`data-fullscreen`、`data-sidebar-collapsed`、`data-rightbar-*`、`data-shell-overlay`、`data-shell-leading`、`data-window-drag`、`data-side`

**设置/slot**：`data-slot`、`data-slot-error`、`data-shortcut-modal`、`data-modal-autofocus`

**内容**：`data-code-block-banner`、`data-code-block-content`、`data-markdown-variant`、`data-search`、`data-web`、`data-diff-*`、`data-files-*`、`data-textpreview-*`、`data-open-path*`

**已消失（旧版有、0.2.0-rc.2 全库 0 命中）**：`data-role`、`data-tool-card`、`data-theme`、`data-status="running|error|success"`

---

## 附录 C：审计过程中发现的两个「陷阱」（后人别再踩）

1. **`_reference/desktop-0.2.0-rc.2/dsh-desktop-host-index.js` 与 `dsh-package.json.full` 是 UTF-16LE**（前 2 字节 `FF FE`，用 PowerShell `>` 重定向 `node … cat` 造成的）。ripgrep 仍能匹配，但按字节比较/写脚本时会踩坑。已改用的正确读法：`_reference/desktop-0.2.0-rc.2/_audit/rd.mjs`（直接从 asar 按行号读 UTF-8）。
2. **`tools/asar.mjs dump` 遇到 asar 内 `"unpacked": true` 的文件会 `RangeError: position NaN`**（这类条目没有 `offset`，实体在 `app.asar.unpacked/`）。`dsh-desktop-host` 整个包因此无法 `dump`（其 `node_modules/koffi/**.node` 是 unpacked），但可以用 `cat` 或 `rd.mjs` 单文件读。

---

*审计完成时间：本会话；证据均可由 `tools/asar.mjs` 与 `_reference/desktop-0.2.0-rc.2/_audit/{rd,scan,ctxscan}.mjs` 复现。*
