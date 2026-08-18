# Security Policy

## 凭据处理

- 运行时插件零网络请求，不读取、不写入、不传输任何 API 密钥或凭据；插件代码与测试代码中均不包含密钥。
- 立绘生成管线（`scripts/gen-assets.py`）会调用第三方图像生成接口，所需密钥仅从环境变量 `DSH_JMRAI_API_KEY` 读取，永不写入仓库。普通安装与使用不需要该脚本，也不需要任何密钥。

## 数据

所有数据仅保存在用户浏览器 `localStorage` 中（`whale-moe:` 前缀），不会离开本机。

## 漏洞报告

请通过仓库的 Security Advisory 或 Issue 报告，并尽量附上 DSH 版本、浏览器版本、复现步骤和截图。
