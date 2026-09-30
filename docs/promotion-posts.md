# 社区投稿文案（可直接复制发布）

> 用途：把「鲸鱼娘」投放到各社区的自荐/分享位。**每个平台都请先看一遍该站版规**，标题与正文按下方各节复制即可。
> 所有文案只陈述已核实事实（版本号、测试数、功能），没有夸大与未发生的状态。

---

## 1. 小众软件论坛 · 发现频道（首选，桌宠类主场）

- 入口：https://meta.appinn.net/c/faxian/10
- **发帖前必读**：内容提交规则 https://meta.appinn.net/t/topic/43728
- 固定标题格式：`【开发者自荐】<名称> - <一句话>`（该分类里同类帖都长这样）
- 注意：该站尺度是「给普通用户看」，少讲 DSH 插件机制，多讲「装了之后是什么体验」；截图比术语有用。

**标题**

```
【开发者自荐】鲸鱼娘 - 一只会陪你写代码的桌宠，摸头能养成，工作忙时她知道闭嘴
```

**正文**

```
大家好，我做了个桌宠插件「鲸鱼娘」，主用场景是给写代码的人当陪伴。

她不是那种在屏幕上乱跑、抢你鼠标的宠物，而是安静待在右下角：
- 你空闲时，她偶尔喝口咖啡、伸个懒腰；
- 你一跑命令 / 改文件 / 跑测试，她自动抱起笔记本，摆出对应的干活姿势，带一点淡蓝光晕；
- 关键词是「不打扰」—— 工作期间她绝不弹话，只有待机时才偶尔说一句。

养成分几层：
- 摸头加好感，戳肚子会不高兴，戳尾巴有专属反应（每个部位都有独立立绘和台词）；
- 心情 / 好感 / 饱食 / 等级 / 连续签到 / 陪伴时长；
- 每日任务 + 周签到，攒够羁绊等级会解锁新动作和称号；
- 39 个成就 + 一面成就墙，设置里能看到「成长日记」（什么时候升级、什么时候拿成就）。

目前有 90+ 张立绘：待机、工作中、思考、离开、节日换装（圣诞 / 万圣 / 中秋 / 春节 / 情人节当天自动切）、天气三态（打伞 / 冷 / 雪天）、13 种梗表情（kyun、OMG、doge、膜拜、怀疑人生、waku waku…）。台词 530 多条，偏可爱向，也会玩点打工人 / 摸鱼 / DDL 的梗。

还有些我觉得挺实用的小功能：
- 天气陪伴：填个城市就有真实天气，还会下全屏的雨雪特效（工作忙时自动减弱）；
- 主动关怀：久坐 25 分钟提醒、深夜还在忙会劝你休息、离开超过 3 分钟回来会打招呼 —— 都是「陪着，不是指挥」的语气，工作态绝不插嘴；
- 小游戏：右键有个「戳泡泡·泡泡派对」，30 秒一局，摸鱼用；
- 无障碍模式（默认关）：可以 Tab 聚焦、回车摸头、方向键微调位置，状态会读屏播报。

隐私上比较克制：所有数据只在本机（localStorage），无遥测、不上传、不访问外部网络；天气城市留空就是零联网；没有任何 API Key。卸载就干净移除，不改宿主任何文件。

支持两套环境：DeepSeek Harness 桌面端（Electron 壳）和它的旧版网页端。MIT 协议，源码在这里：
https://github.com/Sutera-Diffusus/dsh-whale-musume

（如果你也在用 DeepSeek Harness，装法在 README 里；不是这个用户的话，可以先看看截图，她主要是长这样：<贴 2-3 张运行截图>）

有任何建议或者想要的功能，回帖告诉我。
```

---

## 2. V2EX · 分享创造

- 入口：https://www.v2ex.com/go/create
- **硬门槛：账号注册需满 30 天才能在该节点发帖**（多人实测，官方节点权限限制）。发帖前先确认你的账号年龄。
- 该站偏开发者，可以多讲一点实现与踩坑；但别写成广告，V2EX 对纯推广很敏感。

**标题**

```
[分享创造] 给 DeepSeek Harness 写了个桌宠：鲸鱼娘，顺便踩完了桌面端的适配坑
```

**正文**

```
最近把「鲸鱼娘」这个桌宠插件适配到了 DSH 桌面端（内嵌 0.2.0-rc.2），顺手把踩到的坑记下来，可能对其他插件作者有用。

插件本身：一只待在右下角的看板娘，检测到工具运行会摆出对应的干活姿势；摸头养成、39 个成就、90+ 立绘、530+ 台词，本机运行无遥测。桌面端和旧版网页端都支持。

适配时踩到的坑（都修了）：
1. 引导弹窗误判 —— 0.2.0-rc.2 刷新后常驻一个 role="dialog" 的引导弹窗，我原来用它判断「设置页」，结果首页被判成设置页，桌宠 display:none 永久隐藏。改成真正的面板根 [data-shortcut-modal="settings"]。
2. 工具卡标记换代 —— 旧的 [data-role="tool"] 之类全库 0 命中，新的是 [data-tool]（值就是工具名）+ 同元素 data-state。
3. 历史工具卡钉住忙态 —— 工具卡跑完仍留在 DOM（state 变 ok/stopped），按「存在即忙」判断会让桌宠永远摆 running。只能按 running/preparing 取值匹配。
4. 主题属性搬家 —— 明暗写在 body[data-ds-dark-theme]（空串=暗），html 上是 data-ds-theme-source。
5. 惰性 CJS 契约 —— 副作用要在 factory 物化期发生，boot() 得从 apply() 里挪进 factory。
6. 还有个冷启动 bug：toolGoneAt 初值 0 被「首次下沿」分支当成刚消失的工作信号，首屏会摆 running 并念工具台词。

逐条证据（带 DSH 源码行号）写在这里了：docs/desktop-0.2.0-rc.2-contract.md
仓库：https://github.com/Sutera-Diffusus/dsh-whale-musume （MIT，142 个单元测试全绿）

截图：<贴 2-3 张>
```

---

## 3. GitHub Discussions · 官方「Show Your Plugins!」

- 状态：**已发布** → https://github.com/deepseek-ai/deepseek-harness/discussions/8463
- 分类：`Show Your Plugins!`（slug `show-your-plugins`）
- 后续：有回帖时在帖子内跟进；重要更新可在原帖追加评论而不是重复开新帖。

---

## 3b. DSH-Store · 分类纠正（已提交）

- 事实：我们**已被 DSH-Store 自动收录**（`status: approved`、`version 2.2.0`、固定 Commit `156dce7`、`updatePolicy: user-reviewed`），**无需再申请上架**。
- 问题：条目被派生成 `themes`（主题/皮肤）类，名称「鲸娘主题」，检索词全是「主题/皮肤/背景/界面美化」；而同类桌宠（`pet-whale`、`dsh-codex-pet`）都在 **`fun`** 类。搜「桌宠 / 看板娘 / 宠物」找不到我们。
- 根因（已修）：目录的分类/描述派生自 manifest 的 `description`，而原文 `A whale-girl Kanban Musume mascot for DeepSeek Harness` 缺少 pet/mascot 关键词。已把 `package.json` 的 description 改为含「桌面宠物 / 看板娘 / desktop pet mascot」，并推送（版本号保持 `2.2.0`，走同版本固定源更新通道）。
- 已提交纠正 Issue：https://github.com/AI-Scarlett/DSH-Store/issues/1249 （请求重新派生元信息，建议 `categories: ["fun"]`）
- 注意：DSH-Store **只接受 GitHub 仓库，明确不接受 npm-only**；因此本项与「是否发 npm」无关（早期判断已修正）。

---

## 3c. 英文社区（文案已备，需你本人账号发布）

英文社群的规则比中文社群更硬：Hacker News 要求「Show HN」必须是你能回答的实物、且不允许纯推广；Reddit 多数 sub 有 9:1 参与比。**因此这里只给文案，发布与否由你决定。**

**Show HN 标题（≤80 字符）**

```
Show HN: Whale-girl desktop pet for DeepSeek Harness (desktop + web)
```

**Show HN 正文（首帖正文要短，放链接前先说明是什么）**

```
I built a desktop-pet plugin for DeepSeek Harness: a whale-girl who idles in the corner,
picks up a laptop when a tool call starts running, and never talks while you're working.

Highlights: pat-to-raise growth, 90+ artworks, 39 achievements, optional weather companion,
optional MiMo TTS line playback, a built-in settings panel, and an accessibility mode.
Local-first: no telemetry, no external requests (weather only if you set a city).

v2.2.0 adds support for the DeepSeek Harness Desktop app (Electron shell with bundled DSH
0.2.0-rc.2) alongside the classic web UI. The desktop port surfaced a few contract changes
worth knowing if you write DSH plugins: tool cards moved to [data-tool] + same-element
data-state, dark mode lives on body[data-ds-dark-theme] (empty string = dark), and the
lazy-CJS client model expects side effects at factory materialization time. I wrote the
whole audit up with file:line evidence.

MIT, 142 unit tests. Repo: https://github.com/Sutera-Diffusus/dsh-whale-musume
```

**Reddit（r/DeepSeek 或 r/LocalLLaMA 之类）**：把上面正文改成「先说清楚是什么 → 一张截图 → 仓库链接 → 一句话说明无遥测」，并且**先在该 sub 正常参与几轮再发自己的东西**，否则容易被当 spam 或被版主删。

**dev.to / 技术博客**：适合把「给第三方 UI 插件做版本适配」的过程写成一篇技术文（惰性 CJS、DOM 契约换代、固定 Commit 审核），比纯推广贴更容易被推。要写的话我可以出全文。

---

## 4. 已提交的目录 / 店铺 / 社区（台账）

| 位置 | 提交物 | 状态 |
|---|---|---|
| GitHub 官方 Discussions · Show Your Plugins! | [discussion #8463](https://github.com/deepseek-ai/deepseek-harness/discussions/8463) | **已发布** ✅ |
| kejixiaoliang/awesome-dsh-plugins | [PR #113](https://github.com/kejixiaoliang/awesome-dsh-plugins/pull/113) 收录进「桌宠 / 表情 / 贴纸」 | open，待维护者合并 |
| 0xsline/awesome-deepseek-harness（1123★） | [PR #669](https://github.com/0xsline/awesome-deepseek-harness/pull/669) 更新条目描述（补桌面端支持） | open，待维护者合并 |
| vvlife/awesome-deepseek-harness-plugins → WhaleHub | [PR #156](https://github.com/vvlife/awesome-deepseek-harness-plugins/pull/156) 收录进「Web UI & Skins」 | open，CI 规则自动审 |
| WhaleHub 自动快照（`PLUGINS.md`） | 无需动作（`dsh-plugin` topic 每日同步） | **已收录** ✅ |
| DSH-Store 目录 | 自动收录（`approved`，v2.2.0） | **已上架** ✅ |
| DSH-Store 分类纠正 | [Issue #1249](https://github.com/AI-Scarlett/DSH-Store/issues/1249) | open，待重新派生元信息 |
| dshbase（中文站） | 已标注「已验证 · 实测可装」；徽章已进 README | **已收录** ✅ |
| kingselyjoe/awesome-dsh-list | 已收录（条目较旧，仓库 8/17 后未推送，暂不提 PR） | **已收录** ✅ |
| dsh-meme-hub（专收皮肤/桌宠） | 已收录并配展示图 | **已收录** ✅ |

---

## 5. 尚未投放 / 需要你决定

1. **视频图文平台（B 站 / 小红书 / 抖音）**：桌宠类在这些平台的表现通常好过论坛，但需要**真实操作录屏**（我不能替你录屏，也不适合代运营）。可用素材在 `docs/images/`（首页宣传图 + 5 张运行截图 + 4 张海报）。
2. **英文社区**：文案见第 3c 节，需要你的账号（HN/Reddit 对自我推广有硬规则）。
3. **npm 发布**：与 DSH-Store 无关（已确认它只收 GitHub 仓库）；发 npm 的收益主要是 `dsh plugin add dsh-whale-musume` 这种短安装命令。要用你的账号与包名，需你确认。

