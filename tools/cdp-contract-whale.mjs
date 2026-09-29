// tools/cdp-contract-whale.mjs —— 一次性 headless Edge：验证鲸鱼娘的 DOM 契约行为（主题 / 设置页 / 工具信号）。
// 资源纪律同上：单实例、前台跑、taskkill 整树、临时 profile 用完即删。
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const EDGE = process.env.EDGE_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = Number(process.env.CDP_PORT ?? 9335);
const url = process.argv[2];
const profileDir = mkdtempSync(path.join(tmpdir(), "dsh-whale-ctr-"));
let child = null;
const killTree = () => {
  if (child?.pid) {
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      console.log(`[ctr] taskkill /PID ${child.pid} /T /F`);
    } catch { /* already gone */ }
  }
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch { /* ignore */ }
};
process.on("exit", killTree);
process.on("SIGINT", () => { killTree(); process.exit(130); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : ` — ${detail}`}`);
};

try {
  child = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--window-size=1440,900", "about:blank"],
    { stdio: "ignore", windowsHide: true });

  for (let i = 0; i < 80; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch { /* wait */ }
    await sleep(250);
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", () => rej(new Error("ws error")), { once: true });
  });
  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
      return;
    }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error(`timeout ${method}`)); } }, 20000);
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url });

  for (let i = 0; i < 60; i += 1) {
    const ok = await evaluate(`!!(window.__dshWhaleMoeDebug && document.querySelector('[data-dsh-whale-root]'))`);
    if (ok) break;
    await sleep(400);
  }
  await sleep(1500);

  const state = () => evaluate(`(() => {
    const root = document.querySelector('[data-dsh-whale-root]');
    const d = window.__dshWhaleMoeDebug || {};
    return {
      display: root ? getComputedStyle(root).display : null,
      width: root ? root.style.width : null,
      theme: root ? root.getAttribute('data-wm-theme') : null,
      view: d.view,
      state: d.state,
      pose: d.pose,
      layout: d.layout,
      bodyDark: document.body.hasAttribute('data-ds-dark-theme'),
    };
  })()`);

  const base = await state();
  check("基线：首页可见 + 主题已写入", base.display !== "none" && base.theme, JSON.stringify(base));

  // ① 主题：body[data-ds-dark-theme] 空串 = 暗
  await evaluate(`(() => {
    document.body.setAttribute('data-ds-dark-theme', '');
    document.documentElement.setAttribute('data-ds-theme-source', 'system');
    return true;
  })()`);
  await sleep(400);
  // 主题只在状态刷新时写入，触发一次尺寸变化让 reconcile 跑起来
  await evaluate(`window.dispatchEvent(new Event('resize'))`);
  await sleep(800);
  const dark = await state();
  check("主题：body[data-ds-dark-theme=\"\"] → data-wm-theme=dark", dark.theme === "dark", `theme=${dark.theme}`);

  await evaluate(`(() => { document.body.removeAttribute('data-ds-dark-theme'); document.documentElement.setAttribute('data-ds-theme-source', 'light'); return true; })()`);
  await evaluate(`window.dispatchEvent(new Event('resize'))`);
  await sleep(800);
  const light = await state();
  check("主题：移除该属性 + source=light → data-wm-theme=light", light.theme === "light", `theme=${light.theme}`);

  // ② 设置面板打开（data-shortcut-modal=settings）→ 右下 mini；关闭 → 恢复正常尺寸
  await evaluate(`(() => {
    const panel = document.createElement('div');
    panel.setAttribute('data-shortcut-modal', 'settings');
    panel.setAttribute('role', 'dialog');
    panel.id = 'qa-settings-panel';
    panel.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:9999';
    document.body.appendChild(panel);
    return true;
  })()`);
  await sleep(1200);
  const inSettings = await state();
  check(
    "设置面板打开 → view=settings 且切到 mini（不整体隐藏）",
    inSettings.view === "settings" && inSettings.display !== "none" && inSettings.layout === "mini",
    JSON.stringify(inSettings),
  );
  check(
    "mini 尺寸为紧凑值（80-200px）",
    Number.parseInt(String(inSettings.width), 10) >= 80 && Number.parseInt(String(inSettings.width), 10) <= 200,
    `width=${inSettings.width}`,
  );

  await evaluate(`(() => { document.getElementById('qa-settings-panel')?.remove(); return true; })()`);
  await sleep(1500);
  const afterClose = await state();
  check(
    "关闭设置面板 → 退出 settings 且恢复正常尺寸",
    afterClose.view !== "settings" && afterClose.display !== "none" && afterClose.layout !== "mini",
    JSON.stringify(afterClose),
  );

  // ③ 工具信号：[data-tool][data-state=running] → 工作态；移除 → 回到待机
  await evaluate(`(() => {
    const node = document.createElement('div');
    node.setAttribute('data-tool', 'bash');
    node.setAttribute('data-state', 'running');
    node.id = 'qa-tool-card';
    node.style.cssText = 'position:fixed;left:10px;top:10px;width:200px;height:40px';
    document.body.appendChild(node);
    return true;
  })()`);
  await sleep(1800);
  const busy = await state();
  check("出现运行中的工具卡 → 进入工作态（tool/running）", busy.state === "tool" && busy.pose === "running", JSON.stringify(busy));

  await evaluate(`(() => { document.getElementById('qa-tool-card')?.remove(); return true; })()`);
  await sleep(1500);
  const settling = await state();
  check("工具卡移除后立即仍在保持窗口内（不闪回）", settling.state === "tool" || settling.state === "success", `state=${settling.state}`);

  await sleep(6000);
  const idleAgain = await state();
  check("保持窗口结束后回到待机（idle*）", String(idleAgain.state).startsWith("idle"), `state=${idleAgain.state} pose=${idleAgain.pose}`);

  check("全程零控制台错误", consoleErrors.length === 0, JSON.stringify(consoleErrors).slice(0, 400));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n[ctr] 汇总: ${results.length - failed}/${results.length} 通过`);
  process.exitCode = failed === 0 ? 0 : 1;
  ws.close();
} catch (error) {
  console.error("[ctr] failed:", error);
  process.exitCode = 1;
} finally {
  killTree();
}
