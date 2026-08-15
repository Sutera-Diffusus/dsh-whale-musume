# dsh-whale-musume

DSH 鲸鱼娘（DS娘）看板娘插件：给 DeepSeek Harness 桌面端加一只可拖拽、可养成、带 47 张立绘与成就墙的鲸鱼娘。

## 一句话定位

A whale-girl Kanban Musume mascot for DeepSeek Harness with growth system, achievements and 40+ pose illustrations.

## 功能

- 悬浮看板娘（200px，可拖拽，拖拽时呈现“被拎起来”并跟随光标摇摆）
- 待机 / 工作双状态：工作中抱笔记本 + 蓝色光晕 + 状态标签
- 摸头养成：心情、好感度、饱食度、等级、签到、陪伴时长
- 30 个成就 + 设置面板成就墙
- 关键词感知（默认关闭）、摸鱼提醒、深夜模式
- 47 张 AI 生成立绘（待机、工作、表情包、日常）
- 无主题皮肤依赖，不修改 DSH 业务逻辑；可整体回滚

## 安装

把 DSH 安装目录作为 `--target`：

```bash
node scripts/apply-theme.mjs --assets-only --target "<DSH install dir>"
node scripts/apply-theme.mjs --mascot-settings --target "<DSH install dir>"
```

刷新 DSH 页面（`http://127.0.0.1:3080/`，端口以你的实际配置为准）即可看到看板娘。

回滚：脚本会在 `DSH_WHALE_BACKUP`（默认 `D:/ai-temp`）下生成备份目录，运行：

```bash
node scripts/apply-theme.mjs --rollback "<backup dir>"
```

## 数据存储

所有状态保存在浏览器 `localStorage` 中，键名以 `whale-moe:` 开头。无遥测、无服务器、无外部网络请求。

## 隐私

本插件只在本地运行；不收集、不上传任何数据。

## 已知限制

- 工作状态检测依赖 DSH 当前 DOM 选择器（`data-running` / `data-state="ongoing"`），DSH 大版本升级后可能需要适配。
- 立绘为 AI 生成素材，风格可能存在细微漂移。

## 开发与测试

```bash
node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs test/apply-theme.test.mjs
node test/motion-qa.mjs
node test/cdp-whale-moe.mjs
```

## License

MIT
