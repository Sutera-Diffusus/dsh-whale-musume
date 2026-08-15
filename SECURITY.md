# Security Policy

## 凭据处理

本插件不读取、不写入、不传输任何 API 密钥或凭据。插件代码与测试代码中均不包含密钥。

## 数据

所有数据仅保存在用户浏览器 `localStorage` 中（`whale-moe:` 前缀），不会离开本机。

## 漏洞报告

请通过仓库的 Security Advisory 或 Issue 报告，并尽量附上 DSH 版本、浏览器版本、复现步骤和截图。
