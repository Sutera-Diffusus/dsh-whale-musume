import { patchMascotClient } from "../scripts/apply-theme.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const fixture = 'const store = 1;\nconst injected = (a) => a;\nctx.slots.inject("settings.theme.item", () => ctx.slots.register({}, ThemePackRow));';
const out = patchMascotClient(fixture);
if (!out.changed) throw new Error("patch did not apply");
const file = path.join(os.tmpdir(), "mascot-client-check.js");
fs.writeFileSync(file, out.source, "utf8");
console.log(file);
