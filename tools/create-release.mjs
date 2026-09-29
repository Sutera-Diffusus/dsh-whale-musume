// tools/create-release.mjs —— 用本机 git 凭据创建 GitHub Release（走系统 curl + 本地代理）。
// 设计要点：令牌由 `git credential fill` 取得后写入 %TEMP% 下的临时头文件（600 语义、用完删除），
// 通过 `curl --header @file` 传入，**不出现在命令行参数、不打印、不进日志**。
// 用法：node tools/create-release.mjs <owner/repo> <tag> <notesFile> [name]
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const [repo, tag, notesFile, name] = process.argv.slice(2);
if (!repo || !tag || !notesFile) {
  console.error("usage: node tools/create-release.mjs <owner/repo> <tag> <notesFile> [name]");
  process.exit(2);
}
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";
const notesPath = path.resolve(notesFile);

let token = process.env.GITHUB_TOKEN ?? "";
if (token === "") {
  try {
    const out = execFileSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    for (const line of out.split("\n")) {
      if (line.startsWith("password=")) token = line.slice("password=".length).trim();
    }
    if (token) console.log("[release] 已从 git credential helper 取得令牌（不回显）");
  } catch (error) {
    console.error("[release] credential helper 取令牌失败：", error.message);
  }
}
if (!token) {
  console.error("[release] 缺少令牌：请设置 GITHUB_TOKEN 或先 git push 一次让凭据管理器记住。");
  process.exit(3);
}

const headerFile = path.join(tmpdir(), `dsh-gh-headers-${Date.now()}.txt`);
writeFileSync(
  headerFile,
  [
    `Authorization: Bearer ${token}`,
    "Accept: application/vnd.github+json",
    "User-Agent: dsh-agent",
    "Content-Type: application/json",
    "",
  ].join("\n"),
  { mode: 0o600 },
);

const curl = (args) =>
  execFileSync("curl.exe", ["-sS", "--max-time", "60", "-x", proxy, "--header", `@${headerFile}`, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

try {
  const api = `https://api.github.com/repos/${repo}`;
  const listRaw = curl([`${api}/releases?per_page=20`]);
  let existing;
  try {
    existing = JSON.parse(listRaw).find?.((r) => r.tag_name === tag);
  } catch {
    console.error(`[release] 列出现有 Release 失败：${listRaw.slice(0, 300)}`);
    process.exit(1);
  }
  if (existing) {
    console.log(`[release] ${tag} 的 Release 已存在，跳过创建：${existing.html_url}`);
    process.exit(0);
  }

  const payloadFile = path.join(tmpdir(), `dsh-gh-payload-${Date.now()}.json`);
  writeFileSync(
    payloadFile,
    JSON.stringify({
      tag_name: tag,
      name: name ?? tag,
      body: readFileSync(notesPath, "utf8"),
      draft: false,
      prerelease: false,
    }),
    "utf8",
  );
  try {
    const created = JSON.parse(curl(["-X", "POST", "--data-binary", `@${payloadFile}`, `${api}/releases`]));
    if (created.html_url) {
      console.log(`[release] 已创建：${created.html_url}`);
      console.log(`[release] tag=${created.tag_name} name=${created.name} assets=${created.assets?.length ?? 0}`);
    } else {
      console.error(`[release] 创建失败：${JSON.stringify(created).slice(0, 400)}`);
      process.exit(1);
    }
  } finally {
    rmSync(payloadFile, { force: true });
  }
} finally {
  rmSync(headerFile, { force: true });
}
