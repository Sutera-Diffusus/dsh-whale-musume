// calibrate-peek.mjs — measure alpha bounding boxes of peek sprites in a real browser.
import fs from "node:fs";
import path from "node:path";

const CDP = "http://127.0.0.1:9223";
const APP = "http://127.0.0.1:3181";
const OUT = "D:/DeepseekHarness_WorkSpace/dsh-whale-moe-theme-extension/assets/peek-calibration.json";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function newTarget(url) {
  const response = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`CDP new failed: ${response.status}`);
  return await response.json();
}
async function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { socket.addEventListener("open", res, { once: true }); socket.addEventListener("error", rej, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { const p = pending.get(message.id); pending.delete(message.id); message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result); }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const callId = ++id; pending.set(callId, { resolve, reject }); socket.send(JSON.stringify({ id: callId, method, params })); });
  return { socket, call };
}
async function evaluate(call, expression) {
  const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function main() {
  const target = await newTarget(APP);
  const { socket, call } = await connect(target);
  await call("Runtime.enable");
  const names = ["dsh-whale-home-peek.webp", "dsh-whale-workbench-peek.webp", "dsh-whale-settings-peek.webp"];
  const out = {};
  for (const name of names) {
    const result = await evaluate(call, `(async () => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = "/assets/generated/${name}";
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      return {
        w: canvas.width, h: canvas.height,
        bboxW: maxX >= minX ? maxX - minX + 1 : 0,
        bboxH: maxY >= minY ? maxY - minY + 1 : 0,
        padLeft: minX, padRight: canvas.width - maxX - 1,
        padTop: minY, padBottom: canvas.height - maxY - 1
      };
    })()`);
    out[name.replace("dsh-whale-", "").replace(".webp", "")] = result;
    console.log(name, JSON.stringify(result));
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
  console.log("CALIBRATION_WRITTEN", OUT);
  socket.close();
}
main().catch((e) => { console.error(e); process.exit(2); });