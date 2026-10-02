// tools/build-release-zip.mjs —— 打包插件发布资产（zip + SHA256SUMS），结构与历史 Release 一致。
// 顶层目录固定为 dsh-whale-musume/，含 package.json / cordis.patch.yml / lib / assets / README / CHANGELOG / LICENSE。
// 用法：node tools/build-release-zip.mjs <version> <outDir>
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, cpSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const version = process.argv[2];
const outDir = path.resolve(process.argv[3] ?? "dist");
if (!version) {
  console.error("usage: node tools/build-release-zip.mjs <version> <outDir>");
  process.exit(2);
}
const pkgVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
if (pkgVersion !== version) {
  console.error(`[zip] package.json 版本(${pkgVersion}) 与目标版本(${version}) 不一致，先跑 prepare-release`);
  process.exit(1);
}

const ROOT_NAME = "dsh-whale-musume";
const stage = path.join(outDir, "stage");
rmSync(stage, { recursive: true, force: true });
mkdirSync(path.join(stage, ROOT_NAME), { recursive: true });
mkdirSync(outDir, { recursive: true });

const files = ["package.json", "cordis.patch.yml", "README.md", "README.en.md", "CHANGELOG.md", "LICENSE"];
for (const f of files) {
  if (!existsSync(f)) {
    console.error(`[zip] 缺少必需文件 ${f}`);
    process.exit(1);
  }
  copyFileSync(f, path.join(stage, ROOT_NAME, f));
}
for (const dir of ["lib", "assets"]) {
  if (!existsSync(dir)) {
    console.error(`[zip] 缺少必需目录 ${dir}`);
    process.exit(1);
  }
  cpSync(dir, path.join(stage, ROOT_NAME, dir), { recursive: true });
}
// assets/anim 是本轮未引用的历史素材（presenter 从未引用），不随插件分发
const animDir = path.join(stage, ROOT_NAME, "assets", "anim");
if (existsSync(animDir)) rmSync(animDir, { recursive: true, force: true });
// 发布包不带测试与文档站点
for (const drop of ["test", "tools", "docs", ".qa", ".github", "scripts"]) {
  const p = path.join(stage, ROOT_NAME, drop);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

const zipName = `dsh-whale-musume-plugin-v${version}.zip`;
const zipPath = path.join(outDir, zipName);
rmSync(zipPath, { force: true });
// 用 tar 打 zip（Windows 10+ 自带 bsdtar），-C 到 stage 以保证顶层目录结构
execFileSync("tar", ["-a", "-c", "-f", zipPath, "-C", stage, ROOT_NAME], { stdio: "inherit" });

const buf = readFileSync(zipPath);
const sha = createHash("sha256").update(buf).digest("hex");
const sumsName = `SHA256SUMS-v${version}.txt`;
writeFileSync(path.join(outDir, sumsName), `${sha}  ${zipName}\n`, "utf8");

// 自检：确认 zip 里的顶层目录与关键文件
// 注意：Windows 的 tar 输出是 CRLF，必须按 /\r?\n/ 切分，否则条目尾部会带 \r，字符串比对永远失败
const listing = execFileSync("tar", ["-tf", zipPath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);
const tops = [...new Set(listing.map((l) => l.split("/")[0]))];
const hasPkg = listing.includes(`${ROOT_NAME}/package.json`);
const hasPatch = listing.includes(`${ROOT_NAME}/cordis.patch.yml`);
const hasLib = listing.includes(`${ROOT_NAME}/lib/client.js`);
const leaks = listing.filter((l) => /^dsh-whale-musume\/(test|tools|docs|\.github|scripts)\//.test(l));
const anim = listing.filter((l) => l.includes("/assets/anim/"));

console.log(`[zip] ${zipName}  ${(buf.length / 1024 / 1024).toFixed(1)}MB  条目 ${listing.length}`);
console.log(`[zip] 顶层目录: ${tops.join(", ")}`);
console.log(`[zip] 含 package.json ${hasPkg ? "✓" : "✗"} · cordis.patch.yml ${hasPatch ? "✓" : "✗"} · lib/client.js ${hasLib ? "✓" : "✗"}`);
console.log(`[zip] 泄漏 test/tools/docs/.github/scripts: ${leaks.length === 0 ? "无 ✓" : leaks.slice(0, 5).join(", ")}`);
console.log(`[zip] 含 assets/anim（应排除）: ${anim.length === 0 ? "无 ✓" : `${anim.length} 个 ✗`}`);
console.log(`[zip] ${sumsName}: ${sha.slice(0, 16)}…`);
if (!hasPkg || !hasPatch || !hasLib || leaks.length > 0 || tops.length !== 1) {
  console.error("[zip] 自检未通过");
  process.exit(1);
}
