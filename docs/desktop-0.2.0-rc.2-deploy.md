# 桌面端部署手册（DeepSeek Harness Desktop · 内嵌 DSH 0.2.0-rc.2）

> 适用版本：鲸鱼娘 **v2.2.0**；宿主 **DeepSeek Harness Desktop（Electron 壳，内嵌 DSH 0.2.0-rc.2，desktop profile，GUI 端口 19387）**。
> 本手册基于一次真实安装/加载/验收实测写成（隔离 profile 上跑通，证据见 `docs/desktop-0.2.0-rc.2-acceptance.md`）。
> 所有命令都是本机可直接复制执行的 PowerShell。

---

## 0. 先记住三件事

1. **桌面端和旧版 Web 是两个环境**。桌面端主窗口的文档 origin 是 `dsh-app://app`，旧版 Web 是 `http://127.0.0.1:3080`。两者的 `localStorage` 不互通，所以**桌面端第一次打开是全新的养成数据**（好感度、成就、位置、称呼等都不会带过来）。这不影响安装。
2. **装插件用桌面端自带的 CLI**，它内部用自己的 pnpm（`resources\runtime\pnpm\bin\pnpm.mjs`）。不要用系统 npm/pnpm 往 profile 里装。
3. **desktop profile 的包操作由 Electron 应用负责**：桌面端 CLI 带 `manageDesktopProfile` 权限，普通 `dsh` 命令会拒绝 `--profile desktop`。因此下面所有命令都必须走桌面端的 `DeepSeek Harness.exe`。

---

## 1. 安装前检查

### 1.1 确认桌面端与运行时版本

```powershell
$Desktop = "D:\DeepseekHarnessDesktop"
$Runtime = "$Desktop\resources\app.asar\dsh"
$Cli     = "$Runtime\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js"

Get-Content "$Desktop\resources\runtime\versions.json"
$env:ELECTRON_RUN_AS_NODE = "1"
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli -V
```

预期：`versions.json` 给出 `node` / `pnpm` 版本；第二条打印运行时版本（本次实测 `0.2.0-rc.2`）。

### 1.2 查看 desktop profile 现状

```powershell
$DshHome = "D:\DeepseekHarness_Data\.dsh"      # 注意：别用 $Home，它在 PowerShell 里是只读自动变量
$Profile = "$DshHome\profiles\desktop"

Get-Content "$Profile\package.json"
Select-String -Path "$Profile\cordis.yml" -Pattern "id: hmr" -Context 0,1
```

预期：`dependencies` 里**没有** `dsh-whale-musume`（未装）；`dsh.profile.bundles` 为 4 个内置包；`cordis.yml` 里有 `id: hmr` / `name: '@deepseek-ai/dsh-hmr'`（表示 HMR 已启用，配置改动可能被热重载接住）。

### 1.3 备份（必须做，回滚靠它）

```powershell
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Bak   = "$DshHome\backups\desktop-profile-$Stamp"
New-Item -ItemType Directory -Force -Path $Bak | Out-Null
foreach ($f in "package.json","cordis.patch.yml","cordis.yml","pnpm-lock.yaml","pnpm-workspace.yaml","compatibility.json") {
  if (Test-Path "$Profile\$f") { Copy-Item "$Profile\$f" "$Bak\$f" -Force }
}
Get-ChildItem $Bak -File | Get-FileHash -Algorithm SHA256 |
  Select-Object @{n='File';e={Split-Path $_.Path -Leaf}}, Hash |
  Tee-Object -FilePath "$Bak\SHA256.txt"
```

预期：`$Bak` 下出现被复制的清单文件，并生成 `SHA256.txt` 留痕。记下 `$Bak` 路径，回滚要用。

> 若 `D:\DeepseekHarness_Data\.dsh\backups` 不存在，`New-Item -Force` 会自动建；**不要**删除或重置 `.dsh` 下任何已有目录。

---

## 2. 安装

### 2.1 方式 A：本地源码（推荐先走这条，便于自验）

```powershell
$Src = "D:\DeepseekHarness_WorkSpace\Project_dsh_musume"
Set-Location $Src
$Node = "$Desktop\resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
$Pnpm = "$Desktop\resources\runtime\pnpm\bin\pnpm.mjs"

& $Node $Pnpm pack --pack-destination .
Get-ChildItem *.tgz | Select-Object Name,Length
```

预期：产出 `dsh-whale-musume-2.2.0.tgz`（约 20 MB；含 `lib/`、`assets/`、`cordis.patch.yml`）。
判据：若提示 `files` 字段过滤掉了 `assets/generated` 或 `assets/anim`，说明 `.gitignore`/`files` 被动过——包会缺立绘，**先修再装**。

```powershell
$Tgz = (Get-ChildItem "$Src\*.tgz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName

$env:ELECTRON_RUN_AS_NODE = "1"
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop add $Tgz
```

> 本次实际执行的命令（可用于对照）：
> `& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop add "D:\DeepseekHarness_WorkSpace\dist\dsh-whale-musume-2.1.0.tgz"`
> 结果：pnpm 输出 `+ dsh-whale-musume file:…/dsh-whale-musume-2.1.0.tgz`，`Package +1`，`Done in 1.2s`。

预期：命令结束打印 pnpm 的安装结果（`+ dsh-whale-musume 2.2.0`），并把它追加到 `dsh.profile.bundles`。
失败判据：
- 打印 `error: profile "desktop" is managed exclusively by the Electron application` → 你没走桌面端 exe；
- 打印 registry/网络错误 → 本地 tarball 不需要网络，说明 spec 没解析成路径（检查 `$Tgz` 是否带引号、路径是否存在）；
- 打印 `incompatible-version` → 说明该包声明了 `@deepseek-ai/dsh` peer 且与 0.2.0-rc.2 不匹配（本包**没有** peer，正常不会出现）。

### 2.2 方式 B：GitHub 源

```powershell
$env:ELECTRON_RUN_AS_NODE = "1"
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop add github:Sutera-Diffusus/dsh-whale-musume
```

预期：与方式 A 相同，但会先做一次 `git ls-remote` 连通性检查（默认 5 秒超时），随后由 pnpm 拉取。
失败判据：`failedAt: 'spec-host'` 表示 GitHub 不可达；换方式 A 即可绕过。

### 2.3 安装后核对

```powershell
Get-Content "$Profile\package.json"
Test-Path "$Profile\node_modules\dsh-whale-musume\lib\client.js"
Test-Path "$Profile\node_modules\dsh-whale-musume\assets\generated\dsh-whale-state-idle-cute.webp"
(Get-ChildItem "$Profile\node_modules\dsh-whale-musume\assets\generated" -File | Measure-Object).Count
```

预期：`dependencies` 有 `dsh-whale-musume`，`bundles` 末尾有它；两个 `Test-Path` 都是 `True`；立绘数量 **92**。
判据：立绘数不是 92 → 包装坏了（回到 2.1 重新 pack），不要继续。

---

## 3. 生效判定

### 3.1 优先尝试热重载（不打断当前会话）

desktop profile 启用了 `@deepseek-ai/dsh-hmr`，它会监视 profile 清单与两份用户 patch 文件：

```powershell
# 只读观察：桌面端窗口里打开 DevTools（F12），Console 里执行
# 若能取到鲸鱼娘的引导标记，说明客户端插件已经接上
window.__dshWhaleMusumeBooted
document.querySelectorAll('[data-dsh-whale-root]').length
```

预期：热重载接住时，`__dshWhaleMusumeBooted === true`、根节点数 `1`。
判据：拿不到 → 走 3.2 重启（HMR 只保证配置层重载，新增依赖通常仍需重启才稳）。

**服务端侧的无 token 判定（不需要 DevTools）**：宿主插件的资源路由只在她加载后才存在，所以这条命令能直接说明「Host 侧已接住」：

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:19387/api/dsh-whale-musume/assets?f=whale-moe-core.js" -UseBasicParsing |
  Select-Object StatusCode, @{n='Bytes';e={$_.RawContentLength}}
```

本次实测：装完**未重启**桌面端时该路由已返回 `200 / 100862`（说明 HMR 已重挂宿主插件）；客户端那一半最稳的确认方式是在窗口里按 `Ctrl+R` 刷新一次页面。

### 3.2 重启桌面端（最稳）

1. 完全退出桌面端（托盘图标 → 退出；或任务管理器结束 `DeepSeek Harness.exe` 全部进程）。
2. 重新启动 `D:\DeepseekHarnessDesktop\DeepSeek Harness.exe`。
3. 进 GUI 后在 Console 里执行：

```js
window.__dshWhaleMusumeBooted            // true
document.querySelectorAll('[data-dsh-whale-root]').length   // 1
getComputedStyle(document.querySelector('[data-dsh-whale-root]')).display  // "block"（首页可见）
window.__dshWhaleMoeDebug                // state: "idle" 之类，非 "hidden"
document.body.getAttribute('data-dsh-whale-view')           // "home"
```

预期：以上四项依次为 `true / 1 / "block" / 非 hidden / "home"`，左下（默认右下）能看到鲸鱼娘。

> 若 `display` 是 `"none"`：先确认当前没有打开设置面板（设置面板打开时她按设计隐藏）。

### 3.3 只读检查：她的资源路由是否活着

```powershell
$Token = ""   # 桌面端 GUI 不需要；这条命令只验证路由本身
Invoke-WebRequest -Uri "http://127.0.0.1:19387/api/dsh-whale-musume/assets?f=whale-moe-core.js" -UseBasicParsing |
  Select-Object StatusCode, @{n='Bytes';e={$_.RawContentLength}}
```

预期：`200`，约 100 KB。
判据：`401` → 桌面端给 index 之外的请求加了会话校验，属正常；`404` → 宿主插件没挂上，检查 profile 重启日志里有没有 `dsh-whale-musume` 的启动告警。

---

## 4. 回滚

### 4.1 细粒度：只回退 patch 层（她还在，只是配置回到原样）

```powershell
Copy-Item "$Bak\cordis.patch.yml" "$Profile\cordis.patch.yml" -Force
```

### 4.2 中粒度：整份清单回到安装前

```powershell
Copy-Item "$Bak\package.json" "$Profile\package.json" -Force
Get-ChildItem "$Bak\*.yml" | ForEach-Object { Copy-Item $_.FullName "$Profile\$($_.Name)" -Force }
```

然后重启桌面端。`node_modules` 里的包还在但不会被选入 `bundles`，等于停用。

### 4.3 粗粒度：卸载依赖

见第 5 节。

> 回滚后用 3.2 的检查确认 `document.querySelectorAll('[data-dsh-whale-root]').length === 0`。

---

## 5. 卸载

```powershell
$env:ELECTRON_RUN_AS_NODE = "1"
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop remove dsh-whale-musume
```

预期：从 `bundles` 移除并执行 `pnpm remove`；重启桌面端后桌宠消失。
手工兜底（CLI 不可用时）：

```powershell
# 1) 从 bundles 里删掉 dsh-whale-musume（编辑 package.json）
# 2) 直接删依赖目录
Remove-Item "$Profile\node_modules\dsh-whale-musume" -Recurse -Force
# 3) 重启桌面端
```

> 卸载**不会**删除养成数据：`whale-moe:*` 全部留在桌面端 origin（`dsh-app://app`）的 localStorage 里，重新装回来数据还在。

---

## 6. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| Console 里 `__dshWhaleMusumeBooted` 是 `undefined` | 客户端 bundle 没进启动图 | 确认 profile `bundles` 里有它、重启桌面端；再看 Host 日志有没有 `dsh-whale-musume` 的 import 失败 |
| 她出现了但一直是「工作中」姿势 | 宿主里确实有运行中的工具卡 | 属正常联动；等工具跑完会回到待机 |
| 她在设置页里消失 | 设计如此（设置页隐藏） | 关掉设置面板即回来 |
| 桌面端里好感度/成就是空的 | origin 不同，旧 Web 数据不迁移 | 重新养成；或在旧 Web 导出后再导入（本版未提供迁移工具） |
| 安装命令报 `profile "desktop"` 被占用 | 没走桌面端 exe | 用第 2 节的完整命令 |

---

## 附：本轮实测记录（隔离环境）

- 隔离 profile：`.qa\home\profiles\web`（自建，**不影响** `D:\DeepseekHarness_Data`），启动器 `.qa\boot-host.mjs`，端口 19388。
- 安装方式：`pnpm pack` → `pnpm add <tarball>`（等价于 CLI 的 `plugin add`）。
- 结果：bundle 进入启动图、`/plugins/??dsh-whale-musume/client.js&rev=…` 可获取、`lib/client.js` 正常注册 factory、三段资源经 `/api/dsh-whale-musume/assets` 加载、桌宠可见（200×200、`data-wm-theme` 正确）、设置面板注册、零控制台错误。详见验收报告。
