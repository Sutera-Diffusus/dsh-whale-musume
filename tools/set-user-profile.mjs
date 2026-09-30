// tools/set-user-profile.mjs —— 更新账号资料（bio / blog / location / company / name），只提交显式传入的字段。
// 用法：node tools/set-user-profile.mjs --bio "..." [--blog "url"] [--location "..."] [--name "..."]
import { writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";

let token = process.env.GITHUB_TOKEN ?? "";
if (token === "") {
  const out = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  for (const line of out.split("\n")) if (line.startsWith("password=")) token = line.slice(9).trim();
  if (token) console.log("[user] 已从 git credential helper 取得令牌（不回显）");
}
if (!token) {
  console.error("[user] 缺少令牌");
  process.exit(3);
}

const payload = {};
for (const key of ["bio", "blog", "location", "company", "name", "twitter_username"]) {
  const v = flag(key);
  if (v !== undefined) payload[key] = v;
}
if (Object.keys(payload).length === 0) {
  console.error("没有要更新的字段");
  process.exit(2);
}
console.log("[user] 将更新字段:", Object.keys(payload).join(", "));

const headerFile = path.join(tmpdir(), `dsh-gh-user-${Date.now()}.txt`);
const bodyFile = path.join(tmpdir(), `dsh-gh-userbody-${Date.now()}.json`);
writeFileSync(headerFile, [`Authorization: Bearer ${token}`, "Accept: application/vnd.github+json", "User-Agent: dsh-agent", "Content-Type: application/json", ""].join("\n"), { mode: 0o600 });
writeFileSync(bodyFile, JSON.stringify(payload), "utf8");
try {
  const raw = execFileSync(
    "curl.exe",
    ["-sS", "--max-time", "60", "-x", proxy, "--header", `@${headerFile}`, "-X", "PATCH", "--data-binary", `@${bodyFile}`, "https://api.github.com/user"],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  const j = JSON.parse(raw);
  if (j.login) {
    console.log(`[user] 已更新：name=${j.name} | bio=${j.bio} | blog=${j.blog || "(空)"} | location=${j.location || "(空)"}`);
  } else {
    console.error(`[user] 更新失败：${JSON.stringify(j).slice(0, 400)}`);
    process.exit(1);
  }
} finally {
  rmSync(headerFile, { force: true });
  rmSync(bodyFile, { force: true });
}
