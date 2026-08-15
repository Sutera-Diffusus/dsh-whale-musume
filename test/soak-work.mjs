// soak-work.mjs — long-run work-state stability soak:
// flickering signals inside the hold window, mood injection while busy,
// and clean release back to idle. Frame-sampled, fails on any flip.
const CDP = "http://127.0.0.1:9223";
const APP = "http://127.0.0.1:3181";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function newTarget(url) {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  for (const t of list) if (t.type === "page" && t.id) { try { await fetch(`${CDP}/json/close/${t.id}`); } catch { /* */ } }
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
async function fire(call, expression) {
  await call("Runtime.evaluate", { expression, returnByValue: false, awaitPromise: false });
}

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, detail === undefined ? "" : JSON.stringify(detail));
  if (!ok) failures.push(name);
}
async function waitFor(call, expr, ms = 8000, step = 100) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await ev(call, expr).catch(() => false)) return true; await delay(step); }
  return false;
}
async function sampleUntil(call, ms, step = 100) {
  const out = []; const end = Date.now() + ms;
  while (Date.now() < end) {
    out.push(await ev(call, `({ t: Date.now(), state: window.__dshWhaleMoeDebug?.state, src: document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '' })`));
    await delay(step);
  }
  return out;
}

async function main() {
  const target = await newTarget(APP);
  const { ws, call } = await connect(target);
  await Promise.all([call("Page.enable"), call("Runtime.enable")]);
  await call("Emulation.setDeviceMetricsOverride", { width: 1560, height: 980, deviceScaleFactor: 1, mobile: false });
  await call("Page.reload", { ignoreCache: true });
  await waitFor(call, `Boolean(document.querySelector('button'))`, 30000, 500);
  await delay(1000);
  for (let r = 0; r < 4; r++) {
    const d = await ev(call, `(() => { const ds=[...document.querySelectorAll('[role="dialog"]')].filter(n=>n.offsetParent!==null); const labels=['稍后配置','继续','我知道了','关闭']; for(const l of labels){const t=ds.find(n=>[...n.querySelectorAll('button')].some(b=>(b.textContent||'').trim()===l)); if(!t) continue; [...t.querySelectorAll('button')].find(b=>(b.textContent||'').trim()===l).click(); return true;} return false; })()`);
    if (!d) break; await delay(400);
  }
  await ev(call, `localStorage.setItem('whale-moe:pet','1'); localStorage.setItem('whale-moe:mode','float'); localStorage.setItem('whale-moe:keywords','0'); window.dispatchEvent(new CustomEvent('whale-moe-prefs-change',{detail:{key:'mode',value:'float'}})); true`);
  await delay(800);

  // fake workbench marker so the 8s hold path is exercised (home would be 4s)
  await ev(call, `(() => { const n=document.createElement('div'); n.setAttribute('data-soak-workbench','true'); n.setAttribute('data-phase','session'); n.style.cssText='position:fixed;left:60px;top:60px;width:80px;height:40px;z-index:99998;pointer-events:none;'; document.body.appendChild(n); return true; })()`);
  await waitFor(call, `window.__dshWhaleMoeDebug?.view === 'workbench'`, 3000);
  await ev(call, `(() => { const n=document.createElement('div'); n.setAttribute('data-soak-tool','true'); n.setAttribute('data-running',''); n.style.cssText='position:fixed;left:320px;top:160px;width:300px;height:60px;z-index:99999;pointer-events:none;'; document.body.appendChild(n); return true; })()`);
  const sawTool = await waitFor(call, `window.__dshWhaleMoeDebug?.state === 'tool'`, 4000, 50);
  check("soak: reaches tool", sawTool);
  const runningReady = await waitFor(call, `(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('running.webp')`, 4000, 50);
  check("soak: running pose shown", runningReady);

  // Phase A: long gaps (6s) that are still inside the 8s workbench hold.
  await ev(call, `(async () => { const f=document.querySelector('[data-soak-tool]'); for(let i=0;i<5;i++){ f.style.display='none'; await new Promise(r=>setTimeout(r,6000)); f.style.display=''; await new Promise(r=>setTimeout(r,1200)); } return true; })()`);
  const phaseA = await sampleUntil(call, 1000);
  const badA = phaseA.filter((s) => s.state !== "tool" || !s.src.includes("running.webp"));
  check("soak: 6s gaps inside 8s workbench hold never flip", badA.length === 0, { bad: badA.length, last: phaseA[phaseA.length - 1] });

  // Phase B: rapid 0.6s off / 0.4s on churn, sampled concurrently.
  await fire(call, `(async () => { const f=document.querySelector('[data-soak-tool]'); for(let i=0;i<24;i++){ f.style.display='none'; await new Promise(r=>setTimeout(r,600)); f.style.display=''; await new Promise(r=>setTimeout(r,400)); } window.__soakChurnDone=true; })()`);
  const phaseB = await sampleUntil(call, 24500, 80);
  const churnDone = await ev(call, `window.__soakChurnDone === true`);
  const badB = phaseB.filter((s) => s.state !== "tool" || !s.src.includes("running.webp"));
  check("soak: 24x rapid signal churn never flips pose", churnDone && badB.length === 0, { bad: badB.length, samples: phaseB.length, churnDone });

  // Phase C: force a non-work mood while busy — work must win.
  await ev(call, `window.DshWhaleMoeMood && window.DshWhaleMoeMood('daily-eat', 3500); true`);
  const phaseC = await sampleUntil(call, 3800, 80);
  const badC = phaseC.filter((s) => s.state !== "tool" || !s.src.includes("running.webp"));
  check("soak: forced mood cannot override running", badC.length === 0, { bad: badC.length, samples: phaseC.length });

  // Phase D: truly gone releases tool → success → idle, never back to tool.
  await ev(call, `document.querySelector('[data-soak-tool]').remove(); true`);
  const phaseD = await sampleUntil(call, 14500, 100);
  const stateSeq = phaseD.map((s) => s.state);
  const transitions = [];
  for (let i = 1; i < stateSeq.length; i++) if (stateSeq[i] !== stateSeq[i - 1]) transitions.push(`${stateSeq[i - 1]}→${stateSeq[i]}`);
  const bounceToTool = transitions.some((t) => t.endsWith("→tool"));
  const idleDrops = stateSeq.filter((s) => s === "idle").length;
  const final = phaseD[phaseD.length - 1];
  check("soak: releases tool → success → idle, never bounces", idleDrops > 0 && !bounceToTool && final.state === "idle" && !final.src.includes("running.webp"), { transitions, bounceToTool, final });

  // Phase E: idle must stay idle — no random tease flips.
  const phaseE = await sampleUntil(call, 4000, 100);
  const nonIdleE = phaseE.filter((s) => s.state !== "idle");
  check("soak: idle stays idle (no teasing flicker)", nonIdleE.length === 0, { nonIdle: nonIdleE.length, samples: phaseE.length });

  const report = { pass: failures.length === 0, failures, badA: badA.length, badB: badB.length, badC: badC.length, phaseD: { transitions, final }, phaseE: { nonIdle: nonIdleE.length } };
  console.log("REPORT", JSON.stringify(report));
  ws.close();
  process.exit(failures.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
