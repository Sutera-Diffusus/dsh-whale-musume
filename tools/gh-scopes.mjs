// tools/gh-scopes.mjs —— 检查本机 git 凭据里的 GitHub 令牌具备哪些 scope（不回显令牌）。
// 用法：node tools/gh-scopes.mjs
import { execFileSync } from "node:child_process";

const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";
const out = execFileSync("git", ["credential", "fill"], {
  input: "protocol=https\nhost=github.com\n\n",
  encoding: "utf8",
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
});
let token = "";
for (const line of out.split("\n")) if (line.startsWith("password=")) token = line.slice(9).trim();
if (!token) {
  console.error("未从 credential helper 取到令牌");
  process.exit(3);
}
console.log(`令牌长度 ${token.length}，前缀 ${token.slice(0, 4)}…（不回显）`);

const res = await fetch("https://api.github.com/", {
  headers: { Authorization: `Bearer ${token}`, "User-Agent": "dsh-agent" },
  // Node fetch 不读系统代理；这里用 curl 兜底更稳，故改走 execFileSync
}).catch(() => null);

if (res && res.ok) {
  console.log("X-OAuth-Scopes:", res.headers.get("x-oauth-scopes") ?? "(classic 令牌才有)");
  console.log("X-Accepted-OAuth-Scopes:", res.headers.get("x-accepted-oauth-scopes") ?? "-");
} else {
  console.log("Node fetch 直连失败（预期：本机 github.com 直连被拒），改用 curl 走代理：");
  const headerFile = `${process.env.TEMP}\\dsh-gh-scope-${Date.now()}.txt`;
  const { writeFileSync, rmSync } = await import("node:fs");
  writeFileSync(headerFile, `Authorization: Bearer ${token}\nUser-Agent: dsh-agent\n`, { mode: 0o600 });
  try {
    const dump = execFileSync(
      "curl.exe",
      ["-sS", "-D", "-", "-o", "NUL", "-x", proxy, "--header", `@${headerFile}`, "https://api.github.com/"],
      { encoding: "utf8" },
    );
    const scopes = /x-oauth-scopes:\s*(.*)/i.exec(dump)?.[1]?.trim();
    const accepted = /x-accepted-oauth-scopes:\s*(.*)/i.exec(dump)?.[1]?.trim();
    console.log("X-OAuth-Scopes:", scopes || "(空 —— 可能是细粒度令牌)");
    console.log("X-Accepted-OAuth-Scopes:", accepted ?? "-");
    console.log(dump.split("\n").filter((l) => /^HTTP|^x-ratelimit|^x-oauth/i.test(l)).join("\n"));
  } finally {
    rmSync(headerFile, { force: true });
  }
}
