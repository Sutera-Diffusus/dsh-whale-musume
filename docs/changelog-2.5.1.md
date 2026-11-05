## v2.5.1 (2026-11-06)

### 适配

- **安装门禁改为按版本线放行**：`engines.dsh` 从逐版本白名单改为 `>=0.1.0-rc.6 <0.2.0-rc.1 || 0.2.0-rc.2 || >=0.2.1-rc.1 <0.2.3-0`。2.5.0 只写到 `0.2.1-rc.2`，导致 DSH `0.2.1-rc.3` / `rc.4` / `rc.5` / `0.2.2-rc.1` 的用户 100% 装不上（[#32](https://github.com/Sutera-Diffusus/dsh-whale-musume/issues/32)、[#36](https://github.com/Sutera-Diffusus/dsh-whale-musume/issues/36)），而 npm 上只有 2.5.0 一个正式版，没有低版本可回退。今后 0.2.1 / 0.2.2 线上再发 rc 不会再被门禁挡住。
- **兼容矩阵补到 0.2.2-rc.1**：`dsh.compatibility.dshReleases` 增加 `0.2.1-rc.3` / `rc.4` / `rc.5`（`compatible`，依据上游发布说明、tag 源码核对与单元测试）与 `0.2.2-rc.1`（`compatible`，依据本机 0.2.2-rc.1 `app.asar` 的 DOM 标记扫描）；`0.2.2-alpha.2` / `alpha.3` 标 `unknown`（engines 放行但不承诺）。

### 修复

- **关掉看板娘再打开后角色透明隐身**（[discussion #34](https://github.com/Sutera-Diffusus/dsh-whale-musume/discussions/34)）：`removeRoot()` 移除 DOM 后没有复位模块级 `layerState`，重新打开时 `setPose()` 命中「loaded === src」直接早退，新 `<img>` 永远拿不到 `src`，只剩透明线框（拖拽切姿势时才闪一下）。现在 `removeRoot()` 会复位缓存并用 `gen` 作废旧换图回调；`setPose()` 也增加了 DOM 复核，覆盖宿主直接摘节点后重挂的第二种入口。新增 2 项零浏览器回归测试。

### 文档

- README 中英文：兼容表补到 `0.2.1-rc.5` / `0.2.2-rc.1`；首屏静态图换成待机动图（社区 [@kingOfSoySauce](https://github.com/kingOfSoySauce) 录制，[PR #37](https://github.com/Sutera-Diffusus/dsh-whale-musume/pull/37)），GIF 收进仓库 `docs/images/preview-idle-loop.gif`，不依赖外链。

### 测试

- **203 → 205 全绿**：新增 2 项重挂载回归（关闭再打开 / 宿主强删根节点后重挂载）。`test/dsh-engines.test.mjs` 的放行表与拒绝表随区间更新：放行 0.2.1 整线与 0.2.2 线，拒绝 0.2.3 起的未知线。

### 社区

- 感谢 [@MaizioO123](https://github.com/MaizioO123) 的 rc.3 双机实测记录（[#32](https://github.com/Sutera-Diffusus/dsh-whale-musume/issues/32) / [PR #33](https://github.com/Sutera-Diffusus/dsh-whale-musume/pull/33)），以及 [@kingOfSoySauce](https://github.com/kingOfSoySauce) 的 README 动图（[#38](https://github.com/Sutera-Diffusus/dsh-whale-musume/issues/38) / [PR #37](https://github.com/Sutera-Diffusus/dsh-whale-musume/pull/37)）。
