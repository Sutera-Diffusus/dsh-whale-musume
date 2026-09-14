import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(rootDir, "assets", "dsh-whale-moe.js"), "utf8");

function extractFunction(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`\n  function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `could not extract ${name}`);
  return source.slice(start, end).trim();
}

test("isVisible rejects fully off-screen drawers but keeps partial intersections", () => {
  const fn = extractFunction("isVisible", "firstVisible");
  const isVisible = new Function("root", `return (${fn});`)({ innerWidth: 1000, innerHeight: 800 });
  const node = (rect) => ({
    getBoundingClientRect: () => rect,
    ownerDocument: { defaultView: { getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }) } }
  });

  assert.equal(isVisible(node({ left: 1001, right: 1101, top: 20, bottom: 120, width: 100, height: 100 })), false);
  assert.equal(isVisible(node({ left: 950, right: 1050, top: 20, bottom: 120, width: 100, height: 100 })), true);
});

test("settings and dialog contexts use a visible 120px corner mascot", () => {
  const fn = extractFunction("resolveLayout", "clamp");
  const resolveLayout = new Function("root", "statePose", "ASSET_ROOT", `return (${fn});`)(
    { innerWidth: 1000, innerHeight: 800 },
    () => "idle-cute",
    "/assets/"
  );

  assert.deepEqual(resolveLayout("settings", { state: "idle" }), {
    hidden: false,
    kind: "mini",
    w: 120,
    h: 120,
    src: "/assets/dsh-whale-state-idle-cute.webp",
    x: 864,
    y: 664
  });
});
