# Pull Request

感谢你为鲸鱼娘（dsh-whale-musume）提 PR 🐳 提交前请先读一眼
[CONTRIBUTING.md](https://github.com/Sutera-Diffusus/dsh-whale-musume/blob/main/CONTRIBUTING.md)，
并确认下面的清单已经过了一遍。

## 改动类型（勾选一项或多项）

- [ ] `fix:` 修复缺陷
- [ ] `feat:` 新功能 / 新互动 / 新表现
- [ ] `chore:` 维护类改动（文档、CI、依赖、重构、测试）

## 关联 Issue

<!-- 用 Closes / Fixes 关掉对应 Issue；没有 Issue 就写「无」并简述动机 -->

- Closes #
- Refs #

## 改动说明

<!-- 改了什么、为什么这么改。涉及选择器或状态机时，请写清判断依据 -->

## 自测清单

- [ ] `npm test` 全绿（`node --test test/*test.mjs`，当前 142 项）。CI `.github/workflows/test.yml` 会在 Node.js 18 与 22 上跑同一条命令
- [ ] 手工验证过改动路径：写清怎么点、看到什么（下文「手工验证场景」）
- [ ] 已确认是否影响旧版 Web（DSH 0.1.x）行为：不受影响 / 已同步适配 / 不适用（说明理由）
- [ ] 未改动 `assets/` 表现层的信号选择器；若改动了，已在下文写明依据（对应的 DSH 版本、DOM 契约文档或实测证据，选择器只增不减、旧宿主行为不受影响）
- [ ] 已同步 README.md / README.en.md / CHANGELOG.md（或说明为何本次不需要）

## 手工验证场景

<!-- 例如：桌面端（内嵌 DSH 0.2.0-rc.2）隔离 profile 下，打开设置面板 → 她缩成 mini 停右下角，Console 无报错 -->

## 是否影响旧版 Web 行为

<!-- 填「不受影响」并说明依据，或写清旧版 Web 上的差异与实测结果 -->

## 截图 / 录屏（可选）

<!-- 表现层改动强烈建议附上改动前后对比 -->

## 提交规范提示

- 一提交一事：一个提交只做一件可描述的事，避免「顺手重构 + 修 bug + 改文案」混在一起；
- 提交信息用 `fix:` / `feat:` / `chore:` 前缀（与
  [CONTRIBUTING.md](https://github.com/Sutera-Diffusus/dsh-whale-musume/blob/main/CONTRIBUTING.md) 一致），
  描述写清做了什么、为什么；
- 不要提交浏览器 profile、备份、日志、zip 安装包。
