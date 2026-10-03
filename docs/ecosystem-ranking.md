# 生态位置与竞品基线

> 记录时间：2026-10-03 · 数据来源：GitHub 搜索 API / 仓库 API / 各目录线上清单（均为实时拉取）
> 用途：下次复盘时有可比对的基线。**数字会变，方法可复用**（文中附获取方式）。

---

## 1. 排名（按 topic 口径）

GitHub 的 `topic:` 限定符**不是精确匹配**——它会把名字/描述里含该词的仓库也算进来，
所以池子里会出现几十万星的大项目（如 `deepseek-ai/deepseek-harness` ★242k）。
因此下表分「对口池」与「大池」两种口径看，避免被大池的名次误导。

| 口径 | 名次 | 池子规模 | 备注 |
|---|---|---|---|
| `topic:desktop-mascot` | **第 2** | 46 | 最对口；第 1 是 uDesktopMascot ★354 |
| `topic:desktop-pet` | 第 42 | 1515 | 前 3% |
| `topic:deepseek-harness` | 第 230 | 13297 | 前 1.7% |
| `topic:dsh-plugin` | 第 314 | 17258 | 前 1.8% |

排名窗口：`api.github.com/search/repositories?q=topic:<t>&sort=stars&per_page=100&page=N`（本项目在 500 条窗口内可见）。

## 2. 同赛道竞品

| 仓库 | ★ | Watch | 建仓至记录日 | 星/Watch |
|---|---|---|---|---|
| `MeteorNOX/DeepSeek-Balance-Whale-Widget` | 3891 | **4** | 46 天 | 973 |
| `Small-tailqwq/dsh-deep-whale`（鲸鱼娘皮肤集） | 2368 | **2** | 51 天 | 1184 |
| `Dujltqzv/Some-Many-Books`（无关，仅关键词误命中） | 24242 | — | — | — |
| `stevenjoezhang/live2d-widget`（通用 Live2D 看板娘） | 10975 | — | — | — |
| **本项目 `dsh-whale-musume`** | **108** | **108** | 49 天 | **1.0** |

### 关于高星竞品的判断（存疑，不作结论）

同为 40–50 天的新仓库，竞品星数是本项目的 20–35 倍。有两点值得记录：

1. **Watch 转化率异常**：正常项目星标会有 1–5% 转化为 Watch（本项目 108★/108 Watch ≈ 1.0）。
   而 ★3891 的仓库只有 4 个 Watch（0.1%）、★2368 只有 2 个（0.08%）。
2. **增长速率异常**：折算每百天星数，竞品 4600–8500，本项目 220。

**这不构成"刷星"的证据**，只说明「星数」在本生态里不是可靠的比较基准。
本项目 49 天自然增长 108 星、转化率正常，曲线健康。复盘时应同时看 Watch 与下载量。

## 3. 收录覆盖情况（已确认有据）

| 渠道 | 状态 | 证据 |
|---|---|---|
| `awesome-dsh-plugin/awesome-dsh-plugin`（★17639） | 已收录 | 注册表 `awesome-dsh-plugin.com/plugins.json` 含本项目条目（category: `fun`） |
| **dsh-market**（★5366，harness 内置市场） | **已覆盖** | 其 README 说明清单来自 `awesome-dsh-plugin.com/plugins.json`，每次打开实时拉取 → 与上一行同源 |
| `0xsline/awesome-deepseek-harness`（★1132） | 已收录 | PR #669 已合并 |
| `bruc3van/awesome-dsh-plugin`（★383） | 已收录 | — |
| `Dominic789654/awesome-deepseek-harness`（★359） | 已收录 | — |
| `dshbase.com` | 已收录并实测 | README 徽章 + 插件页 |
| **dsh-community-plugins**（Workshop 商店 + dsh-market.com 清单源） | **PR #14 待审** | `zhu1090093659/dsh-community-plugins#14` |
| **dsh-plugin-radar**（★1467） | **PR #889 待审** | `AdamPlatin123/dsh-plugin-radar#889` |

## 4. 投放渠道的两个隐藏规则（已核实，避免做无用功）

1. **`dsh-market` 不需要单独投稿**：该仓只放市场应用，插件清单由
   `awesome-dsh-plugin.com/plugins.json`（4412 条）实时提供，仓库内没有可提交的清单文件。
2. **`dsh-plugin-radar` 会自动收录**：其 `PLUGINS.md` 写明「未登记的仓库只要打
   `dsh-plugin` / `dsh-external` topic，会在每日 02:00 全量扫描时自动收录」。
   本项目已满足该条件，PR 只是让条目更快进入分类表。
3. **`dsh-web`（★8299）不接受直接 PR**（`reject-non-content-pr.yml` 会自动关闭并重定向）。
   第三方插件应走 `dsh-community-plugins`；它还有独立的 **`dsh-pet`** 通道
   （`assets/<id>/` 放 `pet.json` + 图集）——**这可能是桌宠项目最贴合的收录位，尚未推进**。

## 5. topics 维护记录

- 补：`cordis`（DSH 插件框架；两个头部竞品在用）、`dsh-plugins`（复数形式）
- 去：`open-source`（池子 71k，几乎不可能被看到）、`productivity`（35k，语义偏弱）
- **上限 20 个**，加新必须换旧（`PUT /repos/{owner}/{repo}/topics` 超过会 422）
- 描述已改为含「看板娘 / DSH / desktop pet」等检索词（原先只有「桌宠 / 插件」）

## 6. 复查方法（下次直接跑）

```sh
# 排名
curl -s "https://api.github.com/search/repositories?q=topic:desktop-mascot&sort=stars&per_page=100"

# 注册表是否含本项目
curl -s https://awesome-dsh-plugin.com/plugins.json | grep -c dsh-whale-musume

# 收录状态
# 已收录：0xsline / bruc3van / Dominic789654 / awesome-dsh-plugin
# 待审：zhu1090093659/dsh-community-plugins#14、AdamPlatin123/dsh-plugin-radar#889
```
