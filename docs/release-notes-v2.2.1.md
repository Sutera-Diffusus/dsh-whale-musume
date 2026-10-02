# v2.2.1 · 贴边不再跑出屏幕

发布时间：2026-10-01 · [完整改动](https://github.com/Sutera-Diffusus/dsh-whale-musume/compare/v2.2.0...v2.2.1)

---

## 这个版本修了什么

### 桌宠贴到屏幕边缘时，气泡与面板有一半在屏幕外

由 [@unsiscon](https://github.com/unsiscon) 在 [#18](https://github.com/Sutera-Diffusus/dsh-whale-musume/issues/18) 报告——报告里给了精确的 CSS、出屏算式，以及本地验证过的修法，这个版本的实现基本照此完成。

台词气泡与偏好面板此前都用 `left: 50% + translateX(-50%)` 挂在桌宠中心，**没有视口钳制**：

- 桌宠拖到屏幕最左（位置被钳在距边 8px）→ 250px 宽的气泡左侧约 57px 出屏
- 拖到最右 → 对称出屏
- 拖到最顶部 → 向上弹出的气泡整块跑到屏幕上方

右键菜单有 `Math.min(x, innerWidth - 180)` 钳制、两个小游戏面板用 `position: fixed` 居中，所以只有这两个弹出层受影响。

**现在**：按桌宠的视口位置写两枚懒标记，CSS 据此换锚定边。

| 桌宠位置 | 行为 |
|---|---|
| 中心距左边缘 < 125px | `align=left`：面板从桌宠左缘向右展开 |
| 中心距右边缘 < 125px | `align=right`：面板贴右缘向左展开 |
| 顶部距屏幕顶 < 220px | `valign=below`：改为向下弹出，小三角翻转朝向 |
| 其余（居中） | 两枚标记都不写入，样式与之前完全一致 |

小三角通过 `--dsh-whale-anchor` 变量仍精确指回桌宠中心（左右两侧对称，均为 108px）。

### README 徽章不再出现坏图

实测 GitHub 的图片代理（camo）会把「带 URL 编码中文」与「需查 GitHub API」的 shields.io 徽章拖到 **504 超时**——仓库页 9 个徽章里 5 个是坏的：

| 徽章 | camo 结果 |
|---|---|
| 单元测试 / 平台 / 桌面端 / 旧版 Web（中文标签） | ❌ 504 |
| downloads（需查 GitHub API） | ❌ 504 |
| version / license / Discussions | ✅ 200 |

而 shields.io 直连（不走 GitHub）测试全部 200 —— 问题出在中间那一跳，且**间歇性**（网络越慢越容易触发）。

现在 12 个徽章由 `tools/make-badges.mjs` 生成、随仓库一起分发，**图片由 GitHub 自己提供**，不经 camo、不经第三方。

## 其他改进

- **下载量徽章自动更新**：新增 `.github/workflows/refresh-badges.yml`，每天定时 + 每次发版时重算并提交；内容无变化时不产生提交。
- **测试 142 → 143 全绿**：新增 `i7` 覆盖贴左 / 贴右 / 贴顶 / 居中四种位置，并断言 CSS 真的消费了这两枚标记。

## 安装 / 更新

```powershell
# 桌面端（装完需重启应用）
& "$Desktop\DeepSeek Harness.exe" --expose-internals $Cli plugin --profile desktop add github:Sutera-Diffusus/dsh-whale-musume

# 旧版 Web（装完重启 dsh web 并 Ctrl+F5）
dsh plugin --profile web add github:Sutera-Diffusus/dsh-whale-musume
```

更新不会动你的成长数据（`whale-moe:*` 仍留在宿主 origin 的 localStorage 里）。

## 校验

- `npm test` **143/143 全绿**
- 桌面端契约测试（`test/desktop-client.test.mjs`）35 项通过，含本次新增的贴边回归
- 12 个自托管徽章线上逐一核对，与仓库内字节一致

## 致谢

- [@unsiscon](https://github.com/unsiscon) —— 报告并给出了高质量修复方案
- [@ppy-web](https://github.com/ppy-web)、[@icemaple77](https://github.com/icemaple77) —— v2.1.0 起的持续贡献
