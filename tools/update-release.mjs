// tools/update-release.mjs —— 用更新后的说明文件覆盖已有 Release 正文（令牌不进命令行与日志）。
// 用法：node tools/update-release.mjs <owner/repo> <tag> <notesFile>
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const [repo, tag, notesFile] = process.argv.slice(2);
if (!repo || !tag || !notesFile) {
  console.error("usage: node tools/update-release.mjs <owner/repo> <tag> <notesFile>");
  process.exit(2);
}
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";

let token = process.env.GITHUB_TOKEN ?? "";
if (token === "") {
  const out = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  for (const line of out.split("\n")) if (line.startsWith("password=")) token = line.slice(9).trim();
  if (token) console.log("[release] 已从 git credential helper 取得令牌（不回显）");
}
if (!token) {
  console.error("[release] 缺少令牌");
  process.exit(3);
}

const headerFile = path.join(tmpdir(), `dsh-gh-upd-${Date.now()}.txt`);
writeFileSync(
  headerFile,
  [`Authorization: Bearer ${token}`, "Accept: application/vnd.github+json", "User-Agent: dsh-agent", "Content-Type: application/json", ""].join("\n"),
  { mode: 0o600 },
);
const curl = (args) =>
  execFileSync("curl.exe", ["-sS", "--max-time", "60", "-x", proxy, "--header", `@${headerFile}`, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

try {
  const api = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
  const current = JSON.parse(curl([api]));
  if (!current.id) {
    console.error(`[release] 找不到 ${tag} 的 Release：${JSON.stringify(current).slice(0, 300)}`);
    process.exit(1);
  }
  const payloadFile = path.join(tmpdir(), `dsh-gh-upd-body-${Date.now()}.json`);
  writeFileSync(payloadFile, JSON.stringify({ body: readFileSync(path.resolve(notesFile), "utf8") }), "utf8");
  try {
    const updated = JSON.parse(curl(["-X", "PATCH", "--data-binary", `@${payloadFile}`, `https://api.github.com/repos/${repo}/releases/${current.id}`]));
    console.log(`[release] 已更新正文：${updated.html_url}`);
    console.log(`[release] body chars=${updated.body?.length ?? 0} name=${updated.name}`);
  } finally {
    rmSync(payloadFile, { force: true });
  }
} finally {
  rmSync(headerFile, { force: true });
}
