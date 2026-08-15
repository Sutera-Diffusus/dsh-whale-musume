// motion-qa.mjs — frame-by-frame twitch detector for pose switch and blink.
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9223";
const APP = "http://127.0.0.1:3181";
const SHOTS = "D:/DeepseekHarness_WorkSpace/_shots/dsh-whale-moe";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function newTarget(url) {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  for (const t of list) if (t.type === "page" && t.id) { try { await fetch(`${CDP}/json/close/${t.id}`); } catch { /* */ } }
  await delay(400);
  const r = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  return await r.json();
}
async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  let id = 0;
  const pend = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  });
  const call = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  return { ws, call };
}
async function ev(call, expression) {
  const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function waitUntil(call, expression, ms = 20000, step = 200) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await ev(call, expression).catch(() => false)) return true; await delay(step); }
  return false;
}
async function shot(call, name) {
  const r = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.data, "base64"));
}

const failures = [];
function check(name, ok, detail) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`, detail === undefined ? "" : JSON.stringify(detail)); if (!ok) failures.push(name); }

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const target = await newTarget(APP);
  const { ws, call } = await connect(target);
  await Promise.all([call("Page.enable"), call("Runtime.enable")]);
  await call("Emulation.setDeviceMetricsOverride", { width: 1560, height: 980, deviceScaleFactor: 1, mobile: false });
  await call("Page.reload", { ignoreCache: true });
  for (let i = 0; i < 60; i++) { if (await ev(call, `Boolean(document.querySelector('button'))`).catch(() => false)) break; await delay(500); }
  await delay(1000);
  for (let r = 0; r < 4; r++) {
    const d = await ev(call, `(() => { const ds=[...document.querySelectorAll('[role="dialog"]')].filter(n=>n.offsetParent!==null); const labels=['稍后配置','继续','我知道了','关闭']; for(const l of labels){const t=ds.find(n=>[...n.querySelectorAll('button')].some(b=>(b.textContent||'').trim()===l)); if(!t) continue; [...t.querySelectorAll('button')].find(b=>(b.textContent||'').trim()===l).click(); return true;} return false; })()`);
    if (!d) break;
    await delay(400);
  }
  await ev(call, `localStorage.setItem('whale-moe:pet','1'); localStorage.setItem('whale-moe:mode','float'); localStorage.setItem('whale-moe:keywords','0'); window.dispatchEvent(new CustomEvent('whale-moe-prefs-change',{detail:{key:'mode',value:'float'}})); true`);
  await delay(800);
  // The test copy may carry a real work signal from previous runs.
  // Start every phase from a truly calm mascot, with the gone-hold fully expired.
  const calm0 = await waitUntil(call, `window.__dshWhaleMoeDebug?.state === 'idle'`, 20000, 200);
  if (!calm0) throw new Error("never reached idle before mood test");
  await delay(4500);
  await shot(call, "qa-0-idle.png");

  // ---- pose swap: instant single-layer swap, no stacked images ----
  const overlapFrames = await ev(call, `(async () => {
    window.DshWhaleMoeMood && window.DshWhaleMoeMood('star', 1400);
    const a = document.querySelector('[data-dsh-whale-layer="a"]');
    const b = document.querySelector('[data-dsh-whale-layer="b"]');
    const frames = [];
    for (let i = 0; i < 24; i++) {
      frames.push([Number(getComputedStyle(a).opacity), Number(getComputedStyle(b).opacity)]);
      await new Promise((r) => setTimeout(r, 40));
    }
    return frames;
  })()`);
  const stackedFrames = overlapFrames.filter(([x, y]) => x >= 0.5 && y >= 0.5).length;
  const blankFrames = overlapFrames.filter(([x, y]) => x < 0.15 && y < 0.15).length;
  const swappedOnce = overlapFrames.some(([x, y]) => x < 0.5 && y >= 0.5);
  check("switch: mood actually swaps layers", swappedOnce, { swappedOnce, first: overlapFrames.slice(0, 8) });
  check("switch: no stacked pose images", stackedFrames <= 1, { stackedFrames, first: overlapFrames.slice(0, 8) });
  check("switch: never fully blank", blankFrames === 0, blankFrames);
  await shot(call, "qa-1-switch-mid.png");

  // ---- float busy vs idle: pose + glow marker ----
  const calm1 = await waitUntil(call, `window.__dshWhaleMoeDebug?.state === 'idle'`, 10000, 200);
  if (!calm1) throw new Error("never returned to idle before busy test");
  await delay(1200);
  await ev(call, `(() => { const n=document.createElement('div'); n.setAttribute('data-dsh-qa-fake','true'); n.setAttribute('data-running',''); n.style.cssText='position:fixed;left:320px;top:160px;width:300px;height:60px;z-index:99999;pointer-events:none;'; document.body.appendChild(n); return true; })()`);
  const settled = await waitUntil(call, `window.__dshWhaleMoeDebug?.state === 'tool' && (document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('dsh-whale-state-running.webp') && Date.now() - (window.__dshWhaleMoeDebug?.at || 0) < 500`, 5000, 50);
  if (!settled) throw new Error("tool state + running pose never settled");
  await delay(250);
  const busyDiag = await ev(call, `({ state: window.__dshWhaleMoeDebug?.state, src: document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src'), busy: document.querySelector('[data-dsh-whale-root]')?.hasAttribute('data-dsh-whale-busy'), debug: window.__dshWhaleMoeDebug })`);
  check("float: busy pose + glow while running", busyDiag.state === "tool" && busyDiag.src.includes("dsh-whale-state-running.webp") && busyDiag.busy === true, busyDiag);
  await shot(call, "qa-2-switch-after.png");

  // ---- work-state stickiness: a transient signal gap must not flip pose ----
  const gapProbe = await ev(call, `(async () => {
    const fake = document.querySelector('[data-dsh-qa-fake]');
    fake.remove();
    const samples = [];
    for (let i = 0; i < 15; i++) {
      samples.push({ state: window.__dshWhaleMoeDebug?.state, src: document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '' });
      await new Promise((r) => setTimeout(r, 100));
    }
    document.body.appendChild(fake);
    await new Promise((r) => setTimeout(r, 600));
    const after = { state: window.__dshWhaleMoeDebug?.state, src: document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '' };
    const flips = samples.filter((s) => s.state !== 'tool' || !s.src.includes('running.webp')).length;
    return { flips, samples, after };
  })()`);
  check("work: signal gap < hold never flips pose", gapProbe.flips === 0 && gapProbe.after.state === "tool" && gapProbe.after.src.includes("running.webp"), gapProbe);

  await ev(call, `document.querySelectorAll('[data-dsh-qa-fake]').forEach(n=>n.remove()); true`);
  for (let i = 0; i < 40; i++) { if (await ev(call, `window.__dshWhaleMoeDebug?.state === 'idle'`).catch(() => false)) break; await delay(200); }
  await delay(300);
  const idleBusy = await ev(call, `document.querySelector('[data-dsh-whale-root]')?.hasAttribute('data-dsh-whale-busy') === true`);
  check("float: glow clears when idle", idleBusy === false, idleBusy);

  // ---- blink sampling (wait until idle and pose-in fade finished) ----
  for (let i = 0; i < 40; i++) {
    if (await ev(call, `window.__dshWhaleMoeDebug?.state === 'idle' && !document.querySelector('[data-dsh-whale-layer].dsh-whale-pose-in')`).catch(() => false)) break;
    await delay(100);
  }
  await delay(250);
  const blink = await ev(call, `(async () => {
    window.DshWhaleMoeBlink();
    const layer = document.querySelector('[data-dsh-whale-layer].dsh-whale-active');
    const frames = [];
    for (let i = 0; i < 8; i++) { frames.push(Number(getComputedStyle(layer).opacity)); await new Promise((r) => setTimeout(r, 70)); }
    return frames;
  })()`);
  const blinkJump = Math.max(...blink.map((v, i) => (i ? Math.abs(v - blink[i - 1]) : 0)));
  const blinkMin = Math.min(...blink);
  check("blink: smooth opacity dip (max jump <= 0.15, min >= 0.93)", blinkJump <= 0.15 && blinkMin >= 0.93, { blink, blinkJump });
  await shot(call, "qa-3-blink-mid.png");

  // ---- idle action pose must enter with the motion-hide animation ----
  await ev(call, `window.DshWhaleMoeMood && window.DshWhaleMoeMood('daily-coffee', 1400, true); true`);
  await delay(320);
  const coffeeDiag = await ev(call, `({
    src: document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '',
    anims: (document.querySelector('[data-dsh-whale-motion]')?.getAnimations() || []).length
  })`);
  check("idle action: coffee pose enters with motion-hide animation", coffeeDiag.src.includes("daily-coffee") && coffeeDiag.anims >= 1, coffeeDiag);

  const report = { pass: failures.length === 0, failures, overlapFrames: overlapFrames.slice(0, 12), busyDiag, gapProbe, blink, coffeeDiag };
  fs.writeFileSync(path.join(SHOTS, "motion-qa.json"), JSON.stringify(report, null, 2), "utf8");
  console.log("REPORT", JSON.stringify(report));
  ws.close();
  process.exit(failures.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
