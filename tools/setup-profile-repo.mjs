// tools/setup-profile-repo.mjs —— 创建/更新 GitHub 主页仓库（Sutera-Diffusus/Sutera-Diffusus）并上传 README。
// 令牌来自本机 git 凭据，只写临时头文件；用法：
//   node tools/setup-profile-repo.mjs <owner> <readmeFile> [--description "..."] [--topics a,b]
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const [owner, readmeFile, ...rest] = process.argv.slice(2);
if (!owner || !readmeFile) {
  console.error('usage: node tools/setup-profile-repo.mjs <owner> <readmeFile> [--description "..."] [--topics a,b]');
  process.exit(2);
}
const flag = (n) => {
  const i = rest.indexOf(`--${n}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";
const repo = `${owner}/${owner}`;

let token = process.env.GITHUB_TOKEN ?? "";
if (token === "") {
  const out = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  for (const line of out.split("\n")) if (line.startsWith("password=")) token = line.slice(9).trim();
  if (token) console.log("[profile] 已从 git credential helper 取得令牌（不回显）");
}
if (!token) {
  console.error("[profile] 缺少令牌");
  process.exit(3);
}

const headerFile = path.join(tmpdir(), `dsh-gh-prof-${Date.now()}.txt`);
writeFileSync(
  headerFile,
  [`Authorization: Bearer ${token}`, "Accept: application/vnd.github+json", "User-Agent: dsh-agent", "Content-Type: application/json", ""].join("\n"),
  { mode: 0o600 },
);
const curl = (args) =>
  execFileSync("curl.exe", ["-sS", "--max-time", "90", "-x", proxy, "--header", `@${headerFile}`, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
const api = (p, method = "GET", payload) => {
  const args = ["-X", method, `https://api.github.com${p}`];
  let bodyFile;
  if (payload !== undefined) {
    bodyFile = path.join(tmpdir(), `dsh-gh-profbody-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(bodyFile, JSON.stringify(payload), "utf8");
    args.push("--data-binary", `@${bodyFile}`, "--header", "Content-Type: application/json");
  }
  try {
    const raw = curl(args);
    return raw.trim() === "" ? {} : JSON.parse(raw);
  } catch (error) {
    if (bodyFile) rmSync(bodyFile, { force: true });
    throw error;
  } finally {
    if (bodyFile) rmSync(bodyFile, { force: true });
  }
};

try {
  // 1) 仓库：不存在则创建（public，auto_init=true 以便立刻有 main 分支）
  let info = api(`/repos/${repo}`);
  if (info.full_name === undefined) {
    console.log(`[profile] 创建仓库 ${repo} …`);
    info = api("/user/repos", "POST", {
      name: owner,
      description: flag("description") ?? `${owner}'s profile`,
      private: false,
      auto_init: true,
      has_issues: true,
      has_discussions: true,
    });
    if (info.full_name === undefined) {
      console.error(`[profile] 创建失败：${JSON.stringify(info).slice(0, 400)}`);
      process.exit(1);
    }
    // 等分支就绪
    for (let i = 0; i < 20; i += 1) {
      const probe = api(`/repos/${repo}/contents/README.md`);
      if (probe.sha) break;
      execFileSync(process.execPath, ["-e", "setTimeout(()=>{},1500)"]);
    }
  } else {
    console.log(`[profile] 仓库已存在：${info.full_name}（默认分支 ${info.default_branch}）`);
  }
  const branch = info.default_branch ?? "main";

  // 2) README：存在则带 sha 更新
  const existing = api(`/repos/${repo}/contents/README.md?ref=${encodeURIComponent(branch)}`);
  const put = api(
    `/repos/${repo}/contents/README.md`,
    "PUT",
    {
      message: existing.sha ? "docs: refresh profile README" : "docs: add profile README",
      content: Buffer.from(readFileSync(path.resolve(readmeFile), "utf8"), "utf8").toString("base64"),
      branch,
      ...(existing.sha ? { sha: existing.sha } : {}),
    },
  );
  if (put.commit?.sha) console.log(`[profile] README 已提交：${put.commit.sha.slice(0, 8)}`);
  else {
    console.error(`[profile] README 提交失败：${JSON.stringify(put).slice(0, 400)}`);
    process.exit(1);
  }

  // 3) 仓库简介与 topics
  const description = flag("description");
  const topics = flag("topics");
  if (description !== undefined) {
    const patched = api(`/repos/${repo}`, "PATCH", { description });
    console.log(`[profile] 简介：${patched.description}`);
  }
  if (topics !== undefined) {
    const t = api(`/repos/${repo}/topics`, "PUT", { names: topics.split(",").map((s) => s.trim()).filter(Boolean) });
    console.log(`[profile] topics：${(t.names ?? []).join(", ")}`);
  }

  console.log(`[profile] 完成 → https://github.com/${repo}`);
} finally {
  rmSync(headerFile, { force: true });
}
