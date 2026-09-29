# Contributing

## 开发环境

- Node.js 18+
- DeepSeek Harness 0.1.0-rc.x（旧版 Web）与/或 **DeepSeek Harness 桌面端**（Electron 壳，内嵌 DSH 0.2.0-rc.2）——推荐使用独立副本做验证，避免污染主安装
- 桌面端适配的契约依据见 `docs/desktop-0.2.0-rc.2-contract.md`；改动涉及选择器/信号时请一并核对那份文档

## 修改与验证

1. 修改 `assets/` 下文件（状态机在 `whale-moe-core.js`，表现层在 `dsh-whale-moe.js`，样式在 `dsh-whale-moe.css`）。
2. 将资源同步到副本后执行：

```bash
npm test
# 或（等价，显式列出全部测试文件）：
node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs test/apply-theme.test.mjs test/whale-moe-game.test.mjs test/whale-moe-fx.test.mjs test/whale-moe-quest.test.mjs test/whale-moe-zones.test.mjs test/desktop-client.test.mjs test/mimo-tts-integration.test.mjs test/presenter-layout.test.mjs
node test/motion-qa.mjs
node test/cdp-whale-moe.mjs
```

3. 全部通过后再合并到主安装。
4. CI：`.github/workflows/test.yml` 会在 Node.js 18 与 22 上跑 `npm test`；PR 合并后的 Release 笔记分类由 `.github/release.yml` 决定。
5. 桌面端改动建议额外跑一次一次性 headless 验收（需自建隔离 profile，**不要**对生产 `DSH_HOME` 操作）：

```bash
node tools/cdp-verify-whale.mjs   --url "<隔离 profile 的 GUI URL>" --timeout 90000
node tools/cdp-contract-whale.mjs "<隔离 profile 的 GUI URL>"
```

## 立绘生成管线

- `scripts/gen-assets.py` 调用第三方图像接口生成/编辑立绘，密钥只从环境变量 `DSH_JMRAI_API_KEY` 读取；
- 生成的候选立绘先放审阅目录人工确认，确认后才进入 `assets/generated/`；
- `scripts/build-review.py` 生成审阅页，`scripts/slice-batch.py` 用于海报切图。

## 提交规范

- 一提交一事，描述写清 `fix:` / `feat:` / `chore:`。
- 不提交浏览器 profile、备份、日志、zip 安装包。

## 风格

- 看板娘代码遵循“只操作自己的节点，不改动 DSH 业务 DOM”。
- 资源 URL 用版本号做缓存失效。
