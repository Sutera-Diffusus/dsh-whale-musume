// tools/update-repo-meta.mjs —— 更新 GitHub 仓库简介 / 主页 / topics（令牌不进命令行与日志）。
// 用法：
//   node tools/update-repo-meta.mjs <owner/repo> [--description "..."] [--homepage "url"] [--topics a,b,c]
//   node tools/update-repo-meta.mjs <owner/repo> --show
import { writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const [repo, ...rest] = process.argv.slice(2);
if (!repo) {
  console.error('usage: node tools/update-repo-meta.mjs <owner/repo> [--description "..."] [--homepage url] [--topics a,b] [--show]');
  process.exit(2);
}
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const showOnly = rest.includes("--show");
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";

let token = process.env.GITHUB_TOKEN ?? "";
if (token === "") {
  const out = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  for (const line of out.split("\n")) if (line.startsWith("password=")) token = line.slice(9).trim();
}
if (!token) {
  console.error("[repo-meta] 缺少令牌");
  process.exit(3);
}

const headerFile = path.join(tmpdir(), `dsh-gh-meta-${Date.now()}.txt`);
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
    maxBuffer: 8 * 1024 * 1024,
  });

try {
  const api = `https://api.github.com/repos/${repo}`;
  if (showOnly) {
    const j = JSON.parse(curl([api]));
    console.log(`description: ${j.description ?? "(none)"}`);
    console.log(`homepage:    ${j.homepage ?? "(none)"}`);
    console.log(`topics:      ${(j.topics ?? []).join(", ") || "(none)"}`);
    process.exit(0);
  }

  const payload = {};
  const description = flag("description");
  const homepage = flag("homepage");
  const topics = flag("topics");
  if (description !== undefined) payload.description = description;
  if (homepage !== undefined) payload.homepage = homepage;
  if (Object.keys(payload).length > 0) {
    const payloadFile = path.join(tmpdir(), `dsh-gh-meta-body-${Date.now()}.json`);
    writeFileSync(payloadFile, JSON.stringify(payload), "utf8");
    try {
      const j = JSON.parse(curl(["-X", "PATCH", "--data-binary", `@${payloadFile}`, api]));
      console.log(`[repo-meta] 已更新：description=${j.description} homepage=${j.homepage || "(none)"}`);
    } finally {
      rmSync(payloadFile, { force: true });
    }
  }
  if (topics !== undefined) {
    const payloadFile = path.join(tmpdir(), `dsh-gh-topics-${Date.now()}.json`);
    writeFileSync(payloadFile, JSON.stringify({ names: topics.split(",").map((s) => s.trim()).filter(Boolean) }), "utf8");
    try {
      const j = JSON.parse(curl(["-X", "PUT", "--data-binary", `@${payloadFile}`, `${api}/topics`]));
      console.log(`[repo-meta] topics：${(j.names ?? []).join(", ")}`);
    } finally {
      rmSync(payloadFile, { force: true });
    }
  }
  const after = JSON.parse(curl([api]));
  console.log(`[repo-meta] 现值：description=${after.description}`);
  console.log(`[repo-meta] 现值：homepage=${after.homepage || "(none)"}`);
  console.log(`[repo-meta] 现值：topics=${(after.topics ?? []).join(", ")}`);
} finally {
  rmSync(headerFile, { force: true });
}
