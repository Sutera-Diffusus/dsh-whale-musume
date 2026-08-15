// Full-pose showcase: triggers every available mascot pose in float mode,
// captures a crop of each, and saves a labeled contact sheet.
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9223";
const APP = "http://127.0.0.1:3181";
const SHOTS = "D:/DeepseekHarness_WorkSpace/_shots/dsh-whale-moe/showcase";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const POSES = [
  "idle-cute", "curious", "teasing", "wink", "greet", "bold",
  "running", "work-pat", "work-ram", "work-slack", "sweep", "cool-shades",
  "balance-low", "star", "blush", "angry", "eat", "celebrate",
  "sleep", "success", "failure", "abstract", "waiting", "night"
];

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const target = await (await fetch(`${CDP}/json/new?${APP}`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  let id = 0; const pend = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  });
  const call = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => (await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
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
  await ev(`localStorage.setItem('whale-moe:pet','1'); localStorage.setItem('whale-moe:chat','0'); localStorage.setItem('whale-moe:particles','0'); localStorage.setItem('whale-moe:mode','float'); window.dispatchEvent(new CustomEvent('whale-moe-prefs-change',{detail:{key:'mode',value:'float'}})); true`);
  await delay(1200);

  for (let i = 0; i < POSES.length; i += 1) {
    const pose = POSES[i];
    await ev(`window.DshWhaleMoeMood && window.DshWhaleMoeMood('${pose}', 8000)`);
    let ok = false;
    for (let t = 0; t < 30; t += 1) {
      if (await ev(`(document.querySelector('[data-dsh-whale-layer].dsh-whale-active')?.getAttribute('src') || '').includes('dsh-whale-state-${pose}.webp')`).catch(() => false)) { ok = true; break; }
      await delay(100);
    }
    if (!ok) console.log("POSE NOT SHOWN:", pose);
    await delay(450);
    const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(SHOTS, `${String(i).padStart(2, "0")}-${pose}.png`), Buffer.from(shot.data, "base64"));
    console.log("shot", pose);
  }
  ws.close();
  console.log("DONE");
}
main().catch((e) => { console.error(e); process.exit(2); });
