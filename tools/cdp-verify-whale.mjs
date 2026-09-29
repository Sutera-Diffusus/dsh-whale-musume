// tools/cdp-verify-whale.mjs —— 一次性 headless Edge 验收：鲸鱼娘在 0.2.0-rc.2 宿主里是否真的跑起来。
//
// 资源纪律（用户批准的单次浏览器验收）：
//   · 全局只开 1 个 headless Edge 实例；前台跑、拒绝后台化；
//   · --user-data-dir 指向 %TEMP%\dsh-whale-qa-<时间戳>，收尾时删除；
//   · 收尾一律 taskkill /PID <pid> /T /F 杀整树（含 finally + 超时兜底 + 进程退出钩子）。
//
// 用法：
//   node tools/cdp-verify-whale.mjs --url "http://127.0.0.1:19388/?token=..." [--timeout 45000]
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const EDGE = process.env.EDGE_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = Number(process.env.CDP_PORT ?? 9333);
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const targetUrl = getArg("url");
const hardTimeoutMs = Number(getArg("timeout", "45000"));
if (!targetUrl) {
  console.error("usage: node tools/cdp-verify-whale.mjs --url <host url with token>");
  process.exit(2);
}

const stamp = Date.now();
const profileDir = mkdtempSync(path.join(tmpdir(), `dsh-whale-qa-${stamp}-`));
const pidFile = path.join(tmpdir(), `dsh-whale-qa-${stamp}.pid`);

let child = null;
let killed = false;
function killTree(reason) {
  if (killed) return;
  killed = true;
  if (child?.pid) {
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      console.log(`[cdp] taskkill /PID ${child.pid} /T /F (${reason})`);
    } catch {
      /* 进程可能已退出 */
    }
  }
  try {
    rmSync(profileDir, { recursive: true, force: true });
    console.log(`[cdp] removed temp profile ${profileDir}`);
  } catch {
    /* ignore */
  }
  try {
    rmSync(pidFile, { force: true });
  } catch {
    /* ignore */
  }
}

const sigint = () => {
  killTree("SIGINT");
  process.exit(130);
};
process.on("SIGINT", sigint);
process.on("SIGTERM", sigint);
process.on("exit", () => killTree("process exit"));
process.on("uncaughtException", (error) => {
  console.error("[cdp] uncaught:", error);
  killTree("uncaught exception");
  process.exit(1);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("devtools endpoint never came up");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.pageErrors = [];
    this.failedRequests = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? "")})`));
        else resolve(msg.result);
        return;
      }
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        this.consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(" "));
      }
      if (msg.method === "Runtime.exceptionThrown") {
        this.pageErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
      }
      if (msg.method === "Network.loadingFailed") {
        this.failedRequests.push(`${msg.params.type} ${msg.params.errorText}`);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`evaluate failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    }
    return result.result.value;
  }
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : ` — ${detail}`}`);
}

const hardTimer = setTimeout(() => {
  console.error(`[cdp] 硬超时 ${hardTimeoutMs}ms，强制收尾`);
  killTree("hard timeout");
  process.exit(1);
}, hardTimeoutMs);
hardTimer.unref?.();

try {
  mkdirSync(path.dirname(pidFile), { recursive: true });
  child = spawn(
    EDGE,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-sync",
      "--disable-background-networking",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  writeFileSync(pidFile, String(child.pid));
  console.log(`[cdp] headless edge pid=${child.pid} profile=${profileDir}`);

  await waitForDevtools();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", (e) => reject(new Error(`ws error: ${e.message ?? "unknown"}`)), { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.enable");

  await cdp.send("Page.navigate", { url: targetUrl });

  // 等鲸鱼娘引导完成：presenter 起来后会写 __dshWhaleMoeDebug。
  let boot = null;
  const bootDeadline = Date.now() + 30000;
  while (Date.now() < bootDeadline) {
    boot = await cdp.evaluate(`(() => {
      const d = window.__dshWhaleMoeDebug;
      const root = document.querySelector('[data-dsh-whale-root]');
      return { hasDebug: !!d, state: d && d.state, pose: d && d.pose, hasRoot: !!root,
               scripts: document.querySelectorAll('script[data-dsh-whale-musume="js"]').length,
               styles: document.querySelectorAll('style[data-dsh-whale-musume="css"]').length,
               coreLoaded: !!window.DshWhaleMoeCore, started: !!window.__dshWhaleMoeStarted,
               booted: !!window.__dshWhaleMusumeBooted };
    })()`);
    if (boot?.hasRoot && boot?.coreLoaded && boot?.started) break;
    await sleep(400);
  }

  check("鲸鱼娘根节点已挂载 [data-dsh-whale-root]", boot?.hasRoot, JSON.stringify(boot));
  check("状态机 core 已加载 (DshWhaleMoeCore)", boot?.coreLoaded);
  check("表现层已启动 (__dshWhaleMoeStarted)", boot?.started);
  check("引导标记 __dshWhaleMusumeBooted", boot?.booted);
  check("注入 1 段样式 (data-dsh-whale-musume=css)", boot?.styles === 1, `styles=${boot?.styles}`);
  check("注入 2 段脚本 (core + presenter)", boot?.scripts === 2, `scripts=${boot?.scripts}`);

  // 让状态机稳定下来，再读一次 debug。
  await sleep(2500);
  const view = await cdp.evaluate(`(() => {
    const root = document.querySelector('[data-dsh-whale-root]');
    const frame = root && root.querySelector('[data-dsh-whale-frame]');
    const img = frame && frame.querySelector('img');
    const rect = root ? root.getBoundingClientRect() : null;
    const style = root ? getComputedStyle(root) : null;
    return {
      debug: window.__dshWhaleMoeDebug,
      mode: root && root.getAttribute('data-dsh-whale-mode'),
      viewAttr: document.documentElement.getAttribute('data-dsh-whale-view') ?? document.body.getAttribute('data-dsh-whale-view'),
      rect: rect ? { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top), left: Math.round(rect.left) } : null,
      display: style && style.display,
      zIndex: style && style.zIndex,
      position: style && style.position,
      imgSrc: img && img.getAttribute('src'),
      imgLoaded: img ? (img.complete && img.naturalWidth > 0) : null,
      layers: root ? root.querySelectorAll('[data-dsh-whale-layer]').length : 0,
      live: !!document.querySelector('[data-dsh-whale-live]'),
      themeAttr: document.documentElement.getAttribute('data-theme') ?? document.body.getAttribute('data-theme'),
      htmlClass: document.documentElement.className,
    };
  })()`);

  check("桌宠尺寸合理（宽高 > 40px）", view?.rect && view.rect.w > 40 && view.rect.h > 40, JSON.stringify(view?.rect));
  check("桌宠可见（display 非 none）", view?.display && view.display !== "none", `display=${view?.display} position=${view?.position} z=${view?.zIndex}`);
  check("立绘图层已建立（2 层）", view?.layers === 2, `layers=${view?.layers}`);
  check("立绘图片已成功加载", view?.imgLoaded === true, `src=${view?.imgSrc}`);
  check("状态机 state 已就绪且非 hidden", view?.debug && view.debug.state && view.debug.state !== "hidden" && view.debug.state !== "boot", `state=${view?.debug?.state} pose=${view?.debug?.pose}`);
  check("检测到宿主视图 (data-dsh-whale-view)", Boolean(view?.viewAttr), `view=${view?.viewAttr}`);

  // 宿主 DOM 契约探测：0.2.0-rc.2 里这些标记是否还在（影响状态联动的准确度）。
  const contract = await cdp.evaluate(`(() => {
    const sels = {
      'conversation.chat.node': '[data-slot="conversation.chat.node"]',
      'conversation.composer.bar': '[data-slot="conversation.composer.bar"]',
      'sidebar.settings': '[data-slot="sidebar.settings"]',
      'settings.trigger': '[data-slot="settings.trigger"]',
      'data-running': '[data-running]',
      'data-chat-running': '[data-chat-running]',
      'data-terminal': '[data-terminal]',
      'data-turn-process': '[data-turn-process]',
      'data-step-process': '[data-step-process]',
      'data-streaming': '[data-streaming]',
      'data-error': '[data-error]',
      'pre': 'pre',
    };
    const out = {};
    for (const [k, s] of Object.entries(sels)) out[k] = document.querySelectorAll(s).length;
    return out;
  })()`);
  console.log("[cdp] 宿主标记计数:", JSON.stringify(contract));

  const comet = await cdp.evaluate(`(() => ({
    ext: performance.getEntriesByType('resource').filter(r => /^https?:\\/\\//.test(r.name) && !r.name.includes(location.host)).map(r => r.name),
    whaleAssets: performance.getEntriesByType('resource').filter(r => r.name.includes('/api/dsh-whale-musume/assets')).map(r => r.name.split('f=')[1]),
  }))()`);
  check("无外部网络请求（全部资源来自本机宿主）", comet.ext.length === 0, JSON.stringify(comet.ext).slice(0, 300));
  check("立绘资源经宿主只读路由加载", comet.whaleAssets.some((n) => n?.startsWith("generated/")), `${comet.whaleAssets.length} 个资源`);

  check("零控制台错误", cdp.consoleErrors.length === 0, JSON.stringify(cdp.consoleErrors).slice(0, 500));
  check("零未捕获异常", cdp.pageErrors.length === 0, JSON.stringify(cdp.pageErrors).slice(0, 500));

  const failCount = results.filter((r) => !r.ok).length;
  console.log(`\n[cdp] 汇总: ${results.length - failCount}/${results.length} 通过`);
  console.log(`[cdp] 契约计数: ${JSON.stringify(contract)}`);
  process.exitCode = failCount === 0 ? 0 : 1;
  ws.close();
} catch (error) {
  console.error("[cdp] verify failed:", error);
  process.exitCode = 1;
} finally {
  clearTimeout(hardTimer);
  killTree("normal finish");
}
