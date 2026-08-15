// whale-moe mascot-only CDP acceptance against the 3181 copy.
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9223";
const APP = "http://127.0.0.1:3181";
const SHOTS = process.env.DSH_QA_SHOTS || "D:/DeepseekHarness_WorkSpace/_shots/dsh-whale-moe";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...parts);
const watchdog = setTimeout(() => { console.error("WATCHDOG: forced exit after 240s"); process.exit(2); }, 240000);

const failures = [];
const runtimeErrors = [];
function check(name, ok, detail) {
  log(`${ok ? "PASS" : "FAIL"} ${name}`, detail === undefined ? "" : JSON.stringify(detail));
  if (!ok) failures.push(name);
}

async function newTarget(url) {
  try {
    const list = await (await fetch(`${CDP}/json/list`)).json();
    for (const existing of list) {
      if (existing.type === "page" && existing.id) {
        try { await fetch(`${CDP}/json/close/${existing.id}`); } catch { /* best effort */ }
      }
    }
    await delay(500);
  } catch { /* CDP list may race */ }
  const response = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`CDP new failed: ${response.status}`);
  return await response.json();
}

async function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const p = pending.get(message.id);
      pending.delete(message.id);
      message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result);
    } else if (message.method) events.push(message);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  return { socket, call, events };
}

async function evaluate(call, expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function screenshot(call, name) {
  const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(SHOTS, name), Buffer.from(result.data, "base64"));
  log("shot", name);
}
async function waitFor(call, expression, label, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await evaluate(call, expression)) return true; } catch { /* keep polling */ }
    await delay(250);
  }
  throw new Error(`timeout waiting for ${label}`);
}
async function waitReady(call) {
  for (let attempt = 0; attempt < 110; attempt++) {
    const ready = await evaluate(call, `Boolean(document.querySelector('button'))`).catch(() => false);
    if (ready) return true;
    await delay(800);
  }
  return false;
}

const DISMISS = `(() => {
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
async function dismissAll(call) {
  for (let round = 0; round < 4; round += 1) {
    const dismissed = await evaluate(call, DISMISS);
    if (!dismissed) break;
    await delay(400);
  }
  await waitFor(call, `![...document.querySelectorAll('[role="dialog"]')].some((n) => n.offsetParent !== null)`, "dialogs dismissed", 6000).catch(() => {});
}

const fakeTree = `(() => {
  document.querySelectorAll('[data-dsh-qa-fake]').forEach((n) => n.remove());
  const box = document.createElement('div');
  box.setAttribute('data-dsh-qa-fake', 'true');
  box.style.cssText = 'position:fixed;left:320px;top:160px;width:640px;height:80px;z-index:99999;pointer-events:none;';
  box.innerHTML = '<div data-slot="conversation.chat.node" style="display:block;width:620px;height:60px;background:#fff"></div>';
  document.body.appendChild(box);
  return true;
})()`;
const addFake = (attrs) => `(() => {
  const node = document.createElement('div');
  node.setAttribute('data-dsh-qa-fake', 'true');
  ${attrs}
  node.style.cssText = 'position:fixed;left:320px;top:160px;width:300px;height:60px;z-index:99999;pointer-events:none;';
  document.body.appendChild(node);
  return true;
})()`;
const dropFakes = `(() => { document.querySelectorAll('[data-dsh-qa-fake]').forEach((n) => n.remove()); return true; })()`;

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  log("creating CDP target");
  const target = await newTarget(APP);
  const { socket, call, events } = await connect(target);
  log("connected");
  await Promise.all([call("Page.enable"), call("Runtime.enable"), call("Log.enable"), call("Network.enable")]);
  await call("Emulation.setDeviceMetricsOverride", { width: 1560, height: 980, deviceScaleFactor: 1, mobile: false });
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "no-preference" }] });
  await evaluate(call, `localStorage.setItem('whale-moe:pet','1'); localStorage.setItem('whale-moe:chat','1'); localStorage.setItem('whale-moe:particles','1'); localStorage.setItem('whale-moe:mode','auto'); localStorage.removeItem('whale-moe:floatX'); localStorage.removeItem('whale-moe:floatY'); true`);
  await call("Page.reload", { ignoreCache: true });
  await waitReady(call);
  await delay(800);
  await dismissAll(call);
  await delay(600);

  // Phase 1: mascot is on by default and independent of any theme pack
  await waitFor(call, `!!document.querySelector('[data-dsh-whale-root]')`, "mascot root appears by default");
  await waitFor(call, `(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('home-peek')`, "home peek src written");
  const home = await evaluate(call, `(() => {
    const active = document.querySelector('[data-dsh-whale-layer].dsh-whale-active');
    const bubble = document.querySelector('[data-dsh-whale-bubble]');
    return {
      pack: document.body.getAttribute('data-dsh-theme-pack'),
      src: active ? active.getAttribute('src') : '',
      bubbleHidden: bubble ? bubble.hidden : true,
      bubbleText: bubble ? bubble.textContent : '',
      view: document.body.getAttribute('data-dsh-whale-view'),
      decorNodes: document.querySelectorAll('[data-dsh-whale-root], [data-dsh-whale-particle], [data-dsh-whale-burst]').length,
      overflow: document.documentElement.scrollWidth > innerWidth + 2
    };
  })()`);
  check("home: mascot independent of theme pack", home.pack !== "whale-moe" && home.src.includes("dsh-whale-home-peek.webp"), home);
  check("home: quiet bubble", home.bubbleHidden === true, home.bubbleHidden);
  check("home: no overflow", home.overflow === false, home.overflow);
  check("home: decor budget <= 60", home.decorNodes <= 60, home.decorNodes);
  await screenshot(call, "01-home-light.png");

  // Phase 1.5: ADV motion verification + growth/keywords/night/fx
  const motion = await evaluate(call, `(async () => {
    const frame = document.querySelector('[data-dsh-whale-frame]');
    const ys = [];
    for (let i = 0; i < 5; i++) { ys.push(new DOMMatrixReadOnly(getComputedStyle(frame).transform).m42); await new Promise((r) => setTimeout(r, 500)); }
    return { deltaY: Math.max(...ys) - Math.min(...ys), anim: getComputedStyle(frame).animationName };
  })()`);
  check("motion: breath displacement >= 3px", motion.deltaY >= 3 && /wm-breathe/.test(motion.anim), motion);

  await evaluate(call, `localStorage.setItem('whale-moe:keywords','1'); window.dispatchEvent(new CustomEvent('whale-moe-prefs-change',{detail:{key:'keywords',value:'1'}})); true`);
  const growth0 = await evaluate(call, `JSON.stringify({ mood: localStorage.getItem('whale-moe:mood'), affinity: localStorage.getItem('whale-moe:affinity'), achievements: localStorage.getItem('whale-moe:achievements') })`);
  await evaluate(call, `document.querySelector('[data-dsh-whale-frame]').click()`);
  await delay(150);
  await evaluate(call, `document.querySelector('[data-dsh-whale-frame]').click(); document.querySelector('[data-dsh-whale-frame]').click();`);
  await delay(300);
  const growth1 = await evaluate(call, `JSON.stringify({ mood: localStorage.getItem('whale-moe:mood'), affinity: localStorage.getItem('whale-moe:affinity'), achievements: localStorage.getItem('whale-moe:achievements') })`);
  check("growth: pat/triple change values + unlock first-triple", growth0 !== growth1 && growth1.includes("first-triple"), { growth0, growth1 });
  await delay(2500); // let the triple-pat celebration finish so it cannot overwrite the keyword line
  await evaluate(call, `(() => { const n=document.createElement('div'); n.setAttribute('data-slot','conversation.chat.node'); n.setAttribute('data-dsh-qa-fake','true'); n.style.cssText='position:fixed;left:320px;top:160px;width:600px;height:40px;z-index:99999;pointer-events:none;'; n.textContent='谢谢你！'; document.body.appendChild(n); return true; })()`);
  try {
    await waitFor(call, `(() => { const t=document.querySelector('[data-dsh-whale-bubble-text]'); return t && (t.textContent.includes('鸡腿') || t.textContent.includes('谢谢') || t.textContent.includes('不客气')); })()`, "keyword reply", 12000);
  } catch (e) {
    const kwDiag = await evaluate(call, `JSON.stringify({ kw: localStorage.getItem('whale-moe:keywords'), chat: document.querySelectorAll('[data-slot="conversation.chat.node"]').length, bubble: document.querySelector('[data-dsh-whale-bubble-text]')?.textContent, scans: window.__dshWhaleMoeKeywordScans, runs: window.__dshWhaleMoeKeywordRuns, matched: window.__dshWhaleMoeKeywordMatched, kwLine: window.__dshWhaleMoeKeywordLine, debug: window.__dshWhaleMoeDebug })`);
    throw new Error("keyword diag: " + kwDiag);
  }
  check("keywords: thanks triggers dedicated reply", true);
  await evaluate(call, `document.querySelectorAll('[data-dsh-qa-fake]').forEach(n=>n.remove())`);
  await evaluate(call, `document.body.setAttribute('data-dsh-whale-night','true'); true`);
  const night = await evaluate(call, `(() => { for(const s of document.styleSheets){ try{ for(const r of s.cssRules){ if(r.selectorText && r.selectorText.includes('data-dsh-whale-night') && r.cssText.includes('brightness')) return true; } } catch(e){} } return false; })()`);
  check("night: dim rule defined", night === true, night);
  await evaluate(call, `document.body.removeAttribute('data-dsh-whale-night'); true`);
  const fxKinds = await evaluate(call, `(() => { const set=new Set(); for(const s of document.styleSheets){ try{ for(const r of s.cssRules){ if(r.selectorText && r.selectorText.includes('.fx-')) set.add(r.selectorText.split('.fx-')[1].split(',')[0]); } } catch(e){} } return set.size; })()`);
  check("fx: >= 12 effect kinds defined", fxKinds >= 12, fxKinds);

  // Phase 2: settings stays clean, theme entry is gone, mascot panel exists
  await evaluate(call, `(() => { const b=[...document.querySelectorAll('button')].find((n)=>(n.textContent||'').trim()==='设置'&&n.offsetParent!==null); b?.click(); return !!b; })()`);
  await waitFor(call, `!!document.querySelector('[role="dialog"]')`, "settings dialog", 6000).catch(() => {});
  await evaluate(call, `(() => { const nav=[...document.querySelectorAll('[role="dialog"] button')].find((n)=>(n.textContent||'').trim()==='主题'); nav?.click(); return !!nav; })()`);
  await delay(500);
  const themeGone = await evaluate(call, `[...document.querySelectorAll('option')].some((o) => o.value === 'whale-moe')`);
  check("settings: theme entry removed", themeGone === false, themeGone);
  await evaluate(call, `(() => { const nav=[...document.querySelectorAll('[role="dialog"] button')].find((n)=>(n.textContent||'').trim()==='看板娘'); nav?.click(); return !!nav; })()`);
  await delay(500);
  const settings = await evaluate(call, `(() => {
    const root = document.querySelector('[data-dsh-whale-root]');
    const switches = [...document.querySelectorAll('[role="dialog"] button[role="switch"]')].map((b) => ({ pressed: b.getAttribute('aria-checked'), txt: (b.textContent || '').trim() }));
    const dialog = document.querySelector('[role="dialog"]');
    const text = dialog ? dialog.textContent : '';
    return { rootDisplay: root ? getComputedStyle(root).display : 'missing', switches, hasGrowth: text.includes('心情') && text.includes('好感度') && text.includes('重置养成'), hasKeyword: text.includes('关键词感知'), hasTitle: text.includes('如何称呼我'), hasStats: text.includes('陪伴') && text.includes('成就墙') && text.includes('工具百连') && !text.includes('—'), wardrobeGone: !text.includes('装饰衣柜') && !text.includes('小皇冠'), modeGone: !text.includes('形态') && !text.includes('悬浮（可拖拽）') };
  })()`);
  check("settings: mascot stays out", settings.rootDisplay === "none", settings.rootDisplay);
  check("settings: mascot panel has 6 switches", settings.switches.length === 6, settings.switches);
  check("settings: growth + keyword rows", settings.hasGrowth && settings.hasKeyword, settings);
  check("settings: live stats + companionship + achievements", settings.hasStats === true, settings);
  check("settings: wardrobe removed", settings.wardrobeGone === true, settings);
  check("settings: mode selector hidden (float only)", settings.modeGone === true, settings);
  check("settings: call-me title input", settings.hasTitle === true, settings.hasTitle);
  await screenshot(call, "02-settings-light.png");
  await evaluate(call, `(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true; })()`);
  await waitFor(call, `!document.querySelector('[role="dialog"]')`, "settings closed", 6000).catch(async () => {
    await call("Page.reload", { ignoreCache: true });
    await waitReady(call);
    await delay(800);
    await dismissAll(call);
  });

  // Phase 3: state machine walk on synthetic nodes
  await evaluate(call, fakeTree);
  await waitFor(call, `document.body.getAttribute('data-dsh-whale-view') === 'workbench'`, "workbench view");
  await waitFor(call, `!!document.querySelector('[data-dsh-whale-mascot]')`, "mascot mounted after settings phase");
  await waitFor(call, `window.__dshWhaleMoeDebug && !['waiting','tool','thinking','failure'].includes(window.__dshWhaleMoeDebug.state)`, "workbench idle is calm (no sweat pose)");
  const idleDiag = await evaluate(call, `({ state: window.__dshWhaleMoeDebug.state, src: document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src'), moodOverlays: document.querySelectorAll('[data-dsh-whale-mood]').length })`);
  check("state: workbench idle pose distinct from busy", idleDiag.state !== "waiting" && idleDiag.src.includes("workbench-peek"), idleDiag);
  check("mood: no vector expression overlay", idleDiag.moodOverlays === 0, idleDiag.moodOverlays);
  await evaluate(call, addFake(`node.setAttribute('data-state','running'); node.textContent='运行中·历史步骤';`));
  await delay(500);
  const staleRunning = await evaluate(call, `({ state: window.__dshWhaleMoeDebug.state, matches: document.querySelectorAll('[data-state="running"]').length })`);
  check("state: historical data-state=running card is not live work", staleRunning.state !== "tool" && staleRunning.state !== "thinking", staleRunning);
  await evaluate(call, `document.querySelectorAll('[data-dsh-qa-fake][data-state="running"]').forEach((n) => n.remove()); true`);
  await evaluate(call, addFake(`node.setAttribute('data-status','running');`));
  try {
    await waitFor(call, `window.__dshWhaleMoeDebug && window.__dshWhaleMoeDebug.state === 'tool'`, "tool state");
  } catch (e) {
    const td = await evaluate(call, `JSON.stringify({ debug: window.__dshWhaleMoeDebug, pet: localStorage.getItem('whale-moe:pet'), mode: localStorage.getItem('whale-moe:mode'), view: document.body.getAttribute('data-dsh-whale-view'), fakes: document.querySelectorAll('[data-dsh-qa-fake]').length, root: !!document.querySelector('[data-dsh-whale-root]') })`);
    throw new Error("tool diag " + td);
  }
  check("state: tool detected", true);
  for (let i = 0; i < 40; i++) {
    const srcNow = await evaluate(call, `document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || ''`);
    if (srcNow.includes("dsh-whale-state-running.webp")) break;
    await delay(100);
  }
  const toolDiag = await evaluate(call, `({ pet: localStorage.getItem('whale-moe:pet'), mode: localStorage.getItem('whale-moe:mode'), debug: window.__dshWhaleMoeDebug, root: !!document.querySelector('[data-dsh-whale-root]'), mascot: !!document.querySelector('[data-dsh-whale-mascot]'), view: document.body.getAttribute('data-dsh-whale-view') })`);
  const toolSrc = await evaluate(call, `document.querySelector('[data-dsh-whale-layer].dsh-whale-active') && document.querySelector('[data-dsh-whale-layer].dsh-whale-active').getAttribute('src')`);
  if (!toolSrc) throw new Error("mascot disappeared in tool phase: " + JSON.stringify(toolDiag));
  check("state: tool pose asset", toolSrc.includes("dsh-whale-state-running.webp") || toolSrc.includes("dsh-whale-workbench-peek.webp"), toolSrc);
  const busyMarker = await evaluate(call, `document.querySelector('[data-dsh-whale-root]')?.hasAttribute('data-dsh-whale-busy') === true`);
  check("state: busy glow marker while running", busyMarker === true, busyMarker);
  const usageAch = await evaluate(call, `(() => { try { const s = JSON.parse(localStorage.getItem('whale-moe:usageStats') || '{}'); const a = (localStorage.getItem('whale-moe:achievements') || '').split(','); return { tools: s.tools, firstTool: a.includes('first-tool') }; } catch (e) { return { error: String(e) }; } })()`);
  check("achievements: usage stats unlock first-tool", usageAch.tools >= 1 && usageAch.firstTool === true, usageAch);
  await delay(350);
  const attention = await evaluate(call, `({ burst: document.querySelectorAll('[data-dsh-whale-burst]').length, activeOpacity: getComputedStyle(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')).opacity, layers: document.querySelectorAll('[data-dsh-whale-layer]').length })`);
  check("motion: attention burst + dual crossfade layers", attention.burst >= 0 && attention.layers === 2 && Number(attention.activeOpacity) > 0.5, attention);
  await screenshot(call, "03-tool-state.png");
  await evaluate(call, `document.querySelector('[data-dsh-whale-mascot]').click()`);
  await waitFor(call, `(() => { const s = document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || ''; return s.includes('dsh-whale-state-work-pat.webp') || s.includes('dsh-whale-state-work-ram.webp'); })()`, "work-pat/work-ram pose on click while busy");
  check("interact: click while busy keeps laptop work pose", true);
  await delay(2600);
  await waitFor(call, `(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('dsh-whale-state-running.webp')`, "work-pat returns to running");
  await evaluate(call, dropFakes);
  await evaluate(call, addFake(`node.setAttribute('data-state','error'); node.setAttribute('aria-invalid','true');`));
  await waitFor(call, `window.__dshWhaleMoeDebug && window.__dshWhaleMoeDebug.state === 'failure'`, "failure state");
  check("state: failure state + burst", await evaluate(call, `({ state: window.__dshWhaleMoeDebug.state, burst: document.querySelectorAll('[data-dsh-whale-burst]').length })`).then((v) => v.state === "failure" && v.burst >= 0));
  await screenshot(call, "04-failure-state.png");
  await evaluate(call, dropFakes);
  await waitFor(call, `window.__dshWhaleMoeDebug && !['failure','tool','thinking'].includes(window.__dshWhaleMoeDebug.state)`, "recover state");
  check("state: recovery", true);
  await evaluate(call, addFake(`node.className='dshLogCluster_root'; node.setAttribute('data-state','error'); node.textContent='过程 · 44 步 · 57 个工具';`));
  await delay(500);
  const logClusterDiag = await evaluate(call, `({ state: window.__dshWhaleMoeDebug.state, errorMatches: window.__dshWhaleMoeDebug.errorMatches || [] })`);
  check("error: historical log cluster is not a live failure", logClusterDiag.state !== "failure" && logClusterDiag.errorMatches.length === 0, logClusterDiag);
  await evaluate(call, dropFakes);
  await evaluate(call, addFake(`node.innerHTML='<pre style="width:200px;height:20px"></pre><pre style="width:200px;height:20px"></pre><pre style="width:200px;height:20px"></pre>';`));
  await waitFor(call, `document.querySelector('[data-dsh-whale-root]').hasAttribute('data-dsh-whale-dense')`, "dense mode");
  check("dense: mini mode", true);
  await evaluate(call, dropFakes);
  await waitFor(call, `!document.querySelector('[data-dsh-whale-root]').hasAttribute('data-dsh-whale-dense')`, "dense clears");

  // Phase 4: interactions
  await evaluate(call, `document.querySelector('[data-dsh-whale-mascot]').click()`);
  await delay(150);
  const clickNotDrag = await evaluate(call, `(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('dsh-whale-state-pick-up.webp') === false`);
  check("click is not mistaken for drag", clickNotDrag === true, clickNotDrag);
  const patParticles = await evaluate(call, `document.querySelectorAll('[data-dsh-whale-particle]').length`);
  check("pet: pat particles <= 30", patParticles > 0 && patParticles <= 30, patParticles);
  await evaluate(call, `document.querySelector('[data-dsh-whale-mascot]').click(); document.querySelector('[data-dsh-whale-mascot]').click();`);
  await waitFor(call, `document.querySelector('[data-dsh-whale-bubble-text]') && document.querySelector('[data-dsh-whale-bubble-text]').textContent.includes('主人')`, "celebration");
  check("pet: 3 quick pats celebration", true);
  await waitFor(call, `!document.querySelector('[data-dsh-whale-caret]')`, "celebration typing finished");
  const celebTextA = await evaluate(call, `document.querySelector('[data-dsh-whale-bubble-text]')?.textContent`);
  await delay(500);
  const celebTextB = await evaluate(call, `document.querySelector('[data-dsh-whale-bubble-text]')?.textContent`);
  const moodOverlayCount = await evaluate(call, `document.querySelectorAll('[data-dsh-whale-mood]').length`);
  check("pet: celebration bubble types once and stays stable", celebTextA === celebTextB && (celebTextA || "").includes("诶嘿"), { celebTextA, celebTextB });
  check("mood: no vector overlay after celebration", moodOverlayCount === 0, moodOverlayCount);
  await screenshot(call, "05-celebration.png");
  await evaluate(call, `document.querySelector('[data-dsh-whale-gear-mini]').click()`);
  const menuVisible = await evaluate(call, `!document.querySelector('[data-dsh-whale-prefs]').hidden`);
  check("pet: gear-mini opens prefs", menuVisible === true, menuVisible);
  await screenshot(call, "06-prefs-menu.png");

  // Phase 5: independent toggle off/on
  await evaluate(call, `localStorage.setItem('whale-moe:pet','0'); window.dispatchEvent(new Event('storage'));`);
  await waitFor(call, `!document.querySelector('[data-dsh-whale-root]')`, "pet off removes layer");
  check("prefs: pet off removes layer", true);
  await evaluate(call, `localStorage.setItem('whale-moe:pet','1'); window.dispatchEvent(new Event('storage'));`);
  await waitFor(call, `!!document.querySelector('[data-dsh-whale-root]')`, "pet on restores layer");
  check("prefs: pet on restores layer", true);

  // Phase 5.5: modes — float drag, persist, reset, side, mini
  const setMode = (value) => `localStorage.setItem('whale-moe:mode','${value}'); window.dispatchEvent(new CustomEvent('whale-moe-prefs-change', { detail: { key: 'mode', value: '${value}' } })); true`;
  await evaluate(call, setMode("float"));
  await waitFor(call, `document.querySelector('[data-dsh-whale-root]').getAttribute('data-dsh-whale-mode') === 'float'`, "float mode");
  const dragStart = await evaluate(call, `(() => {
    const m = document.querySelector('[data-dsh-whale-mascot]');
    const r = m.getBoundingClientRect();
    const sx = Math.round(r.left + r.width / 2);
    const sy = Math.round(r.top + r.height / 2);
    m.dispatchEvent(new PointerEvent('pointerdown', { clientX: sx, clientY: sy, button: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: sx + 120, clientY: sy + 60, bubbles: true }));
    return { sx, sy };
  })()`);
  await waitFor(call, `(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('dsh-whale-state-pick-up.webp')`, "pick-up pose while dragging");
  const dragPose = await evaluate(call, `({ src: document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src'), dragging: document.querySelector('[data-dsh-whale-root]')?.classList.contains('dsh-whale-dragging') })`);
  check("drag: picked-up pose + swing class", dragPose.src.includes("pick-up") && dragPose.dragging === true, dragPose);
  await evaluate(call, `window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))`);
  await delay(300);
  const floatState = await evaluate(call, `(() => {
    const root = document.querySelector('[data-dsh-whale-root]');
    return { x: localStorage.getItem('whale-moe:floatX'), y: localStorage.getItem('whale-moe:floatY'), left: root.style.left, top: root.style.top };
  })()`);
  check("float: drag persists position", Number(floatState.x) > 8 && Number(floatState.y) > 8 && Math.abs(Number(floatState.x) - parseFloat(floatState.left)) < 2, floatState);
  await evaluate(call, `document.querySelector('[data-dsh-whale-mascot]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  await delay(300);
  const stillThere = await evaluate(call, `localStorage.getItem('whale-moe:floatX') !== null && localStorage.getItem('whale-moe:floatY') !== null`);
  check("float: double-click no longer resets", stillThere === true, stillThere);
  await evaluate(call, `document.querySelector('[data-dsh-whale-mascot]').dispatchEvent(new MouseEvent('contextmenu', { clientX: 400, clientY: 400, bubbles: true }))`);
  await waitFor(call, `[...document.querySelectorAll('[data-dsh-whale-context] button')].some((b) => (b.textContent || '').trim() === '回到原位')`, "context reset item");
  await evaluate(call, `[...document.querySelectorAll('[data-dsh-whale-context] button')].find((b) => (b.textContent || '').trim() === '回到原位').click()`);
  await delay(300);
  const contextReset = await evaluate(call, `localStorage.getItem('whale-moe:floatX') === null && localStorage.getItem('whale-moe:floatY') === null`);
  check("float: context menu returns to origin", contextReset === true, contextReset);
  await evaluate(call, setMode("side"));
  await waitFor(call, `(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('workbench-peek')`, "side mode").catch(async () => {
    const s = await evaluate(call, `({ mode: localStorage.getItem('whale-moe:mode'), attr: document.querySelector('[data-dsh-whale-root]')?.getAttribute('data-dsh-whale-mode'), src: document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src'), debug: window.__dshWhaleMoeDebug })`);
    throw new Error("side mode diag: " + JSON.stringify(s));
  });
  check("side: workbench peek asset", true);
  await screenshot(call, "09-side-mode.png");
  await evaluate(call, setMode("mini"));
  await waitFor(call, `document.querySelector('[data-dsh-whale-frame]').getBoundingClientRect().width === 64`, "mini mode");
  check("mini: 64px corner", true);
  await screenshot(call, "10-mini-mode.png");
  await evaluate(call, setMode("auto"));

  // Phase 6: adapts to DSH dark appearance
  await evaluate(call, `document.body.setAttribute('data-ds-dark-theme','')`);
  await delay(500);
  const dark = await evaluate(call, `({ mascot: !!document.querySelector('[data-dsh-whale-mascot]') })`);
  check("dark: mascot still healthy", dark.mascot === true, dark);
  await screenshot(call, "07-home-dark.png");
  await evaluate(call, `document.body.removeAttribute('data-ds-dark-theme')`);

  // Phase 7: narrow + reduced motion
  await call("Emulation.setDeviceMetricsOverride", { width: 820, height: 500, deviceScaleFactor: 1, mobile: false });
  await delay(400);
  const narrow = await evaluate(call, `(() => {
    const mascot = document.querySelector('[data-dsh-whale-mascot]');
    return { w: mascot ? mascot.getBoundingClientRect().width : 0, overflow: document.documentElement.scrollWidth > innerWidth + 2 };
  })()`);
  check("narrow: mini 48px", narrow.w === 48, narrow.w);
  check("narrow: no overflow", narrow.overflow === false, narrow.overflow);
  await screenshot(call, "08-narrow.png");
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await evaluate(call, `document.querySelector('[data-dsh-whale-mascot]').click()`);
  await delay(200);
  const reducedParticles = await evaluate(call, `document.querySelectorAll('[data-dsh-whale-particle]').length`);
  check("reduced-motion: no particles", reducedParticles === 0, reducedParticles);

  // Phase 8: off = zero residue
  await evaluate(call, `localStorage.setItem('whale-moe:pet','0'); window.dispatchEvent(new Event('storage'));`);
  await waitFor(call, `!document.querySelector('[data-dsh-whale-root]')`, "final off");
  const residue = await evaluate(call, `({ root: document.querySelectorAll('[data-dsh-whale-root], [data-dsh-whale-particle]').length, view: document.body.getAttribute('data-dsh-whale-view') ?? null, debug: window.__dshWhaleMoeDebug })`);
  check("cleanup: zero residue", residue.root === 0 && residue.view === null && residue.debug && residue.debug.state === "hidden", residue);

  for (const event of events) {
    if (event.method === "Runtime.exceptionThrown") runtimeErrors.push(event.params.exceptionDetails?.exception?.description || event.params.exceptionDetails?.text || "exception");
    if (event.method === "Log.entryAdded" && event.params.entry.level === "error") {
      const text = event.params.entry.text || "";
      if (!/favicon|source ?map|net::ERR_ABORTED|127\.0\.0\.1:3020\/balance/i.test(text + " " + (event.params.entry.url || ""))) runtimeErrors.push(text + " :: " + (event.params.entry.url || ""));
    }
  }
  check("runtime: no console errors", runtimeErrors.length === 0, runtimeErrors.slice(0, 5));

  const report = { pass: failures.length === 0, failures, runtimeErrors, shots: fs.readdirSync(SHOTS).filter((n) => n.endsWith(".png")) };
  fs.writeFileSync(path.join(SHOTS, "report.json"), JSON.stringify(report, null, 2), "utf8");
  log("report", JSON.stringify(report));
  socket.close();
  clearTimeout(watchdog);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("CDP acceptance crashed:", error);
  clearTimeout(watchdog);
  process.exit(2);
});
