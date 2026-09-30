// tools/make-profile-card.mjs —— 用 GitHub API 的真实数据生成主页「BUILD LOG」SVG 卡（自绘，不依赖第三方统计服务）。
// 用法：node tools/make-profile-card.mjs <user> <outFile> [template]
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const user = process.argv[2] ?? "Sutera-Diffusus";
const out = process.argv[3] ?? ".qa/build-log.svg";
const template = process.argv[4] ?? ".qa/build-log-template.svg";
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";

const api = (p) => {
  const raw = execFileSync(
    "curl.exe",
    ["-sS", "--max-time", "40", "-x", proxy, "-H", "User-Agent: dsh-agent", "-H", "Accept: application/vnd.github+json", `https://api.github.com${p}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(raw);
};

const me = api(`/users/${user}`);
const repos = api(`/users/${user}/repos?per_page=100`);
// 把 profile 仓库（与用户名同名）排除在作品统计外
const own = repos
  .filter((r) => !r.fork && r.name !== user)
  .sort((a, b) => b.stargazers_count - a.stargazers_count);
const totalStars = own.reduce((s, r) => s + r.stargazers_count, 0);

// 向他人仓库提的 PR：从公开活动去重统计
const events = api(`/users/${user}/events/public?per_page=100`);
const prKeys = new Set();
for (const e of events) {
  if (e.type !== "PullRequestEvent") continue;
  const repo = e.repo?.name ?? "";
  if (repo.startsWith(`${user}/`)) continue;
  prKeys.add(`${repo}#${e.payload?.pull_request?.number ?? e.payload?.pull_request?.html_url ?? Math.random()}`);
}
const externalPrs = prKeys.size;

// 贡献总数（GitHub 自己的统计口径，独立于我的仓库统计）
let contributions = "?";
try {
  const profileHtml = execFileSync(
    "curl.exe",
    ["-sS", "-L", "--max-time", "40", "-x", proxy, "-H", "User-Agent: Mozilla/5.0 (dsh-agent)", `https://github.com/users/${user}/contributions`],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const m = /([\d,]+)\s*contribution/i.exec(profileHtml) ?? /(\d[\d,]*)\s*contributions?/i.exec(profileHtml);
  if (m) contributions = m[1];
} catch { /* 拿不到就不显示数字 */ }

// 条形图
const top = own.slice(0, 6);
const max = Math.max(...top.map((r) => r.stargazers_count), 1);
const BAR_X = 268;
const BAR_W = 496;
const rows = top
  .map((r, i) => {
    const y = 190 + i * 13;
    const w = Math.max(8, Math.round((r.stargazers_count / max) * BAR_W));
    const name = r.name.length > 23 ? `${r.name.slice(0, 22)}…` : r.name;
    return [
      `    <text x="32" y="${y}" font-size="11.5" fill="#64748b">${String(r.stargazers_count).padStart(3)}</text>`,
      `    <text x="66" y="${y}" font-size="11.5" fill="#cbd5e1">${name}</text>`,
      `    <rect x="${BAR_X}" y="${y - 8.6}" width="${BAR_W}" height="7.5" rx="3.75" fill="#0e7490" opacity="0.16"/>`,
      `    <rect x="${BAR_X}" y="${y - 8.6}" width="${w}" height="7.5" rx="3.75" fill="url(#bar)" opacity="0.95">`,
      `      <animate attributeName="opacity" values="0.2;0.95" dur="1s" begin="${(i * 0.15).toFixed(2)}s" fill="freeze"/>`,
      `    </rect>`,
    ].join("\n");
  })
  .join("\n");

// 语言分布（按仓库数）
const langs = {};
for (const r of own) if (r.language) langs[r.language] = (langs[r.language] ?? 0) + 1;
let lx = 118;
const langSvg = Object.entries(langs)
  .sort((a, b) => b[1] - a[1])
  .map(([name, n]) => {
    const s = `    <text x="${lx}" y="314" font-size="11" fill="#93c5fd">${name}</text>\n    <text x="${lx + name.length * 6.7}" y="314" font-size="11" fill="#3ee7f5">${n}</text>`;
    lx += name.length * 6.7 + 34;
    return s;
  })
  .join("\n");

const svg = readFileSync(path.resolve(template), "utf8")
  .replace(/__STARS__/g, String(totalStars))
  .replace(/__OWN__/g, String(own.length))
  .replace(/__PRS__/g, String(externalPrs))
  .replace(/__FOLLOWERS__/g, String(me.followers))
  .replace(/__CONTRIBS__/g, String(contributions))
  .replace(/__BARS__/g, rows)
  .replace(/__LANGS__/g, langSvg);

writeFileSync(path.resolve(out), svg, "utf8");
console.log(`[card] 已生成 ${out}`);
console.log(`[card] 总 star ${totalStars} · 原创仓库 ${own.length} · 对他仓 PR ${externalPrs} · followers ${me.followers} · 贡献 ${contributions}`);
console.log(`[card] 条形图：${top.map((r) => `${r.name}=${r.stargazers_count}`).join(", ")}`);
console.log(`[card] 语言：${Object.entries(langs).map(([k, v]) => `${k}:${v}`).join(", ")}`);
