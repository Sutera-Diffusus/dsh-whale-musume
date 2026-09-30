// tools/submit-listing-pr.mjs —— 给第三方 awesome 目录提收录/修正 PR（令牌不进命令行与日志）。
// 流程：fork（若已存在则复用）→ 拉取目标文件 → 本地做精确替换（要求唯一命中）→ 提交到新分支 → 开 PR。
// 用法：node tools/submit-listing-pr.mjs <targetRepo> <config.json>
// config: { branch, file, mode: "append-line" | "replace", marker, appendLine?, find?, replace?, prTitle, prBody }
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const [target, configPath] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";

let token = process.env.GITHUB_TOKEN ?? "";
if (token === "") {
  const out = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  for (const line of out.split("\n")) if (line.startsWith("password=")) token = line.slice(9).trim();
  if (token) console.log("[pr] 已从 git credential helper 取得令牌（不回显）");
}
if (!token) {
  console.error("[pr] 缺少令牌");
  process.exit(3);
}

const headerFile = path.join(tmpdir(), `dsh-gh-pr-${Date.now()}.txt`);
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
const writeTmp = (prefix, content) => {
  const f = path.join(tmpdir(), `dsh-gh-${prefix}-${Date.now()}.json`);
  writeFileSync(f, content, "utf8");
  return f;
};

try {
  const me = json([api("/user")]);
  console.log(`[pr] 身份：${me.login}`);

  const repo = json([api(`/repos/${target}`)]);
  const defaultBranch = repo.default_branch;
  console.log(`[pr] 目标：${target}（${repo.stargazers_count}★，默认分支 ${defaultBranch}）`);

  // 1) fork（已存在则复用）
  let fork = json([api(`/repos/${me.login}/${target.split("/")[1]}`)]);
  if (fork.full_name === undefined) {
    console.log("[pr] 创建 fork…");
    fork = json(["-X", "POST", api(`/repos/${target}/forks`)]);
    for (let i = 0; i < 30 && fork.full_name === undefined; i += 1) {
      execFileSync("node", ["-e", "setTimeout(()=>{},1500)"]);
      fork = json([api(`/repos/${me.login}/${target.split("/")[1]}`)]);
    }
  }
  console.log(`[pr] fork：${fork.full_name ?? "(创建中)"} default=${fork.default_branch ?? "?"}`);
  const owner = me.login;
  const forkDefault = fork.default_branch ?? defaultBranch;

  // 2) 同步 fork 的默认分支到上游（避免基于过期内容开 PR）
  try {
    json(["-X", "POST", api(`/repos/${owner}/${target.split("/")[1]}/merge-upstream`), "-d", JSON.stringify({ branch: forkDefault })]);
    console.log("[pr] fork 已与上游同步");
  } catch {
    console.log("[pr] merge-upstream 跳过（可能已是最新）");
  }

  // 3) 读目标文件
  const src = json([api(`/repos/${target}/contents/${encodeURIComponent(cfg.file)}?ref=${defaultBranch}`)]);
  const original = Buffer.from(src.content, "base64").toString("utf8");
  console.log(`[pr] 读取 ${cfg.file}：${original.length} chars, sha=${src.sha.slice(0, 8)}…`);

  // 4) 生成新内容（唯一命中校验）
  let updated;
  if (cfg.mode === "replace") {
    const hits = original.split(cfg.find).length - 1;
    if (hits !== 1) throw new Error(`replace 锚点命中 ${hits} 次（要求 1）`);
    updated = original.replace(cfg.find, cfg.replace);
  } else if (cfg.mode === "append-line") {
    if (original.includes(cfg.marker)) throw new Error(`目标已包含标记：${cfg.marker}（可能已收录）`);
    const lines = original.split(/\r?\n/);
    let insertAt = -1;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (lines[i].trim().startsWith("- [")) {
        insertAt = i + 1;
        break;
      }
    }
    if (insertAt < 0) throw new Error("没找到任何条目行，无法定位插入点");
    lines.splice(insertAt, 0, cfg.appendLine);
    updated = lines.join("\n");
  } else {
    throw new Error(`未知 mode: ${cfg.mode}`);
  }
  if (updated === original) throw new Error("内容没有变化");

  // 5) 在 fork 上创建分支并提交
  const ref = json([api(`/repos/${owner}/${target.split("/")[1]}/git/ref/heads/${forkDefault}`)]);
  const baseSha = ref.object.sha;
  try {
    json(["-X", "POST", api(`/repos/${owner}/${target.split("/")[1]}/git/refs`), "-d", JSON.stringify({ ref: `refs/heads/${cfg.branch}`, sha: baseSha })]);
    console.log(`[pr] 分支已创建：${cfg.branch} @ ${baseSha.slice(0, 8)}`);
  } catch (error) {
    console.log(`[pr] 分支可能已存在，尝试复用：${String(error.message).slice(0, 120)}`);
  }

  /* fork 分支上文件通常已存在（fork 同步了上游内容），contents API 要求带该分支的 sha。
     先取一次；取不到（真不存在）则按新建提交。 */
  const forkPath = `/repos/${owner}/${target.split("/")[1]}/contents/${encodeURIComponent(cfg.file)}`;
  let branchSha;
  try {
    branchSha = json([api(`${forkPath}?ref=${encodeURIComponent(cfg.branch)}`)]).sha;
    console.log(`[pr] fork 分支上已有该文件，sha=${String(branchSha).slice(0, 8)}…`);
  } catch {
    console.log("[pr] fork 分支上没有该文件，按新建提交");
  }
  const commitFile = (sha) => {
    const body = writeTmp("put", JSON.stringify({
      message: cfg.commitMessage ?? cfg.prTitle,
      content: Buffer.from(updated, "utf8").toString("base64"),
      branch: cfg.branch,
      ...(sha === undefined ? {} : { sha }),
    }));
    try {
      return json(["-X", "PUT", api(forkPath), "--data-binary", `@${body}`]);
    } finally {
      rmSync(body, { force: true });
    }
  };
  let put;
  try {
    put = commitFile(branchSha ?? cfg.remoteSha);
  } catch (error) {
    console.log(`[pr] 首次提交失败，尝试重新取 sha 后重试：${String(error.message).slice(0, 200)}`);
    let existing = null;
    try {
      existing = json([api(`${forkPath}?ref=${encodeURIComponent(cfg.branch)}`)]);
    } catch {
      /* 文件确实不存在 */
    }
    put = commitFile(existing?.sha);
  }
  const commitSha = put?.commit?.sha ?? put?.sha ?? null;
  if (commitSha === null) {
    console.error(`[pr] 提交响应异常，未拿到 commit sha：${JSON.stringify(put).slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`[pr] 已提交：${commitSha.slice(0, 8)} ${cfg.file}`);
  // 6) 开 PR
  const prBodyFile = writeTmp("pr", JSON.stringify({
    title: cfg.prTitle,
    head: `${owner}:${cfg.branch}`,
    base: defaultBranch,
    body: cfg.prBody,
  }));
  try {
    const pr = json(["-X", "POST", api(`/repos/${target}/pulls`), "--data-binary", `@${prBodyFile}`]);
    if (pr.html_url) {
      console.log(`[pr] PR 已创建：${pr.html_url}`);
      console.log(`[pr] #${pr.number} ${pr.title}`);
    } else {
      console.error(`[pr] 创建 PR 失败：${JSON.stringify(pr).slice(0, 500)}`);
      process.exit(1);
    }
  } finally {
    rmSync(prBodyFile, { force: true });
  }
} finally {
  rmSync(headerFile, { force: true });
}
