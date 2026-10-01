// tools/make-badges.mjs —— 自托管徽章生成器（替代 shields.io 外链）。
//
// 背景：GitHub 的图片代理 camo 会把「带 URL 编码中文」与「需查 GitHub API」的 shields.io 徽章
// 拖到 504 超时，仓库页出现坏图。自托管后图片由 GitHub 自己提供，不经 camo、不经第三方。
//
// 宽度不用估算：先跑 `.qa/measure-badge-text.mjs` 用浏览器实测文本宽度，结果写入
// `.qa/run/badge-metrics.json`，本脚本据此排版。找不到实测值时回退到保守估算。
//
// 用法：node tools/make-badges.mjs [outDir]
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const outDir = process.argv[2] ?? "docs/images/badges";
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";
const metricsFile = ".qa/run/badge-metrics.json";

const LIGHT = "#e2e8f0";
const H = 20;
const PAD = 10; // 每段左右各 5px 内边距

const specs = [
  { file: "version.svg", label: "version", value: "2.2.0", color: "#4da3ff", valueColor: LIGHT },
  { file: "tests.svg", label: "单元测试", value: "142 项全绿", color: "#31df76", valueColor: LIGHT },
  { file: "license.svg", label: "license", value: "MIT", color: "#6f42c1", valueColor: LIGHT },
  { file: "platform.svg", label: "平台", value: "Windows 10/11", color: "#0078D4", valueColor: LIGHT },
  { file: "desktop.svg", label: "桌面端", value: "Electron 壳 · DSH 0.2.0-rc.2", color: "#0078D4", valueColor: LIGHT },
  { file: "legacy-web.svg", label: "旧版 Web", value: "DSH 0.1.x", color: "#0078D4", valueColor: LIGHT },
  { file: "tests-en.svg", label: "unit tests", value: "142 passing", color: "#31df76", valueColor: LIGHT },
  { file: "platform-en.svg", label: "platform", value: "Windows 10/11", color: "#0078D4", valueColor: LIGHT },
  { file: "desktop-en.svg", label: "desktop app", value: "Electron shell · DSH 0.2.0-rc.2", color: "#0078D4", valueColor: LIGHT },
  { file: "legacy-web-en.svg", label: "legacy web", value: "DSH 0.1.x", color: "#0078D4", valueColor: LIGHT },
  { file: "discussions.svg", label: "Discussions", value: "交流", color: "#0969da", valueColor: "#ffffff" },
];

/** 读取实测宽度；缺失时保守估算（CJK 11px / ASCII 6.6px） */
function makeMeasurer() {
  let table = [];
  if (existsSync(metricsFile)) {
    try { table = JSON.parse(readFileSync(metricsFile, "utf8")); } catch { table = []; }
  }
  return (label, value) => {
    const hit = table.find((m) => m.label === label && m.value === value);
    if (hit) return { lw: hit.lw, vw: hit.vw };
    const est = (t) => [...t].reduce((s, c) => s + (/[\u2e80-\u9fff\uff00-\uffef]/.test(c) ? 11 : 6.6), 0);
    return { lw: est(label), vw: est(value) };
  };
}

/** flat-square 徽章：结构与 shields.io 一致（Verdana 11px，两段，底部 1px 描边）
 *  关键：必须写 textLength —— shields.io 正是用它锁定文本宽度，
 *  从而让 SVG 不依赖查看者本机字体（否则字体不同就撑开、与邻段重叠）。 */
function badge({ label, value, color, valueColor }, measure) {
  const { lw, vw } = measure(label, value);
  const leftW = Math.ceil(lw + 5) + 5;
  const rightW = Math.round(vw + 5) + 5;
  const total = leftW + rightW;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${H}" role="img" aria-label="${esc(label)}: ${esc(value)}">
  <title>${esc(label)}: ${esc(value)}</title>
  <g shape-rendering="crispEdges">
    <rect width="${leftW}" height="${H}" fill="#555"/>
    <rect x="${leftW}" width="${rightW}" height="${H}" fill="${color}"/>
    <rect x="${leftW}" width="${rightW}" y="19" height="1" fill="#bbb" fill-opacity="0.18"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text x="${leftW * 5}" y="140" textLength="${Math.round(lw * 10)}" transform="scale(.1)">${esc(label)}</text>
    <text x="${leftW * 10 + rightW * 5}" y="140" textLength="${Math.round(vw * 10)}" transform="scale(.1)" fill="${valueColor}">${esc(value)}</text>
  </g>
</svg>
`;
}

/** 下载量：数值取自 GitHub API，生成时定值（向下取整到 10），避免运行时依赖 */
function downloads() {
  let n = null;
  try {
    const raw = execFileSync("curl.exe", ["-sS", "--max-time", "30", "-x", proxy, "-H", "User-Agent: dsh-agent",
      "https://api.github.com/repos/Sutera-Diffusus/dsh-whale-musume/releases?per_page=100"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    const rel = JSON.parse(raw);
    if (Array.isArray(rel)) n = rel.reduce((s, r) => s + (r.assets ?? []).reduce((t, a) => t + (a.download_count ?? 0), 0), 0);
  } catch { /* 取不到则视为失败 */ }
  if (n === null) {
    console.warn("[badges] 警告：下载量取不到 —— 检查代理后重跑；本次退回 0 以免显示错误数字");
    n = 0;
  }
  return { file: "downloads.svg", label: "downloads", value: String(n), color: "#31df76", valueColor: LIGHT };
}

const measure = makeMeasurer();
mkdirSync(outDir, { recursive: true });
const all = [...specs, downloads()];
for (const { file, ...spec } of all) {
  const svg = badge(spec, measure);
  writeFileSync(path.join(outDir, file), svg, "utf8");
  const w = /width="(\d+)"/.exec(svg)?.[1];
  console.log(`[badges] ${file.padEnd(18)} ${w.padStart(4)}px  ${spec.label}: ${spec.value}`);
}
console.log(`[badges] 共 ${all.length} 个徽章写入 ${outDir}（宽度来源：实测 ${existsSync(metricsFile) ? "✓" : "✗ 估算"}）`);
