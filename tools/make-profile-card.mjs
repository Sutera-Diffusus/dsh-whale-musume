// tools/make-profile-card.mjs —— 生成主页「SELECTED WORK」SVG 卡（自绘，数据来自 GitHub API）。
// 设计取向：克制的四信号 + 最受关注仓库的极简条形列表，不做二级标题堆叠。
// 用法：node tools/make-profile-card.mjs <user> <outFile> [template]
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const user = process.argv[2] ?? "Sutera-Diffusus";
const out = process.argv[3] ?? ".qa/selected-work.svg";
const template = process.argv[4] ?? ".qa/selected-work-template.svg";
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";

// 匿名 API 很容易 60/h 限流 → 用本机 git 凭据认证（令牌只写临时头文件，不打印）
let token = process.env.GITHUB_TOKEN ?? "";
if (token === "") {
  try {
    const cred = execFileSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    for (const line of cred.split("\n")) if (line.startsWith("password=")) token = line.slice(9).trim();
  } catch { /* 无凭据就走匿名 */ }
}
const headerFile = path.join(tmpdir(), `dsh-card-${Date.now()}.txt`);
writeFileSync(
  headerFile,
  [
    ...(token ? [`Authorization: Bearer ${token}`] : []),
    "Accept: application/vnd.github+json",
    "User-Agent: dsh-agent",
    "",
  ].join("\n"),
  { mode: 0o600 },
);

const api = (p) => {
  const raw = execFileSync(
    "curl.exe",
    ["-sS", "--max-time", "40", "-x", proxy, "--header", `@${headerFile}`, `https://api.github.com${p}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const j = JSON.parse(raw);
  if (!Array.isArray(j) && j.message) throw new Error(`GitHub API 错误：${j.message}`);
  return j;
};

try {
  const me = api(`/users/${user}`);
  const repos = api(`/users/${user}/repos?per_page=100`);
  const own = repos.filter((r) => !r.fork && r.name !== user).sort((a, b) => b.stargazers_count - a.stargazers_count);
  const totalStars = own.reduce((s, r) => s + r.stargazers_count, 0);

// 只统计「在别人仓库里被合并的 PR」——用搜索 API 拿权威数字（events API 只回溯 90 天，会少算）
let merged = 0;
let prsTouched = 0;
try {
  const q = (query) => {
    const raw = execFileSync(
      "curl.exe",
      ["-sS", "--max-time", "40", "-x", proxy, "--header", `@${headerFile}`, `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=1`],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    const j = JSON.parse(raw);
    return typeof j.total_count === "number" ? j.total_count : 0;
  };
  merged = q(`author:${user} is:pr is:merged -user:${user}`);
  prsTouched = q(`author:${user} is:pr`);
} catch (error) {
  console.log(`[card] 警告：搜索 API 不可用（${String(error.message).slice(0, 60)}），外部合并 PR 记为 0`);
}

const top = own.slice(0, 5);
const max = Math.max(...top.map((r) => r.stargazers_count), 1);
const BAR_X = 748;
const BAR_MAX = 92;
const rows = top
  .map((r, i) => {
    const y = 120 + i * 20;
    const w = Math.max(4, Math.round((r.stargazers_count / max) * BAR_MAX));
    const name = r.name.length > 24 ? `${r.name.slice(0, 23)}…` : r.name;
    return [
      `    <text x="600" y="${y}" font-size="11.5" fill="#94a3b8">${name}</text>`,
      `    <text x="740" y="${y}" font-size="11.5" fill="#5eead4" text-anchor="end">${r.stargazers_count}</text>`,
      `    <rect x="${BAR_X}" y="${y - 8}" width="${BAR_MAX}" height="5" rx="2.5" fill="#0e7490" opacity="0.14"/>`,
      `    <rect x="${BAR_X}" y="${y - 8}" width="${w}" height="5" rx="2.5" fill="url(#bar)">`,
      `      <animate attributeName="width" values="0;${w}" dur="0.9s" begin="${(i * 0.12).toFixed(2)}s" fill="freeze"/>`,
      `    </rect>`,
    ].join("\n");
  })
  .join("\n");

const svg = readFileSync(path.resolve(template), "utf8")
  .replace(/__STARS__/g, String(totalStars))
  .replace(/__OWN__/g, String(own.length))
  .replace(/__PRS__/g, String(merged))
  .replace(/__ROWS__/g, rows);

writeFileSync(path.resolve(out), svg, "utf8");
console.log(`[card] ${out}`);
console.log(`[card] stars=${totalStars} repos=${own.length} mergedElsewhere=${merged} prsTouched=${prsTouched}`);
console.log(`[card] rows: ${top.map((r) => `${r.name}=${r.stargazers_count}`).join(", ")}`);
} finally {
  rmSync(headerFile, { force: true });
}
