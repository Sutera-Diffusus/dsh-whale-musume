// tools/submit-pr-from-upstream.mjs —— 在不共祖的 fork 场景下提 PR：
// 先按上游分支的 head 在本 fork 建分支（Git Data API），再提交文件改动，最后开 PR。
// 用法：node tools/submit-pr-from-upstream.mjs <targetRepo> <config.json>
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const [target, configPath] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";
const [upOwner, upName] = target.split("/");
const forkName = cfg.forkName ?? upName;

let token = process.env.GITHUB_TOKEN ?? "";
if (token === "") {
  const out = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  for (const line of out.split("\n")) if (line.startsWith("password=")) token = line.slice(9).trim();
  if (token) console.log("[pr2] 已从 git credential helper 取得令牌（不回显）");
}
if (!token) {
  console.error("[pr2] 缺少令牌");
  process.exit(3);
}

const headerFile = path.join(tmpdir(), `dsh-gh-pr2-${Date.now()}.txt`);
writeFileSync(
  headerFile,
  [`Authorization: Bearer ${token}`, "Accept: application/vnd.github+json", "User-Agent: dsh-agent", "Content-Type: application/json", ""].join("\n"),
  { mode: 0o600 },
);
const curl = (args) =>
  execFileSync("curl.exe", ["-sS", "--max-time", "90", "-x", proxy, "--header", `@${headerFile}`, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
const api = (p) => `https://api.github.com${p}`;
const json = (args) => {
  const raw = curl(args);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`JSON 解析失败：${raw.slice(0, 400)}`);
  }
};
const post = (url, payload) => {
  const f = path.join(tmpdir(), `dsh-gh-pr2-body-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(f, JSON.stringify(payload), "utf8");
  try {
    return json(["-X", "POST", api(url), "--data-binary", `@${f}`]);
  } finally {
    rmSync(f, { force: true });
  }
};

try {
  const me = json([api("/user")]);
  const repo = json([api(`/repos/${target}`)]);
  const base = repo.default_branch;
  console.log(`[pr2] ${target}（${repo.stargazers_count}★，base=${base}）作为 ${me.login}`);

  // 1) 上游 base 与文件内容
  const baseRef = json([api(`/repos/${target}/git/ref/heads/${base}`)]);
  const baseSha = baseRef.object.sha;
  const src = json([api(`/repos/${target}/contents/${encodeURIComponent(cfg.file)}?ref=${base}`)]);
  const original = Buffer.from(src.content, "base64").toString("utf8");
  console.log(`[pr2] base=${baseSha.slice(0, 8)}，${cfg.file} ${original.length} chars`);

  // 2) 生成新内容（唯一命中）
  let updated;
  if (cfg.mode === "replace") {
    const hits = original.split(cfg.find).length - 1;
    if (hits !== 1) throw new Error(`replace 锚点命中 ${hits} 次（要求 1）`);
    updated = original.replace(cfg.find, cfg.replace);
  } else throw new Error(`未知 mode: ${cfg.mode}`);

  // 3) 在本 fork 上按上游 head 建分支（不共祖也能用：直接指向上游 commit，GitHub 会自动建立 fork 网络关联）
  const forkBase = cfg.forkBase ?? base; // 通常与上游同名
  try {
    json([api(`/repos/${me.login}/${forkName}/git/ref/heads/${forkBase}`)]);
    console.log(`[pr2] fork 已有 ${forkBase} 分支`);
  } catch {
    post(`/repos/${me.login}/${forkName}/git/refs`, { ref: `refs/heads/${forkBase}`, sha: baseSha });
    console.log(`[pr2] 已在 fork 上创建 ${forkBase} -> ${baseSha.slice(0, 8)}（指向上游 head）`);
  }
  try {
    post(`/repos/${me.login}/${forkName}/git/refs`, { ref: `refs/heads/${cfg.branch}`, sha: baseSha });
    console.log(`[pr2] 分支 ${cfg.branch} -> ${baseSha.slice(0, 8)}`);
  } catch (error) {
    console.log(`[pr2] 分支可能已存在：${String(error.message).slice(0, 140)}`);
  }

  // 4) 提交文件（contents API 需带该分支上文件的 sha）
  const forkPath = `/repos/${me.login}/${forkName}/contents/${encodeURIComponent(cfg.file)}`;
  let branchSha;
  try {
    branchSha = json([api(`${forkPath}?ref=${encodeURIComponent(cfg.branch)}`)]).sha;
  } catch {
    /* 新分支上的文件应与 base 一致 */
  }
  const putFile = path.join(tmpdir(), `dsh-gh-pr2-put-${Date.now()}.json`);
  writeFileSync(putFile, JSON.stringify({
    message: cfg.commitMessage ?? cfg.prTitle,
    content: Buffer.from(updated, "utf8").toString("base64"),
    branch: cfg.branch,
    ...(branchSha === undefined ? {} : { sha: branchSha }),
  }), "utf8");
  let put;
  try {
    put = json(["-X", "PUT", api(forkPath), "--data-binary", `@${putFile}`]);
  } finally {
    rmSync(putFile, { force: true });
  }
  const commitSha = put?.commit?.sha;
  if (!commitSha) {
    console.error(`[pr2] 提交失败：${JSON.stringify(put).slice(0, 400)}`);
    process.exit(1);
  }
  console.log(`[pr2] 已提交 ${commitSha.slice(0, 8)}`);

  // 5) 开 PR
  const pr = post(`/repos/${target}/pulls`, {
    title: cfg.prTitle,
    head: `${me.login}:${cfg.branch}`,
    base,
    body: cfg.prBody,
  });
  if (pr.html_url) {
    console.log(`[pr2] PR 已创建：${pr.html_url}`);
    console.log(`[pr2] #${pr.number} ${pr.title}`);
  } else {
    console.error(`[pr2] 创建 PR 失败：${JSON.stringify(pr).slice(0, 500)}`);
    process.exit(1);
  }
} finally {
  rmSync(headerFile, { force: true });
}
