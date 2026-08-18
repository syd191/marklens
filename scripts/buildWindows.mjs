import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");
const builderCli = path.join(projectDir, "node_modules", "electron-builder", "cli.js");
const targets = process.argv.slice(2);

if (!targets.length) targets.push("nsis", "zip");

// electron-builder 26.15.x can otherwise let 7-Zip choose BCJ2, while the
// embedded NSIS extractor only reliably decodes the single-stream BCJ filter.
const env = {
  ...process.env,
  ELECTRON_BUILDER_7Z_FILTER: "BCJ"
};

console.log(`Building Windows targets: ${targets.join(", ")} (7z filter: BCJ)`);
const result = spawnSync(
  process.execPath,
  [builderCli, "--win", ...targets, "--publish", "never", "--config", "electron-builder.json"],
  { cwd: projectDir, env, stdio: "inherit" }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
