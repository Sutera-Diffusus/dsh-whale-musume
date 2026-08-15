// mood-churn.mjs — rapid mixed mood/pose interruptions must never leave
// stacked, blank, or stuck layers; final pose settles back to idle-cute.
import { setTimeout as delay } from "node:timers/promises";
const CDP = "http://127.0.0.1:9223";
const APP = "http://127.0.0.1:3181";

async function newTarget(url) {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  for (const t of list) if (t.type === "page" && t.id) { try { await fetch(`${CDP}/json/close/${t.id}`); } catch {} }
  await delay(400);
  return await (await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
}
async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  let id = 0; const pend = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  });
  return { ws, call: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }) };
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

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, detail === undefined ? "" : JSON.stringify(detail));
  if (!ok) failures.push(name);
}

async function main() {
  const target = await newTarget(APP);
  const { ws, call } = await connect(target);
  await Promise.all([call("Page.enable"), call("Runtime.enable"), call("Log.enable")]);
  await call("Emulation.setDeviceMetricsOverride", { width: 1560, height: 980, deviceScaleFactor: 1, mobile: false });
  await call("Page.reload", { ignoreCache: true });
  await waitUntil(call, `Boolean(document.querySelector('button'))`, 30000, 500);
  await delay(1000);
  for (let r = 0; r < 4; r++) {
    const d = await ev(call, `(() => { const ds=[...document.querySelectorAll('[role="dialog"]')].filter(n=>n.offsetParent!==null); const labels=['稍后配置','继续','我知道了','关闭']; for(const l of labels){const t=ds.find(n=>[...n.querySelectorAll('button')].some(b=>(b.textContent||'').trim()===l)); if(!t) continue; [...t.querySelectorAll('button')].find(b=>(b.textContent||'').trim()===l).click(); return true;} return false; })()`);
    if (!d) break; await delay(400);
  }
  await ev(call, `localStorage.setItem('whale-moe:pet','1'); localStorage.setItem('whale-moe:chat','1'); localStorage.setItem('whale-moe:mode','float'); localStorage.setItem('whale-moe:keywords','0'); true`);
  await delay(800);
  const calm = await waitUntil(call, `window.__dshWhaleMoeDebug?.state === 'idle'`, 20000, 200);
  if (!calm) throw new Error("never reached idle before churn");
  await delay(4500); // let any previous gone-hold expire

  const result = await ev(call, `(async () => {
    const a = () => document.querySelector('[data-dsh-whale-layer="a"]');
    const b = () => document.querySelector('[data-dsh-whale-layer="b"]');
    const samples = [];
    const sampler = setInterval(() => {
      samples.push({
        t: Date.now(),
        state: window.__dshWhaleMoeDebug?.state,
        src: document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '',
        opA: Number(getComputedStyle(a()).opacity),
        opB: Number(getComputedStyle(b()).opacity),
        anims: (document.querySelector('[data-dsh-whale-motion]')?.getAnimations() || []).length
      });
    }, 40);
    const moods = ['daily-coffee', 'daily-eat', 'daily-stretch', 'meme-smug', 'cool-shades', 'daily-pajama'];
    for (let i = 0; i < 24; i++) {
      window.DshWhaleMoeMood(moods[i % moods.length], 900, i % 2 === 0);
      await new Promise((r) => setTimeout(r, 120));
    }
    await new Promise((r) => setTimeout(r, 1800));
    clearInterval(sampler);
    const settle = [];
    for (let i = 0; i < 10; i++) {
      settle.push({
        state: window.__dshWhaleMoeDebug?.state,
        src: document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '',
        anims: (document.querySelector('[data-dsh-whale-motion]')?.getAnimations() || []).length
      });
      await new Promise((r) => setTimeout(r, 100));
    }
    return { samples, settle };
  })()`);

  const samples = result.samples;
  const blank = samples.filter((s) => s.opA < 0.15 && s.opB < 0.15);
  const stacked = samples.filter((s) => s.opA >= 0.5 && s.opB >= 0.5);
  const settle = result.settle;
  const settled = settle.every((s) => s.state === "idle" && s.src.includes("idle-cute") && s.anims === 0);
  const distinct = new Set(samples.map((s) => s.src.split("dsh-whale-state-")[1]?.split(".webp")[0]).filter(Boolean)).size;

  check("churn: never fully blank", blank.length === 0, { blank: blank.length, samples: samples.length });
  check("churn: never stacked pose images", stacked.length <= 1, { stacked: stacked.length, samples: samples.length });
  check("churn: several mood poses actually shown", distinct >= 4, { distinct });
  check("churn: settles back to idle-cute with no stuck animation", settled === true, settle);

  const report = { pass: failures.length === 0, failures, samples: samples.length, blank: blank.length, stacked: stacked.length, distinct, settle };
  console.log("REPORT", JSON.stringify(report));
  ws.close();
  process.exit(failures.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
