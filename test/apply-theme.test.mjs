import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { patchHost, patchClient, patchIndexHtml, unpatchHost, unpatchClient, patchMascotClient, apply, untheme, mascotSettings, rollback } from "../scripts/apply-theme.mjs";

const HOST_BASE = 'const STYLE_PACKS = [\n\t"default",\n\t"whale-maid"\n];';
const CLIENT_BASE = 'children: [(0, react_jsx_runtime.jsx)("option", { value: "default", children: "默认" }), (0, react_jsx_runtime.jsx)("option", { value: "whale-maid", children: "鲸汐侍礼（鲸鱼娘）" })]';
const HTML_BASE = '  <head>\n    <link rel="stylesheet" crossorigin href="/assets/index-X.css">\n    <!-- DSH-VICTORIAN-THEME v3 -->\n    <link rel="stylesheet" crossorigin href="/assets/dsh-victorian-theme.css">\n    <script src="/assets/dsh-victorian-theme.js"></script>\n  </head>';

test("patchHost adds whale-moe exactly once and is idempotent", () => {
  const first = patchHost(HOST_BASE);
  assert.equal(first.changed, true);
  assert.ok(first.source.includes('\t"whale-moe"'));
  assert.equal((first.source.match(/"whale-moe"/g) || []).length, 1);
  assert.equal((first.source.match(/"whale-maid"/g) || []).length, 1);
  const second = patchHost(first.source);
  assert.equal(second.changed, false);
  assert.equal(second.source, first.source);
});

test("patchHost tolerates an existing third pack after whale-maid", () => {
  const extended = 'const STYLE_PACKS = [\n\t"default",\n\t"whale-maid",\n\t"other"\n];';
  const out = patchHost(extended);
  assert.equal(out.changed, true);
  assert.ok(out.source.includes('\t"whale-maid",\n\t"whale-moe",\n\t"other"'));
});

test("patchClient appends the option after the whale-maid option and is idempotent", () => {
  const first = patchClient(CLIENT_BASE);
  assert.equal(first.changed, true);
  assert.ok(first.source.includes('{ value: "whale-moe", children: "鲸鱼娘·海洋甜点工房" }'));
  assert.equal((first.source.match(/value: "whale-moe"/g) || []).length, 1);
  const second = patchClient(first.source);
  assert.equal(second.changed, false);
});

test("patchIndexHtml injects css and two scripts after the victorian script and is idempotent", () => {
  const first = patchIndexHtml(HTML_BASE);
  assert.equal(first.changed, true);
  assert.ok(first.source.includes("<!-- DSH-WHALE-MOE-THEME v1 -->"));
  assert.ok(first.source.includes('href="/assets/dsh-whale-moe.css"'));
  assert.ok(first.source.includes('src="/assets/whale-moe-core.js"'));
  assert.ok(first.source.includes('src="/assets/dsh-whale-moe.js"'));
  const second = patchIndexHtml(first.source);
  assert.equal(second.changed, false);
});

test("patch functions fail loudly on missing anchors", () => {
  assert.throws(() => patchHost("no anchors here"), /anchor not found/);
  assert.throws(() => patchClient("no anchors here"), /anchor not found/);
  assert.throws(() => patchIndexHtml("no anchors here"), /anchor not found/);
});

test("apply + rollback round-trip on a fixture install", () => {
  const ext = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-whale-moe-"));
  try {
    const target = path.join(tmp, "install");
    const clientDir = path.join(target, "node_modules/@deepseek-ai/dsh-client-ui-theme/lib");
    const hostDir = clientDir;
    const webDir = path.join(target, "node_modules/@deepseek-ai/dsh-web-frontend/dist");
    fs.mkdirSync(clientDir, { recursive: true });
    fs.mkdirSync(path.join(webDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(clientDir, "client.js"), CLIENT_BASE, "utf8");
    fs.writeFileSync(path.join(hostDir, "index.js"), HOST_BASE, "utf8");
    fs.writeFileSync(path.join(webDir, "index.html"), HTML_BASE, "utf8");
    const before = {
      client: fs.readFileSync(path.join(clientDir, "client.js"), "utf8"),
      host: fs.readFileSync(path.join(hostDir, "index.js"), "utf8"),
      html: fs.readFileSync(path.join(webDir, "index.html"), "utf8")
    };
    const backupRoot = path.join(tmp, "backups");
    fs.mkdirSync(backupRoot, { recursive: true });
    const backupDir = apply(target, { backupRoot });
    assert.ok(fs.existsSync(path.join(backupDir, "manifest.json")));
    assert.ok(fs.existsSync(path.join(webDir, "assets", "dsh-whale-moe.css")));
    assert.ok(!fs.readFileSync(path.join(clientDir, "client.js"), "utf8").includes("whale-moe"));
    assert.ok(fs.readFileSync(path.join(webDir, "index.html"), "utf8").includes("dsh-whale-moe.js"));
    assert.equal(apply(target, { backupRoot }), "already");
    rollback(backupDir);
    assert.equal(fs.readFileSync(path.join(clientDir, "client.js"), "utf8"), before.client);
    assert.equal(fs.readFileSync(path.join(hostDir, "index.js"), "utf8"), before.host);
    assert.equal(fs.readFileSync(path.join(webDir, "index.html"), "utf8"), before.html);
    assert.equal(fs.existsSync(path.join(webDir, "assets", "dsh-whale-moe.css")), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("patchClient accepts the migrated victorian label anchor", () => {
  const migrated = 'children: [(0, react_jsx_runtime.jsx)("option", { value: "default", children: "默认" }), (0, react_jsx_runtime.jsx)("option", { value: "whale-maid", children: "维多利亚航海书房" })]';
  const out = patchClient(migrated);
  assert.equal(out.changed, true);
  assert.ok(out.source.includes('value: "whale-moe"'));
});

test("patchIndexHtml falls back to </head> when the victorian anchor is absent", () => {
  const minimal = '  <head>\n    <link rel="stylesheet" crossorigin href="/assets/index-X.css">\n  </head>';
  const out = patchIndexHtml(minimal);
  assert.equal(out.changed, true);
  assert.ok(out.source.includes("<!-- DSH-WHALE-MOE-THEME v1 -->"));
  assert.ok(out.source.includes('href="/assets/dsh-whale-moe.css"'));
  assert.ok(out.source.indexOf("DSH-WHALE-MOE-THEME") < out.source.indexOf("</head>"));
});

test("patchIndexHtml rejects a duplicated victorian anchor", () => {
  const dup = HTML_BASE.replace('<script src="/assets/dsh-victorian-theme.js"></script>', '<script src="/assets/dsh-victorian-theme.js"></script>\n    <script src="/assets/dsh-victorian-theme.js"></script>');
  assert.throws(() => patchIndexHtml(dup), /anchor not unique/);
});

test("apply→rollback→apply sequence keeps every step idempotent", () => {
  const ext = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-whale-moe-"));
  try {
    const target = path.join(tmp, "install");
    const clientDir = path.join(target, "node_modules/@deepseek-ai/dsh-client-ui-theme/lib");
    const webDir = path.join(target, "node_modules/@deepseek-ai/dsh-web-frontend/dist");
    fs.mkdirSync(clientDir, { recursive: true });
    fs.mkdirSync(path.join(webDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(clientDir, "client.js"), CLIENT_BASE, "utf8");
    fs.writeFileSync(path.join(clientDir, "index.js"), HOST_BASE, "utf8");
    fs.writeFileSync(path.join(webDir, "index.html"), HTML_BASE, "utf8");
    const backupRoot = path.join(tmp, "backups");
    fs.mkdirSync(backupRoot, { recursive: true });
    const first = apply(target, { backupRoot });
    rollback(first);
    assert.ok(!fs.readFileSync(path.join(clientDir, "client.js"), "utf8").includes("whale-moe"));
    const second = apply(target, { backupRoot });
    assert.ok(!fs.readFileSync(path.join(clientDir, "client.js"), "utf8").includes("whale-moe"));
    assert.ok(fs.readFileSync(path.join(webDir, "index.html"), "utf8").includes("dsh-whale-moe.js"));
    assert.equal(apply(target, { backupRoot }), "already");
    rollback(second);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("unpatchClient/unpatchHost remove the theme entry and are idempotent", () => {
  const patchedClient = patchClient(CLIENT_BASE).source;
  const outClient = unpatchClient(patchedClient);
  assert.equal(outClient.changed, true);
  assert.equal(outClient.source, CLIENT_BASE);
  assert.equal(unpatchClient(outClient.source).changed, false);

  const patchedHost = patchHost(HOST_BASE).source;
  const outHost = unpatchHost(patchedHost);
  assert.equal(outHost.changed, true);
  assert.equal(outHost.source, HOST_BASE);
  assert.equal(unpatchHost(outHost.source).changed, false);
});

test("untheme round-trip removes only the option/whitelist and keeps assets", () => {
  const ext = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-whale-moe-"));
  try {
    const target = path.join(tmp, "install");
    const clientDir = path.join(target, "node_modules/@deepseek-ai/dsh-client-ui-theme/lib");
    const webDir = path.join(target, "node_modules/@deepseek-ai/dsh-web-frontend/dist");
    fs.mkdirSync(clientDir, { recursive: true });
    fs.mkdirSync(path.join(webDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(clientDir, "client.js"), CLIENT_BASE, "utf8");
    fs.writeFileSync(path.join(clientDir, "index.js"), HOST_BASE, "utf8");
    fs.writeFileSync(path.join(webDir, "index.html"), HTML_BASE, "utf8");
    const backupRoot = path.join(tmp, "backups");
    fs.mkdirSync(backupRoot, { recursive: true });
    const applied = apply(target, { backupRoot });
    fs.writeFileSync(path.join(clientDir, "client.js"), patchClient(CLIENT_BASE).source, "utf8");
    fs.writeFileSync(path.join(clientDir, "index.js"), patchHost(HOST_BASE).source, "utf8");
    const clientPatched = fs.readFileSync(path.join(clientDir, "client.js"), "utf8");
    const unthemed = untheme(target, { backupRoot });
    assert.ok(!fs.readFileSync(path.join(clientDir, "client.js"), "utf8").includes("whale-moe"));
    assert.ok(!fs.readFileSync(path.join(clientDir, "index.js"), "utf8").includes("whale-moe"));
    assert.ok(fs.existsSync(path.join(webDir, "assets", "dsh-whale-moe.css")));
    assert.equal(untheme(target, { backupRoot }), "already");
    rollback(unthemed);
    assert.equal(fs.readFileSync(path.join(clientDir, "client.js"), "utf8"), clientPatched);
    rollback(applied);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("patchMascotClient adds the mascot settings section and is idempotent", () => {
  const fixture = 'const store = 1;\nconst injected = (a) => a;\nctx.slots.inject("settings.theme.item", () => ctx.slots.register({}, ThemePackRow));';
  const out = patchMascotClient(fixture);
  assert.equal(out.changed, true);
  assert.ok(out.source.includes("/* DSH-WHALE-MOE:MASCOT-SETTINGS v27 */"));
  assert.ok(out.source.includes('id: "mascot"'));
  assert.ok(out.source.includes('label: "看板娘"'));
  assert.ok(out.source.includes('label: "鲸鱼娘"'));
  assert.ok(!out.source.includes('MascotModeRow'));
  assert.ok(!out.source.includes('悬浮（可拖拽）'));
  assert.ok(out.source.includes('重置到默认位置'));
  assert.ok(out.source.includes('重置养成'));
  assert.ok(!out.source.includes('装饰衣柜'));
  assert.ok(out.source.includes('如何称呼我'));
  assert.ok(out.source.includes('关键词感知'));
  assert.ok(out.source.includes('天气城市'));
  assert.ok(out.source.includes('API Key（选填）'));
  assert.ok(out.source.includes('测试连接'));
  assert.ok(out.source.includes('留空不联网'));
  assert.ok(out.source.includes('陪伴'));
  assert.ok(out.source.includes('成就墙'));
  assert.ok(out.source.includes('余额告急'));
  assert.ok(out.source.includes('工具百连'));
  assert.ok(out.source.includes('MASCOT_CARD_STYLE'));
  assert.ok(out.source.includes('label: "小游戏"') && out.source.includes('prefKey: "game"'));
  assert.ok(out.source.includes('label: "天气特效"') && out.source.includes('prefKey: "weatherFx"'));
  assert.ok(out.source.includes('MascotDailyQuests') && out.source.includes('MascotWeekSignin') && out.source.includes('MascotBadgeRow'));
  assert.ok(out.source.includes('title: "陪伴表现"') && out.source.includes('title: "天气"') && out.source.includes('title: "日常与养成"') && out.source.includes('title: "成就墙"') && out.source.includes('title: "数据与重置"'));
  assert.ok(out.source.includes('function MascotOverviewCard') && out.source.includes('function MascotSwitchGrid'));
  assert.ok(out.source.includes('margin: "10px auto 0", padding: "8px 14px", width: "95%"'));
  assert.ok(out.source.includes('label: "今日任务"') && out.source.includes('label: "本周签到"') && out.source.includes('label: "称号"'));
  assert.ok(out.source.includes('function MascotAccordion') && out.source.includes('function MascotTabs') && out.source.includes('function MascotDailyCard'));
  assert.ok(out.source.includes('borderRadius: "999px"') && out.source.includes('mascotReact.useState'));
  assert.ok(out.source.includes('"whale-moe-prefs-change"'));
  const second = patchMascotClient(out.source);
  assert.equal(second.changed, false);
});

test("patchMascotClient upgrades legacy v1-v26 blocks to v27", () => {
  const fixture = 'const store = 1;\nconst injected = (a) => a;\nctx.slots.inject("settings.theme.item", () => ctx.slots.register({}, ThemePackRow));';
  const legacy = patchMascotClient(fixture).source.replace("DSH-WHALE-MOE:MASCOT-SETTINGS v27", "DSH-WHALE-MOE:MASCOT-SETTINGS v4");
  const upgraded = patchMascotClient(legacy);
  assert.equal(upgraded.changed, true);
  assert.ok(upgraded.source.includes("DSH-WHALE-MOE:MASCOT-SETTINGS v27"));
  assert.ok(!upgraded.source.includes("DSH-WHALE-MOE:MASCOT-SETTINGS v4"));
  assert.equal((upgraded.source.match(/id: "mascot"/g) || []).length, 1);
});

test("mascotSettings round-trip writes only client.js and restores it", () => {
  const ext = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-whale-moe-"));
  try {
    const target = path.join(tmp, "install");
    const clientDir = path.join(target, "node_modules/@deepseek-ai/dsh-client-ui-theme/lib");
    fs.mkdirSync(clientDir, { recursive: true });
    const fixture = 'const store = 1;\nconst injected = (a) => a;\nctx.slots.inject("settings.theme.item", () => ctx.slots.register({}, ThemePackRow));';
    fs.writeFileSync(path.join(clientDir, "client.js"), fixture, "utf8");
    const backupRoot = path.join(tmp, "backups");
    fs.mkdirSync(backupRoot, { recursive: true });
    const dir = mascotSettings(target, { backupRoot });
    assert.ok(fs.readFileSync(path.join(clientDir, "client.js"), "utf8").includes("MASCOT-SETTINGS"));
    assert.equal(mascotSettings(target, { backupRoot }), "already");
    rollback(dir);
    assert.equal(fs.readFileSync(path.join(clientDir, "client.js"), "utf8"), fixture);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
