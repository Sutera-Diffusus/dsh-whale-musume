// Action showcase: captures click emoji burst, triple celebration, busy glow,
// busy click pose and balance-low event on the copy.
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9223";
const APP = "http://127.0.0.1:3181";
const SHOTS = "<QA_SHOTS_DIR>/actions";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const target = await (await fetch(`${CDP}/json/new?${APP}`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  let id = 0; const pend = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  const call = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => (await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const shot = async (name) => {
    const r = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.data, "base64"));
    console.log("shot", name);
  };
  await call("Page.enable"); await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 1560, height: 980, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: APP });
  await delay(8000);
  const dismiss = `(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter((n) => n.offsetParent !== null);
    const labels = ['稍后配置', '继续', '我知道了', '关闭'];
    for (const label of labels) {
      const target = dialogs.find((n) => [...n.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === label));
      if (!target) continue;
      [...target.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === label).click();
      return true;
    }
    return false;
  })()`;
  for (let i = 0; i < 6; i++) { await ev(dismiss); await delay(400); }
  await ev(`localStorage.setItem('whale-moe:pet','1'); localStorage.setItem('whale-moe:chat','1'); localStorage.setItem('whale-moe:particles','1'); localStorage.setItem('whale-moe:mode','float'); window.dispatchEvent(new CustomEvent('whale-moe-prefs-change',{detail:{key:'mode',value:'float'}})); true`);
  await delay(1200);

  // 1. single pat: blush + emoji fly
  await ev(`document.querySelector('[data-dsh-whale-mascot]').click()`);
  for (let i = 0; i < 30; i++) { if (await ev(`(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('dsh-whale-state-blush.webp')`).catch(() => false)) break; await delay(50); }
  await delay(120);
  await shot("action-01-pat-emoji.png");
  await delay(1200);

  // 2. triple pat: star celebration + spin + particles
  await ev(`(() => { const m=document.querySelector('[data-dsh-whale-mascot]'); m.click(); m.click(); m.click(); return true; })()`);
  for (let i = 0; i < 40; i++) { if (await ev(`(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('dsh-whale-state-star.webp')`).catch(() => false)) break; await delay(50); }
  await delay(180);
  await shot("action-02-triple-star.png");
  await delay(2600);

  // 3. busy running: full running pose + glow + chip
  await ev(`(() => { const n=document.createElement('div'); n.setAttribute('data-dsh-qa-fake','true'); n.setAttribute('data-running',''); n.style.cssText='position:fixed;left:320px;top:160px;width:300px;height:60px;z-index:99999;pointer-events:none;'; document.body.appendChild(n); return true; })()`);
  for (let i = 0; i < 30; i++) { if (await ev(`window.__dshWhaleMoeDebug?.state === 'tool'`).catch(() => false)) break; await delay(100); }
  for (let i = 0; i < 40; i++) { if (await ev(`(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('dsh-whale-state-running.webp')`).catch(() => false)) break; await delay(50); }
  await delay(400);
  await shot("action-03-busy-glow.png");

  // 4. click while busy: work-pat/work-ram
  await ev(`document.querySelector('[data-dsh-whale-mascot]').click()`);
  for (let i = 0; i < 40; i++) {
    if (await ev(`(() => { const s = document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || ''; return s.includes('dsh-whale-state-work-pat.webp') || s.includes('dsh-whale-state-work-ram.webp'); })()`).catch(() => false)) break;
    await delay(50);
  }
  await delay(250);
  await shot("action-04-busy-click.png");
  await delay(2600);

  // 5. balance-low event
  await ev(`window.dispatchEvent(new Event('dsh-whale-balance-low'))`);
  for (let i = 0; i < 40; i++) { if (await ev(`(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('dsh-whale-state-balance-low.webp')`).catch(() => false)) break; await delay(50); }
  await delay(250);
  await shot("action-05-balance-low.png");

  ws.close();
  console.log("DONE");
}
main().catch((e) => { console.error(e); process.exit(2); });
