// tools/asar.mjs —— 只读 asar 工具(桌面端适配勘察用,零依赖)。
// 用法:
//   node tools/asar.mjs ls   <asar> [prefix] [maxDepth]      # 列目录
//   node tools/asar.mjs find <asar> <substr> [limit]         # 按路径子串查找
//   node tools/asar.mjs cat  <asar> <path>                   # 输出文件内容
//   node tools/asar.mjs dump <asar> <path> <outDir> [limit]  # 导出目录树
import { readSync, openSync, closeSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

function readHeader(asar) {
  const fd = openSync(asar, "r");
  const b = Buffer.alloc(16);
  readSync(fd, b, 0, 16, 0);
  const headerSize = b.readUInt32LE(12);
  const jb = Buffer.alloc(headerSize);
  readSync(fd, jb, 0, headerSize, 16);
  return { fd, header: JSON.parse(jb.toString("utf8")), base: 16 + headerSize };
}

function lookup(header, p) {
  const parts = p.split("/").filter(Boolean);
  let node = header;
  for (const part of parts) {
    node = node.files?.[part];
    if (!node) return null;
  }
  return node;
}

function* walk(node, prefix, depth, maxDepth) {
  for (const [k, v] of Object.entries(node.files ?? {})) {
    const p = `${prefix}/${k}`;
    if (v.files) {
      yield { path: p + "/", dir: true, size: 0 };
      if (depth + 1 < maxDepth) yield* walk(v, p, depth + 1, maxDepth);
    } else {
      yield { path: p, dir: false, size: Number(v.size ?? 0) };
    }
  }
}

const [cmd, asar, a, b, c] = process.argv.slice(2);
const { fd, header, base } = readHeader(asar);
try {
  if (cmd === "ls") {
    const node = a ? lookup(header, a) : header;
    if (!node) throw new Error(`not found: ${a}`);
    const maxDepth = Number(b ?? 2);
    for (const e of walk(node, a ? a.replace(/\/$/, "") : "", 0, maxDepth)) {
      console.log(`${e.dir ? "d" : "f"} ${e.size.toString().padStart(10)} ${e.path}`);
    }
  } else if (cmd === "find") {
    const needle = a;
    const limit = Number(b ?? 100);
    let n = 0;
    for (const e of walk(header, "", 0, 64)) {
      if (e.path.includes(needle)) {
        console.log(`${e.dir ? "d" : "f"} ${e.size.toString().padStart(10)} ${e.path}`);
        if (++n >= limit) break;
      }
    }
    console.log(`-- matches: ${n}`);
  } else if (cmd === "cat") {
    const node = lookup(header, a);
    if (!node || node.files) throw new Error(`not a file: ${a}`);
    const buf = Buffer.alloc(Number(node.size));
    readSync(fd, buf, 0, buf.length, base + Number(node.offset));
    process.stdout.write(buf);
  } else if (cmd === "dump") {
    const node = lookup(header, a);
    if (!node?.files) throw new Error(`not a dir: ${a}`);
    const outDir = b;
    const limit = Number(c ?? 100000);
    let n = 0;
    for (const e of walk(node, a.replace(/\/$/, ""), 0, 64)) {
      if (e.dir) continue;
      const rel = path.relative(a.replace(/\/$/, ""), e.path);
      const dest = path.join(outDir, rel);
      mkdirSync(path.dirname(dest), { recursive: true });
      const fnode = lookup(header, e.path);
      const buf = Buffer.alloc(Number(fnode.size));
      readSync(fd, buf, 0, buf.length, base + Number(fnode.offset));
      writeFileSync(dest, buf);
      if (++n >= limit) break;
    }
    console.log(`dumped ${n} files -> ${outDir}`);
  } else {
    throw new Error(`usage: ls|find|cat|dump`);
  }
} finally {
  closeSync(fd);
}
