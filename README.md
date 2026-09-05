<div align="center">
  <a href="https://github.com/Sutera-Diffusus/dsh-whale-musume">
    <img src="docs/images/logo.png" alt="鲸鱼娘 logo" width="128">
  </a>
  <h1>鲸鱼娘 · dsh-whale-musume</h1>
  <p>为 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 打造的桌面看板娘插件。</p>
  <p>一只会陪你写代码的鲸鱼娘：待机安静陪伴，工作开始就抱起笔记本陪你干活；<br>可以摸头养成、解锁成就，也可以拖着她到处走。所有资源本地运行，无遥测、无外部请求。</p>

  <p>
    <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-2.0.1-4da3ff" alt="版本 2.0.1"></a>
    <a href="https://github.com/Sutera-Diffusus/dsh-whale-musume/releases/latest"><img src="https://img.shields.io/badge/下载-最新版-31df76" alt="下载最新版"></a>
    <a href="https://github.com/Sutera-Diffusus/dsh-whale-musume/releases"><img src="https://img.shields.io/github/downloads/Sutera-Diffusus/dsh-whale-musume/total?label=downloads&color=31df76" alt="总下载量"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-6f42c1" alt="MIT license"></a>
    <a href="https://github.com/Sutera-Diffusus/dsh-whale-musume/discussions"><img src="https://img.shields.io/badge/Discussions-交流-blue" alt="GitHub Discussions"></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/DSH-0.1.0--rc.6%20%2B%20(0.1.1--rc.2%20实测)-0078D4" alt="DSH 0.1.0-rc.6+">
    <img src="https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white" alt="Windows">
    <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js 18+">
    <img src="https://img.shields.io/badge/单元测试-102%20项全绿-31df76" alt="102 项单元测试">
  </p>

  <p>
    <a href="https://github.com/Sutera-Diffusus/dsh-whale-musume/releases/latest">下载最新版</a>
    ·
    <a href="#效果预览">查看效果预览</a>
    ·
    <a href="#安装教程">安装教程</a>
  </p>

  <p>
    <a href="README.en.md">English</a> · <a href="README.md">中文</a>
  </p>
</div>

![鲸鱼娘：我来找你啦](docs/images/homepage-promo.png)

---

## 目录

- [特性](#特性)
- [效果预览](#效果预览)
- [安装要求](#安装要求)
- [安装教程](#安装教程)
- [第一次使用](#第一次使用)
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
- **拖拽惯性**：松手后按瞬时速度滑行一小段并旋转回正，撞到屏幕边缘就「抓住」边缘停住；轻放只做一次轻微回弹，位置在滑行结束后才保存；
- 待机时保持稳定表情，随机出现喝咖啡、伸懒腰、吃东西等日常小动作；
- 待机与工作状态之间使用「下压 → 换图 → 弹起」的动势遮断过渡，不会叠影，不会闪黑；
- 在设置里关掉她之后，左下角会留一枚唤回按钮（🐋），点一下就把她叫回来，不会再「消失得找不着」。

### 💼 工作状态联动

- 检测到工具运行（`data-running` / `data-state="ongoing"`）自动切换为「抱笔记本工作」；
- 工作中带淡蓝光晕和「工作中」标签；
- 工作状态下点击她，会随机出现「害羞抱电脑」或「偷吃内存条」的反应，不会打断工作状态；工作期间保持 running 姿势稳定，不再随机切小剧场；
- **按工具类型切换姿态**：跑命令、改文件、搜索、测试、评审、部署、调试各有对应姿势（全部复用已有的工作立绘，不新增素材）。识别不了会回落到通用工作姿势，不会乱猜。

### 🪙 余额关心

- 新增「余额」分组，显示当前账户余额，并让她用一句话说明情况（分 充裕 / 正常 / 偏紧 / 告急 / 已见底 五档，29 条台词）；
- 数据来自**本机**余额代理（`127.0.0.1:3020`，即 `dsh-statusbar` 的 balance-proxy）。代理只监听 127.0.0.1、不回显密钥，上游请求在服务端完成，所以浏览器侧依然只访问本机，**不违背「无外部请求」的承诺**；
- **默认关闭**，开启后 60 秒查一次（与代理缓存对齐）；代理没开或查不到时静默失败，不弹错、不刷日志；
- 沿用「忙碌时不露脸」：只在待机时播报。余额充裕时几乎不提，偏紧时才常提醒；
- 介意金额被看到？关掉「余额显示数字」就只显示档位措辞，截图不泄露余额。

### 🎨 立绘与表情（90+ 张）

- 全场景立绘：待机、工作中、思考、离开，以及摸头 / 戳肚子 / 戳尾巴分区互动立绘；
- 成长立绘：升级、成就达成、每日任务完成、甩尾；
- 游戏四态（思考 / 小得意 / 获胜 / 惜败）、天气三态（打伞 / 冷 / 雪天）；
- 节日自动换装：圣诞 / 万圣 / 中秋 / 春节 / 情人节当天自动切换；
- 13 种梗表情关键词感知：kyun、OMG、doge、sike、膜拜、peace、怀疑人生、waku waku 等，命中即变身表情包。

### 💬 梗聊天与天气陪伴

- 530+ 条台词：全场景覆盖，可爱为主，叠加打工人、摸鱼、DDL、画饼、发疯文学等安全梗；
- 5–8 分钟主动闲聊：按当前任务内容本地分类贴题，不尬聊；工作态绝不插嘴；
- 分时问候：早上/上午/中午/下午/傍晚带关心话，深夜 23:00–5:59 不主动打扰；
- 心情分层台词：心情低落时温柔、高涨时元气，羁绊等级解锁专属台词（Lv3/Lv5/Lv7）；
- 天气陪伴：设置 → 看板娘 → 天气，填写城市（选填 API Key）并测试连接；Open-Meteo 免费无需 Key，城市留空零联网；
- 天气视觉特效：全屏氛围特效（雨/雪/雷闪/风/雾/热浪/霜雾），随真实天气自动切换，工作态自动降档，可在设置中关闭。

### 💗 主动关怀

- 四条主动关怀线：久坐提醒（连续忙 25 分钟）、深夜劝休息（23 点后仍在忙）、卡住陪伴（同一状态停滞 8 分钟）、回来打招呼（离开超过 3 分钟）；
- 铁律是「陪着，不是指挥」——**工作态绝不插嘴**，台词是提醒而非催促（共 19 条）；
- 关怀之间至少间隔 15 分钟，避免变成噪音；可在设置中整体关闭。

### ♿ 无障碍模式

- 桌宠默认是 `aria-hidden` 的纯装饰；开启无障碍模式后，可 Tab 聚焦、Enter/Space 摸头、方向键微调位置（Shift 加速），状态变化经 `aria-live` 播报；
- 使用 `role="button"` + 动态 aria-label（含自定义自称），焦点可见；
- **默认关闭**：不给默认体验添负担，但给有需要的人留一条路。

### 🎀 互动与特效

- 单击摸头：脸红立绘 + 爱心/星星 emoji 飞出；
- 分区互动：点她不同部位（头 / 肚子 / 尾巴）有专属立绘、特效与台词；
- 关键词表情：聊天命中 13 个梗关键词时，鲸鱼娘现场变身表情包；
- 三连击：星星眼庆祝 + 粒子特效 + 旋转动画；
- 右键菜单：投喂 / 戳一下 / 夸夸 / 小游戏：戳泡泡 / 回到原位 / 打开设置；
- 点击反应即时切换，不做拖沓过渡。

### 🫧 小游戏「戳泡泡·泡泡派对」

- 4×4 泡泡网格，普通/星星/炸弹三种泡泡，连击加分，30 秒一局三档结算；
- 鼠标点击 + 键盘方向键游标 + Enter 引爆 + Esc 退出，双通道可达；
- 每日 3 局养成奖励上限，多玩只计分不刷好感；
- 工作状态、设置页打开时均可正常游玩，仅页面隐藏时暂停；
- 刷新纪录、连击、首胜均有专属成就。

### 📈 养成与成就

- 心情、好感度、饱食度、等级、连续签到、陪伴时长；
- 每日任务：3 个任务槽每日自动刷新，完成领取好感奖励；
- 周签到：本周签到板 7 格，集满 1/3/7 天有里程碑奖励；
- 羁绊等级解锁：Lv3 新待机动作、Lv5 称号「鲸汐守护者」、Lv7 隐藏彩蛋；
- 39 个成就：互动类、陪伴类、DSH 用量类、游戏类、任务类；
- 设置面板内置**成就墙**，已解锁高亮、未解锁灰显；
- **成长日记**：按时间记录关键节点（羁绊升级、成就解锁），设置面板倒序展示最近 12 条并标注相对时间；同一天同类事件只记一条，最多保留 80 条，全部留在本地。

### 🌗 主题适配

- 跟随宿主明暗主题：识别 DSH 的 `data-theme` / `dark` class，退化到系统 `prefers-color-scheme`；
- 只影响气泡、菜单这类 UI 元素，**立绘不做滤镜**，不改画风；
- 仅在主题变化时写入，不做每帧探测。

### ⚙️ 设置面板

- 看板娘设置集成在 DSH 设置页中；
- 折叠分组：陪伴表现 / 天气 / 余额 / 日常与养成 / 成就墙 / 成长日记 / 数据与重置，总览卡与分组卡等宽对齐；
- 胶囊开关：看板娘 / 台词气泡 / 粒子效果 / 小游戏 / 关键词感知 / 摸鱼提醒 / 深夜模式 / 天气特效 / 工具细分 / 拖拽惯性 / 主动关怀 / 无障碍 / 余额关心 / 余额显示数字；
- 默认关闭的开关：关键词感知（涉及读取聊天内容）、无障碍、余额关心、余额显示数字（涉及账户金额）；
- 日常与养成用标签页收纳：今日任务 / 本周签到 / 称号，与成就墙同区管理；
- 总览卡内可直接改「如何称呼我」与**「她的自称」**——后者留空即默认的「鲸鱼娘」，她提到自己时的说法会整体跟着变（台词库 363 处自称统一替换）；
- 养成数据使用横排小卡片展示，信息密度合理。

### 🧩 工程特性

- 纯前端注入，不修改 DSH 业务 DOM；
- 所有改动可备份、可回滚；
- 资源文件带版本号，升级后强制刷新缓存；
- **立绘预加载**：首屏只预载 5 张常用姿势，其余 90+ 张在空闲时段每 120ms 取一张（优先 `requestIdleCallback`），冷启动切姿势不迟滞，预取失败完全静默；
- 核心状态机与表现层分离，便于二次开发。

---

## 效果预览

> 以下为插件在 DSH 中运行时的真实截图。仓库中的立绘总览图位于 `docs/images/`。

### 实际运行截图

| 场景 | 说明 |
| --- | --- |
| <img src="docs/images/preview-idle-coffee.png" alt="待机陪伴：喝咖啡小动作" width="560"> | **待机陪伴**：默认悬浮在右下角，安静不打扰；待机时随机出现喝咖啡、伸懒腰等日常小动作。[查看原图](docs/images/preview-idle-coffee.png) |
| <img src="docs/images/preview-working.png" alt="工作状态：抱起笔记本陪你干活" width="560"> | **工作状态联动**：检测到工具运行自动切换为「抱笔记本工作」，带淡蓝光晕；工作态不闲聊、不插嘴。[查看原图](docs/images/preview-working.png) |
| <img src="docs/images/preview-headpat.png" alt="摸头互动：台词气泡反馈" width="560"> | **摸头互动**：单击摸头触发专属立绘与台词气泡——「舒服是舒服，可是发型会乱啦💢」。[查看原图](docs/images/preview-headpat.png) |
| <img src="docs/images/preview-feeding.png" alt="投喂互动：吃东西反应" width="560"> | **投喂互动**：右键 → 投喂小点心，提升饱食度与好感度，触发吃东西立绘——「啊呜——好吃！」。[查看原图](docs/images/preview-feeding.png) |
| <img src="docs/images/preview-idle-sparkle.png" alt="待机形态：收起侧边栏后的悬浮形态" width="560"> | **悬浮形态**：200px 默认尺寸，可随意拖拽，松手后位置自动保存；右键可一键回到原位。[查看原图](docs/images/preview-idle-sparkle.png) |

### 立绘与海报总览

| 类型 | 文件 |
| --- | --- |
| 24 姿势总览 | `docs/images/showcase-board.png` |
| 新立绘总览（19 张） | `docs/images/new-poses-board.png` |
| 关键交互动作 | `docs/images/actions-board.png` |
| 官方海报 v1–v4 | `docs/images/promo-poster-v1.png` ~ `promo-poster-v4.png` |

---

## 安装要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows 10 / 11（开发与测试环境） |
| Node.js | 18+（执行安装脚本需要；组合包方式不需要） |
| DeepSeek Harness | `0.1.0-rc.6` 及以上；设置面板已适配并在 `0.1.1-rc.2` 实测 |
| 浏览器 | Edge / Chrome 最新版 |

> 脚本安装方式会修改 DSH 安装目录中的前端资源文件。虽然脚本自带备份，仍建议安装前关闭 DSH 页面，并记录当前 DSH 版本号。追求零侵入请使用组合包方式。

---

## 安装教程

鲸鱼娘提供两种安装方式，**二选一，不要混用**：

| 方式 | 原理 | 适合人群 |
| --- | --- | --- |
| **A. 组合包安装（推荐）** | 标准 DSH bundle，声明 `dsh.bundle.patch`，经 `settings.section` slot 注册设置面板，不改写任何内置包文件 | 普通用户；DSH 0.1.1-rc.2 及更高版本 |
| **B. 脚本安装** | 安装脚本注入前端资源与设置面板，自带备份与回滚 | 主题集成场景；旧版 DSH |

### 方式 A：组合包安装（零侵入，推荐）

鲸鱼娘同时提供标准 DSH 组合包形态，可直接经 dsh plugin 或插件市场（如 mydsh.dev）安装：

```powershell
dsh plugin --profile web add github:Sutera-Diffusus/dsh-whale-musume
```

安装后重启 dsh web 并强制刷新页面（`Ctrl+F5`），鲸鱼娘会自动出现。此模式：

- 宿主插件只注册只读静态资源路由 `/api/dsh-whale-musume/assets`，向浏览器提供样式/脚本/立绘；
- 浏览器插件注入鲸鱼娘本体，资源全部来自本机，无外部请求、无遥测；
- 开关与模式偏好走鲸鱼娘自带齿轮菜单（localStorage，键名 `whale-moe:*`）；
- 「看板娘」设置面板（胶囊开关/养成数据/成就墙/天气）由浏览器插件经 `settings.section` slot 注册进 DSH 设置页，**不改写任何内置包文件**，因此在 0.1.1-rc.2 及更高版本上同样可用；
- 兼容性兜底：`slots` 服务缺失或子 slot 渲染异常时，设置面板回落到内置渲染，桌宠本体不受影响。

### 方式 B：脚本安装

#### 第 1 步：获取插件

**下载 Release（推荐）**

1. 打开 [Releases](https://github.com/Sutera-Diffusus/dsh-whale-musume/releases)；
2. 下载最新版 `dsh-whale-musume-plugin-vX.Y.Z.zip`；
3. 解压到任意目录，例如 `D:\dsh-whale-musume`。

**或克隆仓库**

```powershell
git clone https://github.com/Sutera-Diffusus/dsh-whale-musume.git
cd dsh-whale-musume
```

#### 第 2 步：确认 DSH 安装目录

DSH 安装目录通常包含 `DeepSeekHarness-Launcher.exe` 和 `node_modules`。如果不确定，可以查看启动器配置：

```powershell
Get-Content "<DSH_INSTALL_DIR>\DeepSeekHarness-Launcher.cfg"
```

其中 `workDir` 字段指向的就是安装目录。下文统一用 `<DSH_INSTALL_DIR>` 代替该路径。

#### 第 3 步：执行安装脚本

在插件目录打开 PowerShell，执行：

```powershell
node scripts/apply-theme.mjs --assets-only --target "<DSH_INSTALL_DIR>"
node scripts/apply-theme.mjs --mascot-settings --target "<DSH_INSTALL_DIR>"
```

也可以通过环境变量指定安装目录：

```powershell
$env:DSH_INSTALL_DIR = "<DSH_INSTALL_DIR>"
node scripts/apply-theme.mjs --assets-only
node scripts/apply-theme.mjs --mascot-settings
```

脚本输出中的 `Backup:` 路径就是本次改动的备份目录，请保留到确认插件运行正常。

#### 第 4 步：刷新 DSH 页面

1. 打开 DSH Web 页面（默认 `http://127.0.0.1:3080`）；
2. 强制刷新：`Ctrl + F5`；
3. 页面加载完成后，右下角应出现鲸鱼娘。

---

## 第一次使用

安装完成后，按下面的顺序验证核心功能是否正常：

1. **点击鲸鱼娘**：应出现脸红/爱心特效；
2. **连续快速点击三次**：应出现星星眼庆祝 + 粒子特效；
3. **拖拽鲸鱼娘**：应切换为「被拎起来」立绘并跟随光标摇摆，松手后位置自动保存；
4. **右键鲸鱼娘**：应看到投喂 / 戳一下 / 夸夸 / 戳泡泡小游戏 / 回到原位 / 打开设置的菜单；
5. **打开 DSH 设置 → 看板娘**：应看到胶囊开关、养成数据和成就墙；
6. **跑一次工具调用**：鲸鱼娘应自动切换为「抱笔记本工作」并带淡蓝光晕。

以上全部通过后，就可以在设置 → 看板娘 → 天气里填写城市开启天气陪伴，或从每日任务开始养成之路了。

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
| 夸夸 鲸鱼娘 | 提升心情与好感度，触发星星眼 |
| 回到原位 | 清除保存的悬浮位置 |
| 打开看板娘设置 | 跳转 DSH 设置页 |

### 设置面板

路径：DSH 设置 → **看板娘**。

| 分组 | 内容 |
| --- | --- |
| 陪伴表现 | 称呼、看板娘开关、台词气泡、粒子效果、关键词感知、摸鱼提醒、深夜模式、工具细分、拖拽惯性、主动关怀、无障碍 |
| 天气 | 天气城市、选填 API Key、天气特效开关 |
| 余额 | 余额关心开关、余额显示数字开关、当前余额与档位（默认关闭） |
| 日常与养成 | 今日任务 / 本周签到 / 称号三个标签页 |
| 成就墙 | 39 个成就，已解锁高亮、未解锁灰显 |
| 成长日记 | 羁绊升级、成就解锁等关键节点，倒序展示最近 12 条 |
| 数据与重置 | 重置悬浮位置、重置养成数据 |

---

## 更新 / 回滚 / 卸载

### 更新

**组合包方式**：通过 dsh plugin 更新到最新版本后重启 dsh web 并强制刷新。

**脚本方式**：

1. 下载新版插件 zip，覆盖旧目录中的 `assets/` 和 `scripts/`；
2. 重新执行方式 B 第 3 步的两条安装命令；
3. 强制刷新页面。

### 回滚

安装脚本会在 `DSH_WHALE_BACKUP`（默认 `<BACKUP_DIR>`）目录生成备份：

```powershell
node scripts/apply-theme.mjs --rollback "<backup dir>"
```

### 卸载看板娘

**组合包方式**：通过 dsh plugin 移除即可，无任何残留文件改写。

**脚本方式**：

```powershell
node scripts/apply-theme.mjs --mascot-settings --target "<DSH_INSTALL_DIR>" --rollback <设置备份目录>
node scripts/apply-theme.mjs --assets-only --target "<DSH_INSTALL_DIR>" --rollback <资源备份目录>
```

或直接在设置面板关闭「看板娘」开关（资源仍保留，可随时重新开启；关闭后左下角会出现唤回按钮 🐋）。

---

## 数据与隐私

- 所有状态保存在浏览器 `localStorage`，键名以 `whale-moe:` 开头；
- 不包含任何 API Key、用户凭据；
- 不发送遥测、不上传数据、不访问外部网络；
- 安装脚本只读取 DSH 前端资源文件并写入备份，不读取 DSH 会话数据；
- 天气功能为**选填**：城市留空时零联网；填写城市后默认走 Open-Meteo 免费接口（无需 Key）；
- 余额功能**默认关闭**：开启后也只访问本机余额代理（`127.0.0.1:3020`），代理不回显密钥，浏览器侧不发起任何外部请求；关掉「余额显示数字」后界面只显示档位措辞，截图不泄露金额。

---

## 项目结构

```text
dsh-whale-musume/
├─ assets/
│  ├─ dsh-whale-moe.css          # 看板娘样式与动效
│  ├─ dsh-whale-moe.js           # DOM 表现层、状态调度、交互
│  ├─ whale-moe-core.js          # 纯函数状态机（可单元测试）
│  ├─ peek-calibration.json      # 探头立绘校准数据
│  └─ generated/                 # 90+ 张立绘（状态/互动/成长/游戏/天气/节日/表情）
├─ scripts/
│  ├─ apply-theme.mjs            # 安装 / 回滚 / 设置注入
│  ├─ gen-assets.py              # 立绘生成管线（调用第三方图像接口，密钥走环境变量）
│  ├─ build-assets.py            # 立绘资产构建
│  ├─ build-review.py            # 生成立绘审阅页
│  └─ slice-batch.py             # 海报切图
├─ test/
│  ├─ whale-moe-core.test.mjs
│  ├─ whale-moe-growth.test.mjs
│  ├─ whale-moe-game.test.mjs
│  ├─ whale-moe-fx.test.mjs
│  ├─ whale-moe-quest.test.mjs
│  ├─ whale-moe-zones.test.mjs
│  ├─ apply-theme.test.mjs
│  ├─ cdp-whale-moe.mjs
│  ├─ motion-qa.mjs
│  ├─ soak-work.mjs
│  ├─ showcase-poses.mjs
│  └─ showcase-actions.mjs
├─ docs/
│  └─ images/                    # logo、运行截图与立绘总览图
├─ LICENSE
├─ README.md
├─ CHANGELOG.md
├─ SECURITY.md
└─ CONTRIBUTING.md
```

---

## 开发与测试

```powershell
# 单元测试（102 个）
npm test
# 或等价命令：
node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs test/apply-theme.test.mjs test/whale-moe-game.test.mjs test/whale-moe-fx.test.mjs test/whale-moe-quest.test.mjs test/whale-moe-zones.test.mjs

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
| 刷新后看不到鲸鱼娘 | 确认安装命令输出 `Applied`（组合包方式确认插件已启用）；强制刷新；检查设置面板「看板娘」开关 |
| 在设置里关掉了找不到她 | 左下角有一枚唤回按钮（🐋），点一下即可叫回 |
| 图片不更新 | 强制刷新（`Ctrl+F5`）；资源 URL 带版本号，浏览器缓存过旧时清理站点缓存 |
| 设置面板没有「看板娘」栏目 | 脚本方式执行 `--mascot-settings` 并刷新；组合包方式确认 DSH 为 0.1.1-rc.2+；确认 DSH 版本兼容 |
| 拖拽误触发 | 单次点击不会触发拖拽；只有移动超过 4px 才会进入拖拽状态 |
| 想恢复默认位置 | 右键 → 回到原位 |
| 两种安装方式混用了 | 先用对应方式完整卸载/回滚，再任选一种重新安装 |

---

## License

[MIT](./LICENSE)

---

**鲸鱼娘陪你写代码，也陪你摸鱼。** 🐳
