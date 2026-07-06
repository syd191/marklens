import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
const rcedit = path.join(projectDir, "node_modules", "rcedit", "bin", "rcedit-x64.exe");
const icon = path.join(projectDir, "assets", "icon.ico");
const outputsDir = path.resolve(projectDir, "..", "..", "outputs");
const targets = [path.join(outputsDir, "win-unpacked", "MarkLens.exe")];

for (const target of targets) {
  if (!fs.existsSync(target)) continue;

  const result = spawnSync(
    rcedit,
    [
      target,
      "--set-icon",
      icon,
      "--set-version-string",
      "FileDescription",
      "MarkLens Markdown Reader",
      "--set-version-string",
      "ProductName",
      "MarkLens",
      "--set-file-version",
      `${pkg.version}.0`,
      "--set-product-version",
      `${pkg.version}.0`
    ],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
