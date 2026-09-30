// tools/gh-issue.mjs —— 在指定仓库开 Issue（正文分两段：字段值 + 正文文件）。
// 令牌来自本机 git 凭据，只写临时头文件。用法：
//   node tools/gh-issue.mjs <owner/repo> <titleFile> <bodyFile> [label1,label2]
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const [target, titleFile, bodyFile, labels] = process.argv.slice(2);
if (!target || !titleFile || !bodyFile) {
  console.error("usage: node tools/gh-issue.mjs <owner/repo> <titleFile> <bodyFile> [labels]");
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
  if (token) console.log("[issue] 已从 git credential helper 取得令牌（不回显）");
}
if (!token) {
  console.error("[issue] 缺少令牌");
  process.exit(3);
}

const headerFile = path.join(tmpdir(), `dsh-gh-issue-${Date.now()}.txt`);
writeFileSync(headerFile, [`Authorization: Bearer ${token}`, "Accept: application/vnd.github+json", "User-Agent: dsh-agent", "Content-Type: application/json", ""].join("\n"), { mode: 0o600 });
const payloadFile = path.join(tmpdir(), `dsh-gh-issuebody-${Date.now()}.json`);
writeFileSync(
  payloadFile,
  JSON.stringify({
    title: readFileSync(path.resolve(titleFile), "utf8").trim(),
    body: readFileSync(path.resolve(bodyFile), "utf8"),
    ...(labels ? { labels: labels.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
  }),
  "utf8",
);
try {
  const raw = execFileSync(
    "curl.exe",
    ["-sS", "--max-time", "90", "-x", proxy, "--header", `@${headerFile}`, "-X", "POST", "--data-binary", `@${payloadFile}`, `https://api.github.com/repos/${target}/issues`],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  const j = JSON.parse(raw);
  if (j.html_url) {
    console.log(`[issue] 已创建：${j.html_url}`);
    console.log(`[issue] #${j.number} ${j.title}`);
    console.log(`[issue] labels=${(j.labels ?? []).map((l) => l.name).join(",") || "(none)"}`);
  } else {
    console.error(`[issue] 创建失败：${JSON.stringify(j).slice(0, 500)}`);
    process.exit(1);
  }
} finally {
  rmSync(headerFile, { force: true });
  rmSync(payloadFile, { force: true });
}
