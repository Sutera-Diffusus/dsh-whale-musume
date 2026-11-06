# npm 发布手册（v2.5.0 起）

> **状态：2026-11-06 已发布 `dsh-whale-musume@2.5.2`（latest）**；`NPM_TOKEN` 已配置为仓库 secret，之后每次 GitHub Release 都会自动发布 npm。安装：`dsh plugin add dsh-whale-musume`。下面的登录/Token 流程保留作备用。
>
> 目的：把 `dsh-whale-musume` 从「只能 git 安装」变成「npm 一行安装」。
> 这能同时解决三件事：install 时的 `git ls-remote` 失败（#21 / #29）、插件市场的下载排序、以及 dsh 0.2.1+ 的 Discover / `plugin_market` 对 npm 包的索引。

## 0. 已经准备好的

- `package.json`：已移除 `private`，`files` 白名单只含运行时（`lib` / `assets/generated` / 4 个 assets 文件 / `cordis.patch.yml`），包体约 **12.3 MB**。
- `npm run publish:npm`：固定发布到 `https://registry.npmjs.org`，`--access public`。
- `prepublishOnly`：发布前跑完整 203 项测试。
- `.github/workflows/publish-npm.yml`：`release` 事件或手动触发；未配置 `NPM_TOKEN` 时跳过而不是把 Release 变红。

## 1. 登录（二选一）

### A. 本机登录（最快）

```powershell
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org   # 应输出你的 npm 用户名
```

> 本机默认 registry 是 npmmirror，**必须显式带 `--registry`**，否则登录/发布会打到镜像。

然后：

```powershell
npm run publish:npm
```

> 如果报 `403 ... Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages`：
> - **本机临时发**：在命令后加 `--otp=<当前 6 位验证码>`，例如 `npm publish --access public --registry=https://registry.npmjs.org --otp=123456`；
> - **CI / 长期自动**：创建 Granular Token 时勾选 **Bypass 2FA**（或使用 classic 的 Automation token），再填到 GitHub secret `NPM_TOKEN`。网页登录拿到的 token 不带 bypass，`npm publish` 仍会被 403 拦下。

### B. GitHub Actions 自动发布（推荐长期）

1. 在 npmjs.com → Access Tokens 创建 **Granular Token**：
   - Permissions: **Read and write**
   - Packages: 选择 `dsh-whale-musume`（包还不存在时选 All packages，或先手动发一次再收紧）
   - **Bypass 2FA：勾选**（否则 CI 发布会被 403；或改用 classic Automation token）
   - 建议设置过期时间
2. 打开 GitHub 仓库 **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `NPM_TOKEN`
   - Value: 上一步的 token（不要贴到聊天或提交到仓库）
3. 手动跑一次：

```powershell
gh workflow run publish-npm.yml --ref main
gh run list --workflow publish-npm.yml --limit 1
```

之后每次 GitHub Release 发布都会自动发 npm；没有 secret 时会自动跳过。

## 2. 发布后验证

```powershell
npm view dsh-whale-musume version --registry=https://registry.npmjs.org
npm view dsh-whale-musume dist.tarball --registry=https://registry.npmjs.org
npm pack dsh-whale-musume@2.5.2 --dry-run --registry=https://registry.npmjs.org
```

安装侧：

```powershell
dsh plugin --profile web add dsh-whale-musume
# 桌面端
$env:ELECTRON_RUN_AS_NODE = "1"
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop add dsh-whale-musume
```

## 3. 市场条目

- `awesome-dsh-plugin` 的 YAML 已更新（PR #8483，2026-10-21 合并）。
- 该市场的下载量与版本来自 npm；包发布后会自动出现版本号与下载数，不需要再改 YAML。
- dshbase / dshfind / dsh-plugin.org 的条目通常由 GitHub / npm 数据生成，npm 发布后会自动刷新；若一周后仍显示旧版本，再去对应仓库提更新。

## 4. 出问题怎么退

- 72 小时内：`npm unpublish dsh-whale-musume@2.5.0 --registry=https://registry.npmjs.org`（会破坏已安装用户，尽量别用）。
- 更稳：`npm deprecate dsh-whale-musume@2.5.0 "请升级到 2.5.1"`，然后发 2.5.1。
- 包内容有问题时，先修 `files` / `prepublishOnly`，发 patch 版本，不要覆盖已发布版本号。
