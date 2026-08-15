// whale-moe mascot-only visual audit: layer health, independence, overflow.
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9223";
const APP = "http://127.0.0.1:3181";
const OUT = "D:/DeepseekHarness_WorkSpace/_shots/dsh-whale-moe/audit.json";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const watchdog = setTimeout(() => process.exit(2), 120000);

const AUDIT = `(() => {
  const vis = (n) => { const s = getComputedStyle(n); const r = n.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
  const mascot = document.querySelector('[data-dsh-whale-mascot]');
  const root = document.querySelector('[data-dsh-whale-root]');
  const bubble = document.querySelector('[data-dsh-whale-bubble]');
  return {
    pack: document.body.getAttribute('data-dsh-theme-pack'),
    rootVisible: root ? root.style.display !== 'none' : false,
    mascotSrc: mascot ? mascot.getAttribute('src') : '',
    mascotSize: mascot ? { w: Math.round(mascot.getBoundingClientRect().width), h: Math.round(mascot.getBoundingClientRect().height) } : null,
    bubbleQuiet: bubble ? bubble.hidden : true,
    bubbleSurface: bubble && !bubble.hidden ? getComputedStyle(bubble).backgroundColor : null,
    decorNodes: document.querySelectorAll('[data-dsh-whale-root], [data-dsh-whale-particle]').length,
    overflow: document.documentElement.scrollWidth > innerWidth + 2,
    debug: window.__dshWhaleMoeDebug
  };
})()`;

async function main() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page" && t.url.startsWith(APP)) || list.find((t) => t.type === "page");
  if (!page) throw new Error("no CDP page target");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const p = pending.get(message.id);
      pending.delete(message.id);
      message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result);
    }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Runtime.evaluate", { expression: `localStorage.setItem('whale-moe:pet','1'); localStorage.setItem('whale-moe:chat','1'); localStorage.setItem('whale-moe:particles','1'); true`, returnByValue: true });
  await call("Page.reload");
  for (let i = 0; i < 60; i++) {
    const ready = await (async () => {
      const r = await call("Runtime.evaluate", { expression: `Boolean(document.querySelector('button'))`, returnByValue: true });
      return r.result.value;
    })().catch(() => false);
    if (ready) break;
    await delay(500);
  }
  await delay(800);
  for (let round = 0; round < 4; round += 1) {
    const dismissed = await (async () => {
      const r = await call("Runtime.evaluate", { expression: `(() => {
        const dialogs=[...document.querySelectorAll('[role="dialog"]')].filter(n=>n.offsetParent!==null);
        const labels=['稍后配置','继续','我知道了','关闭'];
        for(const label of labels){const t=dialogs.find(n=>[...n.querySelectorAll('button')].some(b=>(b.textContent||'').trim()===label)); if(!t) continue; [...t.querySelectorAll('button')].find(b=>(b.textContent||'').trim()===label).click(); return true;}
        return false;
      })()`, returnByValue: true });
      return r.result.value;
    })().catch(() => false);
    if (!dismissed) break;
    await delay(400);
  }
  for (let i = 0; i < 40; i++) {
    const done = await (async () => {
      const r = await call("Runtime.evaluate", { expression: `Boolean(document.querySelector('[data-dsh-whale-root]'))`, returnByValue: true });
      return r.result.value;
    })().catch(() => false);
    if (done) break;
    await delay(500);
  }
  const r = await call("Runtime.evaluate", { expression: AUDIT, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  const audit = r.result.value;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(audit, null, 2), "utf8");
  const ok = audit.pack !== "whale-moe" && audit.rootVisible === true && audit.mascotSrc.includes("whale") && audit.decorNodes <= 60 && audit.overflow === false && audit.debug && audit.debug.state !== "boot";
  console.log(JSON.stringify({ ok, audit }, null, 2));
  socket.close();
  clearTimeout(watchdog);
  process.exit(ok ? 0 : 1);
}
main().catch((error) => { console.error(error); clearTimeout(watchdog); process.exit(2); });
