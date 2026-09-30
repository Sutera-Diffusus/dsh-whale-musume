// tools/gh-discussions.mjs —— 只读查询仓库 Discussions 分类，或在指定分类发一个 Discussion。
// 令牌来自本机 git 凭据，只写入临时头文件，不打印、不进命令行。
// 用法：
//   node tools/gh-discussions.mjs <owner/repo> --list
//   node tools/gh-discussions.mjs <owner/repo> --create --category <slug-or-name> --title-file <file> --body-file <file>
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const [repo, ...rest] = process.argv.slice(2);
if (!repo) {
  console.error("usage: node tools/gh-discussions.mjs <owner/repo> --list|--create ...");
  process.exit(2);
}
const flag = (n) => {
  const i = rest.indexOf(`--${n}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const proxy = process.env.GITHUB_PROXY ?? "http://127.0.0.1:7897";
const [owner, name] = repo.split("/");

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
  console.error("[gh] 缺少令牌");
  process.exit(3);
}

const headerFile = path.join(tmpdir(), `dsh-gh-gql-${Date.now()}.txt`);
writeFileSync(
  headerFile,
  [`Authorization: Bearer ${token}`, "Accept: application/vnd.github+json", "User-Agent: dsh-agent", "Content-Type: application/json", ""].join("\n"),
  { mode: 0o600 },
);
const gql = (query, variables) => {
  const bodyFile = path.join(tmpdir(), `dsh-gh-gqlbody-${Date.now()}.json`);
  writeFileSync(bodyFile, JSON.stringify({ query, variables }), "utf8");
  try {
    const raw = execFileSync(
      "curl.exe",
      ["-sS", "--max-time", "90", "-x", proxy, "--header", `@${headerFile}`, "-X", "POST", "--data-binary", `@${bodyFile}`, "https://api.github.com/graphql"],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    const parsed = JSON.parse(raw);
    if (parsed.errors) throw new Error(`GraphQL: ${JSON.stringify(parsed.errors).slice(0, 400)}`);
    return parsed.data;
  } finally {
    rmSync(bodyFile, { force: true });
  }
};

try {
  const repoData = gql(
    `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ id nameWithOwner discussionCategories(first:25){ nodes{ id name slug isAnswerable } } } }`,
    { owner, name },
  );
  const repository = repoData.repository;
  const categories = repository.discussionCategories.nodes;
  console.log(`[gh] ${repository.nameWithOwner} 的讨论分类：`);
  for (const c of categories) console.log(`  - ${c.name} (slug=${c.slug}${c.isAnswerable ? ", 可标记答案" : ""})`);

  if (rest.includes("--list")) process.exit(0);

  const wanted = (flag("category") ?? "").toLowerCase();
  const category = categories.find((c) => c.slug.toLowerCase() === wanted || c.name.toLowerCase() === wanted);
  if (!category) {
    console.error(`[gh] 找不到分类：${wanted}（可用：${categories.map((c) => c.slug).join(", ")}）`);
    process.exit(1);
  }
  const title = readFileSync(path.resolve(flag("title-file")), "utf8").trim();
  const body = readFileSync(path.resolve(flag("body-file")), "utf8");
  const res = gql(
    `mutation($repositoryId:ID!,$categoryId:ID!,$title:String!,$body:String!){ createDiscussion(input:{repositoryId:$repositoryId,categoryId:$categoryId,title:$title,body:$body}){ discussion{ url number title } } }`,
    { repositoryId: repository.id, categoryId: category.id, title, body },
  );
  const d = res.createDiscussion.discussion;
  console.log(`[gh] 已发布：${d.url}`);
  console.log(`[gh] #${d.number} ${d.title}（分类 ${category.name}）`);
} finally {
  rmSync(headerFile, { force: true });
}
