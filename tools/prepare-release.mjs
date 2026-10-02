// tools/prepare-release.mjs —— 准备一个 patch 版本的本地改动：package.json 版本 + CHANGELOG + README 版本表。
// 只改文本，不提交、不打 tag（提交与发布交给调用者，便于先自检）。
// 用法：node tools/prepare-release.mjs <version> <date> <theme-zh> <theme-en>
import { readFileSync, writeFileSync } from "node:fs";

const [version, date, themeZh, themeEn] = process.argv.slice(2);
if (!version || !date || !themeZh || !themeEn) {
  console.error("usage: node tools/prepare-release.mjs <version> <date> <themeZh> <themeEn>");
  process.exit(2);
}
const prev = JSON.parse(readFileSync("package.json", "utf8")).version;
console.log(`[prepare] ${prev} → ${version}（主题：${themeZh}）`);

/* 1) package.json 版本 —— 只替换 version 字面量。
   注意：不能用 JSON.parse/stringify 重写整个文件——该文件是 CRLF，重排会把行尾全翻成 LF，
   制造一个整文件级别的假 diff。 */
const pkgText = readFileSync("package.json", "utf8");
const versionRe = /("version"\s*:\s*")[^"]+(")/;
if (!versionRe.test(pkgText)) {
  console.error("[prepare] package.json 里找不到 version 字段");
  process.exit(1);
}
writeFileSync("package.json", pkgText.replace(versionRe, `$1${version}$2`), "utf8");
console.log("[prepare] package.json 已更新（保留原始行尾与格式）");

/* 2) CHANGELOG：在 '# Changelog' 之后插入新段。
   注意：仓库里 CHANGELOG.md / README 都是 CRLF，正则必须容忍 \r\n，
   否则 replace 静默不生效（曾因此漏掉一整个版本的 CHANGELOG）。 */
const entry = readFileSync(`docs/changelog-${version}.md`, "utf8").trimEnd();
const log = readFileSync("CHANGELOG.md", "utf8");
if (!/## v[\d.]+ /.test(log)) {
  console.error("[prepare] CHANGELOG 结构异常：找不到任何 '## vX.Y.Z' 版本段");
  process.exit(1);
}
if (new RegExp(`## v${version.replace(/\./g, "\\.")} `).test(log)) {
  console.log("[prepare] CHANGELOG 已含该版本，跳过");
} else {
  const headRe = /^(# Changelog\r?\n\r?\n)/;
  if (!headRe.test(log)) {
    console.error("[prepare] CHANGELOG 开头不是 '# Changelog' + 空行，请手工插入");
    process.exit(1);
  }
  const next = log.replace(headRe, `$1${entry}\n\n`);
  if (!next.includes(`v${version}`)) {
    console.error("[prepare] CHANGELOG 插入失败（替换后仍不含版本号）");
    process.exit(1);
  }
  writeFileSync("CHANGELOG.md", next, "utf8");
  console.log(`[prepare] CHANGELOG 已插入新段（+${next.length - log.length} 字符）`);
}

/* 3) README 版本表：在表头下插入新行 */
const zhRow = `| **v${version}** | ${date} | ${themeZh} | 见下方要点 | [Release](https://github.com/Sutera-Diffusus/dsh-whale-musume/releases/tag/v${version}) · [Notes](docs/release-notes-v${version}.md) |`;
const enRow = `| **v${version}** | ${date} | ${themeEn} | See highlights below | [Release](https://github.com/Sutera-Diffusus/dsh-whale-musume/releases/tag/v${version}) · [Notes](docs/release-notes-v${version}.md) |`;

for (const [file, row] of [["README.md", zhRow], ["README.en.md", enRow]]) {
  const text = readFileSync(file, "utf8");
  if (text.includes(`**v${version}**`)) {
    console.log(`[prepare] ${file} 版本表已含该版本，跳过`);
    continue;
  }
  // 版本表表头中文版是中文、英文版是英文；行尾可能是 CRLF 或 LF，两种都要认
  const zhHeader = /(\| 版本 \| 日期 \| 主题 \| 要点 \| 链接 \|\r?\n\|---\|---\|---\|---\|---\|\r?\n)/;
  const enHeader = /(\| Version \| Date \| Theme \| Highlights \| Links \|\r?\n\|---\|---\|---\|---\|---\|\r?\n)/;
  const re = zhHeader.test(text) ? zhHeader : enHeader;
  if (!re.test(text)) {
    console.error(`[prepare] ${file} 未找到版本表表头，请手工添加该行`);
    process.exit(1);
  }
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const next = text.replace(re, `$1${row}${eol}`);
  if (!next.includes(`**v${version}**`)) {
    console.error(`[prepare] ${file} 插入失败（替换后仍不含版本行）`);
    process.exit(1);
  }
  writeFileSync(file, next, "utf8");
  console.log(`[prepare] ${file} 版本表已插入新行（行尾 ${eol === "\r\n" ? "CRLF" : "LF"}）`);
}

/* 4) 顺带把自托管版本徽章更新到新版本 */
const badgeFile = "docs/images/badges/version.svg";
const badge = readFileSync(badgeFile, "utf8");
if (!badge.includes(`>${version}<`) && !badge.includes(`: ${version}`)) {
  console.error(`[prepare] 版本徽章未包含 ${version}，请重跑 node tools/make-badges.mjs`);
  process.exit(1);
}
console.log(`[prepare] 版本徽章已是 ${version} ✓`);
