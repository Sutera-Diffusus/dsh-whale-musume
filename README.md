# dsh-whale-musume

**DS 娘 / 鲸鱼娘**——为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 打造的桌面看板娘插件。

一只会陪你写代码的鲸鱼娘：待机安静陪伴，工作开始就抱起笔记本陪你干活；可以摸头养成、解锁成就，也可以拖着她到处走。所有资源本地运行，无遥测、无外部请求。

![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.2-blue)
![DSH](https://img.shields.io/badge/DSH-0.1.0--rc.6-blue)

---

## 目录

- [特性](#特性)
- [效果预览](#效果预览)
- [安装要求](#安装要求)
- [安装教程](#安装教程)
- [使用说明](#使用说明)
- [更新 / 回滚 / 卸载](#更新--回滚--卸载)
- [数据与隐私](#数据与隐私)
- [项目结构](#项目结构)
- [开发与测试](#开发与测试)
- [故障排查](#故障排查)
- [License](#license)

---

## 特性

### 🐋 看板娘本体

- 默认悬浮形态（200px），支持鼠标拖拽；
- 拖拽时切换「被拎起来」立绘，身体随光标移动方向自然摇摆；
- 待机时保持稳定表情，随机出现喝咖啡、伸懒腰、吃东西等日常小动作；
- 待机与工作状态之间使用「下压 → 换图 → 弹起」的动势遮断过渡，不会叠影，不会闪黑。

### 💼 工作状态联动

- 检测到工具运行（`data-running` / `data-state="ongoing"`）自动切换为「抱笔记本工作」；
- 工作中带淡蓝光晕和「工作中」标签；
- 工作状态下点击她，会随机出现「害羞抱电脑」或「偷吃内存条」的反应，不会打断工作状态；工作期间保持 running 姿势稳定，不再随机切小剧场。

### 🎀 互动与特效

- 单击摸头：脸红立绘 + 爱心/星星 emoji 飞出；
- 三连击：星星眼庆祝 + 粒子特效 + 旋转动画；
- 右键菜单：投喂 / 戳一下 / 夸夸 / 回到原位 / 打开设置；
- 点击反应即时切换，不做拖沓过渡。

### 📈 养成与成就

- 心情、好感度、饱食度、等级、连续签到、陪伴时长；
- 30 个成就：互动类、陪伴类、DSH 用量类（工具运行次数、代码块、任务成败、消息量、深夜工作等）；
- 设置面板内置**成就墙**，已解锁高亮、未解锁灰显。

### ⚙️ 设置面板

- 看板娘设置集成在 DSH 设置页中；
- 胶囊开关：看板娘 / 台词气泡 / 粒子效果 / 关键词感知 / 摸鱼提醒 / 深夜模式；
- 养成数据使用横排小卡片展示，信息密度合理。

### 🧩 工程特性

- 纯前端注入，不修改 DSH 业务 DOM；
- 所有改动可备份、可回滚；
- 资源文件带版本号，升级后强制刷新缓存；
- 核心状态机与表现层分离，便于二次开发。

---

## 效果预览

> 仓库中的预览图位于 `docs/images/`，均为插件在 DSH 测试副本中运行时的真实截图。

| 类型 | 文件 |
| --- | --- |
| 24 姿势总览 | `docs/images/showcase-board.png` |
| 新立绘总览（19 张） | `docs/images/new-poses-board.png` |
| 关键交互动作 | `docs/images/actions-board.png` |

---

## 安装要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows 10 / 11（开发与测试环境） |
| Node.js | 18+（执行安装脚本需要） |
| DeepSeek Harness | `0.1.0-rc.6` 或同系列版本 |
| 浏览器 | Edge / Chrome 最新版 |

> 安装脚本会修改 DSH 安装目录中的前端资源文件。虽然脚本自带备份，仍建议安装前关闭 DSH 页面，并记录当前 DSH 版本号。

---

## 安装教程

### 第 1 步：获取插件

**方式 A：下载 Release（推荐）**

1. 打开 [Releases](https://github.com/Sutera-Diffusus/dsh-whale-musume/releases)；
2. 下载最新版 `dsh-whale-musume-plugin-vX.Y.Z.zip`；
3. 解压到任意目录，例如 `D:\dsh-whale-musume`。

**方式 B：克隆仓库**

```powershell
git clone https://github.com/Sutera-Diffusus/dsh-whale-musume.git
cd dsh-whale-musume
```

### 第 2 步：确认 DSH 安装目录

DSH 安装目录通常包含 `DeepSeekHarness-Launcher.exe` 和 `node_modules`。如果不确定，可以查看启动器配置：

```powershell
Get-Content "D:\Deepseek harness\DeepSeekHarness-Launcher.cfg"
```

其中 `workDir` 字段指向的就是安装目录。下文统一用 `<DSH_INSTALL_DIR>` 代替该路径。

### 第 3 步：执行安装脚本

在插件目录打开 PowerShell，执行：

```powershell
node scripts/apply-theme.mjs --assets-only --target "<DSH_INSTALL_DIR>"
node scripts/apply-theme.mjs --mascot-settings --target "<DSH_INSTALL_DIR>"
```

示例（默认安装路径）：

```powershell
node scripts/apply-theme.mjs --assets-only --target "D:\Deepseek harness"
node scripts/apply-theme.mjs --mascot-settings --target "D:\Deepseek harness"
```

也可以通过环境变量指定安装目录：

```powershell
$env:DSH_INSTALL_DIR = "D:\Deepseek harness"
node scripts/apply-theme.mjs --assets-only
node scripts/apply-theme.mjs --mascot-settings
```

脚本输出中的 `Backup:` 路径就是本次改动的备份目录，请保留到确认插件运行正常。

### 第 4 步：刷新 DSH 页面

1. 打开 DSH Web 页面（默认 `http://127.0.0.1:3080`）；
2. 强制刷新：`Ctrl + F5`；
3. 页面加载完成后，右下角应出现鲸鱼娘。

### 第 5 步：验证安装

- 点击鲸鱼娘：应出现脸红/爱心特效；
- 连续快速点击三次：应出现星星眼庆祝；
- 拖拽鲸鱼娘：应切换为「被拎起来」并跟随光标摇摆；
- 打开 DSH 设置 → 看板娘：应看到开关、养成数据和成就墙。

---

## 使用说明

### 拖拽

- 按住鲸鱼娘移动，松手后位置自动保存；
- 右键鲸鱼娘 → **回到原位**，恢复默认右下角位置。

### 右键菜单

| 菜单项 | 说明 |
| --- | --- |
| 投喂小点心 | 提升饱食度与好感度 |
| 戳一下 | 降低心情，触发生气立绘 |
| 夸夸 DS娘 | 提升心情与好感度，触发星星眼 |
| 回到原位 | 清除保存的悬浮位置 |
| 打开看板娘设置 | 跳转 DSH 设置页 |

### 设置面板

路径：DSH 设置 → **看板娘**。

| 分组 | 内容 |
| --- | --- |
| 基础 | 称呼、看板娘开关、台词气泡、粒子效果 |
| 智能 | 关键词感知、摸鱼提醒、深夜模式 |
| 养成 | 心情 / 好感度 / 饱食度 / 等级 / 签到 / 陪伴时长 |
| 成就 | 30 个成就的成就墙 |
| 位置与数据 | 重置悬浮位置、重置养成数据 |

---

## 更新 / 回滚 / 卸载

### 更新

1. 下载新版插件 zip，覆盖旧目录中的 `assets/` 和 `scripts/`；
2. 重新执行第 3 步的两条安装命令；
3. 强制刷新页面。

### 回滚

安装脚本会在 `DSH_WHALE_BACKUP`（默认 `D:\ai-temp`）目录生成备份：

```powershell
node scripts/apply-theme.mjs --rollback "<backup dir>"
```

### 卸载看板娘

```powershell
node scripts/apply-theme.mjs --mascot-settings --target "<DSH_INSTALL_DIR>" --rollback <设置备份目录>
node scripts/apply-theme.mjs --assets-only --target "<DSH_INSTALL_DIR>" --rollback <资源备份目录>
```

或直接在设置面板关闭「看板娘」开关（资源仍保留，可随时重新开启）。

---

## 数据与隐私

- 所有状态保存在浏览器 `localStorage`，键名以 `whale-moe:` 开头；
- 不包含任何 API Key、用户凭据；
- 不发送遥测、不上传数据、不访问外部网络；
- 安装脚本只读取 DSH 前端资源文件并写入备份，不读取 DSH 会话数据。

---

## 项目结构

```text
dsh-whale-musume/
├─ assets/
│  ├─ dsh-whale-moe.css          # 看板娘样式与动效
│  ├─ dsh-whale-moe.js           # DOM 表现层、状态调度、交互
│  ├─ whale-moe-core.js          # 纯函数状态机（可单元测试）
│  ├─ peek-calibration.json      # 探头立绘校准数据
│  └─ generated/                 # 47 张立绘
├─ scripts/
│  └─ apply-theme.mjs            # 安装 / 回滚 / 设置注入
├─ test/
│  ├─ whale-moe-core.test.mjs
│  ├─ whale-moe-growth.test.mjs
│  ├─ apply-theme.test.mjs
│  ├─ cdp-whale-moe.mjs
│  ├─ motion-qa.mjs
│  ├─ showcase-poses.mjs
│  └─ showcase-actions.mjs
├─ docs/
│  └─ images/                    # 预览截图
├─ LICENSE
├─ README.md
├─ CHANGELOG.md
├─ SECURITY.md
└─ CONTRIBUTING.md
```

---

## 开发与测试

```powershell
# 单元测试（37 个）
node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs test/apply-theme.test.mjs

# 动效质量检查（需要测试用 DSH 副本运行在 3181 端口）
node test/motion-qa.mjs

# 全量 CDP 验收（需要 DSH 副本 + Chrome/Edge CDP 9223）
node test/cdp-whale-moe.mjs
```

建议使用独立 DSH 副本进行开发验证，避免污染主安装。

---

## 故障排查

| 现象 | 处理 |
| --- | --- |
| 刷新后看不到鲸鱼娘 | 确认安装命令输出 `Applied`；强制刷新；检查设置面板「看板娘」开关 |
| 图片不更新 | 强制刷新（`Ctrl+F5`）；资源 URL 带版本号，浏览器缓存过旧时清理站点缓存 |
| 设置面板没有「看板娘」栏目 | 执行 `--mascot-settings` 并刷新；确认 DSH 版本兼容 |
| 拖拽误触发 | 单次点击不会触发拖拽；只有移动超过 4px 才会进入拖拽状态 |
| 想恢复默认位置 | 右键 → 回到原位 |

---

## License

[MIT](./LICENSE)

---

**DS娘陪你写代码，也陪你摸鱼。** 🐳
