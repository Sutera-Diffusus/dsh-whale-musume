import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = fs.readFileSync(path.join(root, "lib/client.js"), "utf8");
const presenter = fs.readFileSync(path.join(root, "assets/dsh-whale-moe.js"), "utf8");

test("MiMo TTS bridge is optional and cleans up its event listener", () => {
  assert.match(client, /ctx\.effect\(\(\) => \{/);
  assert.match(client, /ctx\.get\("xiaomiMimoTts"\)/);
  assert.match(client, /const MIMO_TTS_EVENT = "dsh-whale-musume:interaction-line"/);
  assert.match(client, /window\.addEventListener\(MIMO_TTS_EVENT, playInteractionLine\)/);
  assert.match(client, /window\.removeEventListener\(MIMO_TTS_EVENT, playInteractionLine\)/);
  assert.match(client, /MascotValue\("mimoTts", "0"\) !== "0"/);
  assert.match(client, /tts\.play\(text\)/);
  assert.doesNotMatch(client, /inject:\s*\[[^\]]*xiaomiMimoTts/);
  assert.doesNotMatch(client, /from\s+["']dsh-xiaomi-tts/);
});

test("MiMo TTS setting is conditional and defaults to off", () => {
  assert.match(client, /function hasMimoTts\(ctx\)/);
  assert.match(client, /mimoTtsAvailable \? \[\{ label: "台词播报 \(MiMoTTs\)", prefKey: "mimoTts" }\] : \[\]/);
  assert.match(client, /defaultOff = prefKey === "mimoTts"/);
});

test("only approved interaction paths emit localized MiMo TTS lines", () => {
  assert.match(presenter, /var MIMO_TTS_EVENT = "dsh-whale-musume:interaction-line"/);
  assert.match(presenter, /function showInteractionLine\(line\)[\s\S]*?showLine\(line\);[\s\S]*?emitInteractionLine\(localizeLine\(line\)\)/);
  assert.match(presenter, /function bellyReact[\s\S]*?showInteractionLine\(line\)/);
  assert.match(presenter, /function tailReact[\s\S]*?showInteractionLine\(line\)/);
  assert.match(presenter, /var patLine = say\("interact", "pat"\);[\s\S]*?showInteractionLine\(patLine\)/);
  assert.match(presenter, /readPref\("chat"\)\) emitInteractionLine\(localizeLine\("诶嘿～最喜欢主人啦！"\)\)/);
});
