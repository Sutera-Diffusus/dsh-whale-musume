# GitHub Inbox · 周整理与处置清单

- **仓库**:[Sutera-Diffusus/dsh-whale-musume](https://github.com/Sutera-Diffusus/dsh-whale-musume)
- **维护账户**:`Sutera-Diffusus` · **整理日期**:2026-09-05
- **执行通道**:`gh` CLI(OAuth 令牌,scopes: gist / read:org / repo / workflow)✅ 读写正常

## 1. 仓库 Inbox(收到的 PR / Issue)

| 类型 | # | 标题 | 作者 | 状态 | 处置 |
|------|---|------|------|------|------|
| Issue | 9 | feat: 可选接入 MiMo TTS,PCM 流式台词播报 | ppy-web | OPEN | ✅ 已回复确认边界并邀请提交 PR + 打 `enhancement` 标签 |
| PR | 7 | fix: 出错后鲸鱼娘永久停留「翻车」立绘 | wrzrmzx | 已合并 | ✅ 无遗留 |
| PR | 2 | fix: 右键设置 + bundle 补设置面板 v1.4.2 | haitang1 | 已合并 | ✅ 无遗留 |
| Issue | 6 | bundle 模式设置面板缺失 | ppy-web | 已关闭 | ✅ 随 PR #2 修复 |
| Issue | 5 | 关闭板娘后找回入口建议 | VectorAC | 已关闭 | ✅ v1.5.0 落地 |
| Issue | 4 | 自定义看板娘自称 | Vulpexl | 已关闭 | ✅ v1.5.0 落地 |
| Issue | 3 | 右键设置无反应 + 面板缺失 | haitang1 | 已关闭 | ✅ 随 PR #2 修复 |

## 2. 通知收件箱(逐条处置)

| 线程 | 状态 | 处置 |
|------|------|------|
| **AI-Scarlett/DSH-Store #393 作者修复请求** | open | ✅ **已整改并回复**:① v2.0.0 → v2.0.1;② 新增 `dsh.compatibility.dshReleases`(0.1.2-rc.1/0.1.1-rc.2 compatible,alpha 两版 unknown);③ 血缘修复(graft merge 恢复 `a61b09d` 直系祖先,compare 现为 `ahead / 14 ≤ 200`);④ 回复请求复检([评论](https://github.com/AI-Scarlett/DSH-Store/issues/393#issuecomment-5548554320)) |
| deepseek-ai #215 插件精选列表 | 讨论中 | ✅ 已读:新评论是他人求收录,与己无关 |
| hashgraph #175 awesome-ai-plugins | 已合并 | ✅ 已读:用户选择不认领 HOL Registry(不影响任何收录,只是没有 Owner-verified 徽章) |
| deepseek-ai #688 DSH精选插件聚合仓库 | 已收录 | ✅ 已读:like-study1 已收录并定期自动同步 topic,无需动作 |
| deepseek-ai #999 环境隔离 Ideas | 讨论中 | ✅ 已读:weijiafu14 补充 profile 方案(提及但无定向问题),无需回复 |
| fendouai #47 | 已直合 main | ✅ 已读:内容已直合(1f27770) |
| deepseek-ai #2779 第三方模型烧 token | 讨论中 | ✅ 已读:本人已解答过,新评论无定向内容 |
| **Axorax #278 Add: Weiyu** | open(审阅要求修改) | ✅ **已修改并推送**:去掉描述开头 "A"、绿标链接到仓库(commit 6af4e58),已回复审阅人([评论](https://github.com/Axorax/awesome-free-apps/pull/278#issuecomment-5548558232));等维护者复看合入 |
| awesome-dsh-plugin #3618 | 已关闭 | ✅ 已读 |
| bruc3van #113 | 已合并 | ✅ 已读 |
| dsh-tauri #205 | 已转流程 | ✅ 已读:按维护者指引转 dsh-tauri-plugins **#18**(open,等维护者) |

## 3. 遗留待办(用户侧)

1. **等待项**:dsh-tauri-plugins #18、Axorax #278(已交修改,等复看)。
2. **DSH STORE 复检**:等商城 8 小时自动化跑过 #393 整改(推送于 2026-09-05,commit `ad9f110`);若复检仍有阻断项,继续跟进。

## 4. 关键修复记录(DSH STORE)

- **血缘修复**:远端 main 曾被整体 rebase,商城固定 Commit `a61b09d` 不再是候选祖先 → 更新无限期暂缓。已用 graft merge(非 force-push,历史零破坏)把原始血缘接回 main,新 HEAD `ad9f110` 满足「有界直接后继」(ahead,14 commits ≤ 200)。
- **兼容声明**:`dsh.compatibility.dshReleases` 逐版本矩阵中,`0.1.2-rc.1: compatible` 为**作者级来源声明**(核心状态机 DOM-free + 信号检测抗性分析),非 0.1.2-rc.1 运行时验收;升级 DSH 后建议补跑 `npm test` + `npm run qa`(已写入 CHANGELOG v2.0.1 说明)。

## 5. 通道备忘

- 本机 `gh` CLI 读写全部正常,处置操作统一走 `gh`;DSH 内置 MCP 与 `.credentials.yaml` 的细粒度 PAT 对 Issues 写、Notifications 读受限(403),不影响经 `gh` 执行。
