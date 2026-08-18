// Seed the whale-moe copy home with the main's workspace registry, session ids stripped.
import fs from "node:fs";

const candidates = [
  "D:/DeepseekHarness_Data/.dsh/storages/workspace.json",
  "C:/Users/Suter/.dsh/storages/workspace.json",
];
const mainFile = candidates.find((f) => fs.existsSync(f));
if (!mainFile) throw new Error("no main workspace.json found");
const devDir = "D:/DeepseekHarness_WorkSpace/_dsh-copies/dsh-whale-moe-home/storages";
const devFile = devDir + "/workspace.json";
const main = JSON.parse(fs.readFileSync(mainFile, "utf8"));
for (const workspace of Object.values(main.tables?.workspaces ?? {})) workspace.sessionIds = [];
main.global.archivedSessionIds = [];
main.global.archivedAt = {};
fs.mkdirSync(devDir, { recursive: true });
fs.writeFileSync(devFile, JSON.stringify(main, null, 2) + "\n", "utf8");
console.log("seeded from", mainFile);
