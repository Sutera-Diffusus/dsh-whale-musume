// tools/gh-push-files.mjs —— 通过 API 向仓库上传多个文件（文本或二进制），令牌不进命令行与日志。
// 用法：node tools/gh-push-files.mjs <owner/repo> <branch> <manifest.json>
// manifest: [{ "local": ".qa/build-log.svg", "remote": "profile/build-log.svg", "message": "chore: refresh card" }]
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const [repo, branch, manifestPath] = process.argv.slice(2);
if (!repo || !branch || !manifestPath) {
  console.error("usage: node tools/gh-push-files.mjs <owner/repo> <branch> <manifest.json>");
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
  if (token) console.log("[push] 已从 git credential helper 取得令牌（不回显）");
}
if (!token) {
  console.error("[push] 缺少令牌");
  process.exit(3);
}

const headerFile = path.join(tmpdir(), `dsh-gh-push-${Date.now()}.txt`);
writeFileSync(headerFile, [`Authorization: Bearer ${token}`, "Accept: application/vnd.github+json", "User-Agent: dsh-agent", "Content-Type: application/json", ""].join("\n"), { mode: 0o600 });
const curl = (args) =>
  execFileSync("curl.exe", ["-sS", "--max-time", "120", "-x", proxy, "--header", `@${headerFile}`, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const api = (p, method = "GET", payload) => {
  const args = ["-X", method, `https://api.github.com${p}`];
  let bodyFile;
  if (payload !== undefined) {
    bodyFile = path.join(tmpdir(), `dsh-gh-pushbody-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(bodyFile, JSON.stringify(payload), "utf8");
    args.push("--data-binary", `@${bodyFile}`);
  }
  try {
    const raw = curl(args);
    return raw.trim() === "" ? {} : JSON.parse(raw);
  } finally {
    if (bodyFile) rmSync(bodyFile, { force: true });
  }
};

try {
  const items = JSON.parse(readFileSync(path.resolve(manifestPath), "utf8"));
  if (!Array.isArray(items) || items.length === 0) {
    console.error("[push] manifest 为空");
    process.exit(2);
  }
  for (const item of items) {
    const remote = item.remote.replace(/^\/+/, "");
    const existing = api(`/repos/${repo}/contents/${encodeURIComponent(remote)}?ref=${encodeURIComponent(branch)}`);
    const content = readFileSync(path.resolve(item.local));
    const put = api(`/repos/${repo}/contents/${encodeURIComponent(remote)}`, "PUT", {
      message: item.message ?? `chore: update ${remote}`,
      content: content.toString("base64"),
      branch,
      ...(existing?.sha ? { sha: existing.sha } : {}),
    });
    if (put.commit?.sha) {
      console.log(`[push] ${remote}  ${existing?.sha ? "更新" : "新增"}  ${put.commit.sha.slice(0, 8)}  (${content.length}B)`);
    } else {
      console.error(`[push] ${remote} 失败：${JSON.stringify(put).slice(0, 300)}`);
      process.exit(1);
    }
  }
  console.log(`[push] 完成 ${items.length} 个文件 → https://github.com/${repo}`);
} finally {
  rmSync(headerFile, { force: true });
}
