# v2.5.3 · 兼容全部 0.2.x

发布时间：2026-11-08 · [完整改动](https://github.com/Sutera-Diffusus/dsh-whale-musume/compare/v2.5.2...v2.5.3)

---

## 为什么有这个版本

[#32](https://github.com/Sutera-Diffusus/dsh-whale-musume/issues/32) 里几位用户反复提到同一件事：插件本身在更新的 DSH 上跑得好好的，却因为 `engines.dsh` 的逐版本白名单被挡在安装门外。

2.5.1 已经把范围放宽到 `>=0.2.1-rc.1 <0.2.3-0`，但还留着几段缺口：

- `0.2.0-rc.1`（更早的 0.2.0 预发布）
- `0.2.1-alpha.1`～`alpha.5`
- 未来的 `0.2.3`～`0.2.x`
- `0.2.2` 的 alpha 虽然能装，但矩阵信息不完整

这次把门禁改成**整条版本线**，不再每发一个 rc 就改一次名单。

## 新的范围

```text
>=0.1.0-rc.6 <0.3.0-0
```

| 宿主 | 2.5.3 的态度 |
|---|---|
| 旧版 Web `0.1.0-rc.6` 起 | 放行（`0.1.1-rc.2` / `0.1.2-rc.1` 为 `compatible`） |
| `0.2.0-rc.1` | 放行，标 `unknown`（未逐版本实测） |
| `0.2.0-rc.2` | 放行，`compatible`（隔离 profile 实机验收过） |
| `0.2.1-alpha.1`～`alpha.5` | 放行，标 `unknown` |
| `0.2.1-rc.1`～`rc.5` | 放行，`compatible`（静态契约 + 单测；rc.3 另有用户双机实测） |
| `0.2.2-alpha.2` / `alpha.3` | 放行，标 `unknown` |
| `0.2.2-rc.1` | 放行，`compatible`（本机 `app.asar` DOM 标记扫描 + 单测） |
| `0.2.3`～`0.2.x`（未来） | 放行，按 `unknown` 对待 |
| `0.3.0` 起（含 `0.3.0-alpha.*`） | 拒绝 |

> 为什么上界写 `<0.3.0-0` 而不是 `<0.3.0`：DSH 安装门禁用 `includePrerelease: true`，`<0.3.0` 会把 `0.3.0-alpha.1` 也放进来。`<0.3.0-0` 才能真正挡住整条 0.3.0 线。

## 这意味着什么，不意味着什么

- ✅ **能装上**：0.2.0-rc.1、0.2.1/0.2.2 的所有 alpha、未来的 0.2.3 线，不会再报「引擎不匹配」。
- ✅ **已核对版本的行为不变**：0.2.1-rc.1～rc.5、0.2.2-rc.1 仍是 `compatible`；0.2.0-rc.2 仍是实机验收过的版本。
- ⚠️ **未逐版本实测的版本不承诺**：`unknown` 只代表「允许安装」，不代表完整功能/视觉回归。遇到问题请带 DSH 版本、插件版本和控制台日志反馈。
- ❌ **0.3.0 仍是未知大版本**：DOM 契约没有核对，门禁继续挡住，包括 0.3.0 的 alpha。

## 验证

- `npm test`（`node --test test/*test.mjs`）**209/209 通过**。
- 更新了 `test/dsh-engines.test.mjs` 的真值表：新增 `0.2.0-rc.1`、`0.2.1-alpha.1/5`、`0.2.3-alpha.1`、`0.2.3`、`0.2.9` 的放行断言，以及 `0.3.0-alpha.1` / `0.3.0` / `0.3.1` 的拒绝断言。
- 本次**没有改运行时代码**，只改安装门禁、兼容矩阵和文档；不需要重新做视觉验收。

## 升级

```powershell
# 桌面端：npm 官方源
$env:ELECTRON_RUN_AS_NODE = "1"
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop remove dsh-whale-musume
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop add dsh-whale-musume
```

装完重启桌面端。养成数据在 localStorage，重装不丢。

npm：<https://www.npmjs.com/package/dsh-whale-musume> · Release：<https://github.com/Sutera-Diffusus/dsh-whale-musume/releases/tag/v2.5.3>

## English

v2.5.3 widens `engines.dsh` from a per-release allowlist to the whole `>=0.1.0-rc.6 <0.3.0-0` line:

- **Allowed**: `0.2.0-rc.1`, all `0.2.1` / `0.2.2` alphas and RCs, the 0.2.2 release, and future `0.2.3`–`0.2.x`.
- **Marked `compatible`**: `0.2.0-rc.2` (real-device acceptance), `0.2.1-rc.1`–`rc.5` and `0.2.2-rc.1` (static contract + unit tests; rc.3 also has a two-machine user report). Everything else is `unknown`: installable, not certified.
- **Still refused**: `0.3.0` and newer, including `0.3.0-alpha.*`; the upper bound is `<0.3.0-0` because the installer checks with `includePrerelease: true`.

No runtime code changed; only the install gate, compatibility matrix and docs. `npm test`: **209/209**.
