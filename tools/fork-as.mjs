// tools/fork-as.mjs —— 用指定名字 fork 一个仓库（避免同名 fork 落在别的 fork 网络里）。
// 用法：node tools/fork-as.mjs <owner/repo> <newName>
import { writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const [target, newName] = process.argv.slice(2);
if (!target || !newName) {
  console.error("usage: node tools/fork-as.mjs <owner/repo> <newName>");
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
}
if (!token) {
  console.error("缺少令牌");
  process.exit(3);
}
const headerFile = path.join(tmpdir(), `dsh-gh-fork-${Date.now()}.txt`);
writeFileSync(headerFile, [`Authorization: Bearer ${token}`, "Accept: application/vnd.github+json", "User-Agent: dsh-agent", "Content-Type: application/json", ""].join("\n"), { mode: 0o600 });
const curl = (args) => execFileSync("curl.exe", ["-sS", "--max-time", "90", "-x", proxy, "--header", `@${headerFile}`, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
try {
  const bodyFile = path.join(tmpdir(), `dsh-gh-forkbody-${Date.now()}.json`);
  writeFileSync(bodyFile, JSON.stringify({ name: newName, default_branch_only: true }), "utf8");
  let res;
  try {
    res = JSON.parse(curl(["-X", "POST", "https://api.github.com/repos/" + target + "/forks", "--data-binary", `@${bodyFile}`]));
  } finally {
    rmSync(bodyFile, { force: true });
  }
  console.log("fork 请求返回：", res.full_name ?? JSON.stringify(res).slice(0, 300));
  for (let i = 0; i < 20; i += 1) {
    const probe = JSON.parse(curl([`https://api.github.com/repos/${res.owner?.login ?? res.full_name?.split("/")[0]}/${newName}`]));
    if (probe.full_name) {
      console.log(`fork 就绪：${probe.full_name} default=${probe.default_branch} parent=${probe.parent?.full_name ?? "-"}`);
      break;
    }
    execFileSync(process.execPath, ["-e", "setTimeout(()=>{},2000)"]);
  }
} finally {
  rmSync(headerFile, { force: true });
}
