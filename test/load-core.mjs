// Shared loader for the CJS-shaped whale-moe-core.js that works regardless of
// the package "type" field (the repo is "module" for the bundle form, while the
// browser loads the same file as a classic script).
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function loadCore() {
  const src = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "whale-moe-core.js"),
    "utf8"
  );
  const moduleShim = { exports: {} };
  // eslint-disable-next-line no-new-func
  const run = new Function("module", "exports", "window", src + "\n;");
  run(moduleShim, moduleShim.exports, undefined);
  if (!moduleShim.exports || Object.keys(moduleShim.exports).length === 0) {
    throw new Error("whale-moe-core.js produced no exports");
  }
  return moduleShim.exports;
}
