import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");
const outputDir = path.join(projectDir, "dist-build");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
const version = packageJson.version;
const targets = process.argv.slice(2);
const requireSigning = process.env.MARKLENS_REQUIRE_SIGNING === "1";

if (!targets.length) targets.push("nsis", "zip");

const requiredRuntimeFiles = [
  "MarkLens.exe",
  "resources/app.asar",
  "libEGL.dll",
  "libGLESv2.dll",
  "vk_swiftshader.dll",
  "vk_swiftshader_icd.json"
];

for (const relativePath of requiredRuntimeFiles) {
  const fullPath = path.join(outputDir, "win-unpacked", relativePath);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
    throw new Error(`Missing required Windows runtime file: ${relativePath}`);
  }
}

const artifactNames = {
  nsis: `MarkLens-Setup-${version}-x64.exe`,
  portable: `MarkLens-${version}-x64-portable.exe`,
  zip: `MarkLens-${version}-x64.zip`,
  msi: `MarkLens-Enterprise-${version}-x64.msi`
};

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function signatureStatus(filePath) {
  if (/\.msi$/i.test(filePath)) {
    const signatureStreamName = Buffer.from("\u0005DigitalSignature", "utf16le");
    return fs.readFileSync(filePath).includes(signatureStreamName) ? "Present" : "NotSigned";
  }
  if (!/\.exe$/i.test(filePath)) return "not-applicable";
  const handle = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(4096);
    const bytesRead = fs.readSync(handle, header, 0, header.length, 0);
    if (bytesRead < 256 || header.toString("ascii", 0, 2) !== "MZ") return "invalid-pe";
    const peOffset = header.readUInt32LE(0x3c);
    if (peOffset + 256 > bytesRead || header.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0") return "invalid-pe";
    const optionalHeader = peOffset + 24;
    const magic = header.readUInt16LE(optionalHeader);
    const dataDirectory = optionalHeader + (magic === 0x20b ? 112 : magic === 0x10b ? 96 : 0);
    if (dataDirectory === optionalHeader) return "invalid-pe";
    const certificateOffset = header.readUInt32LE(dataDirectory + 8 * 4);
    const certificateSize = header.readUInt32LE(dataDirectory + 8 * 4 + 4);
    return certificateOffset > 0 && certificateSize > 0 ? "Present" : "NotSigned";
  } finally {
    fs.closeSync(handle);
  }
}

function findFile(root, fileName, depth = 0) {
  if (!root || depth > 5 || !fs.existsSync(root)) return null;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) return fullPath;
    if (entry.isDirectory()) {
      const found = findFile(fullPath, fileName, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const artifacts = targets.map((target) => {
  const name = artifactNames[target];
  if (!name) throw new Error(`Unsupported verification target: ${target}`);
  const filePath = path.join(outputDir, name);
  if (!fs.existsSync(filePath)) throw new Error(`Missing build artifact: ${name}`);
  const stat = fs.statSync(filePath);
  if (stat.size < 10 * 1024 * 1024) throw new Error(`Build artifact is unexpectedly small: ${name}`);
  const signature = signatureStatus(filePath);
  if (requireSigning && signature !== "Present" && signature !== "not-applicable") {
    throw new Error(`Signing is required but ${name} has status: ${signature}`);
  }
  return { name, bytes: stat.size, sha256: sha256(filePath), signature };
});

let nsisArchive = null;
if (targets.includes("nsis")) {
  const cacheRoot = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "electron-builder", "Cache")
    : null;
  const sevenZip = findFile(cacheRoot, "7za.exe");
  if (!sevenZip) throw new Error("Unable to locate electron-builder's 7za.exe for NSIS verification");

  const installerPath = path.join(outputDir, artifactNames.nsis);
  const result = spawnSync(sevenZip, ["l", "-slt", installerPath], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Unable to inspect NSIS payload: ${result.stderr || result.stdout}`);
  const listing = result.stdout;
  const archiveMethod = listing.match(/^Method = (.+)$/m)?.[1]?.trim() ?? "unknown";
  if (/BCJ2/i.test(archiveMethod)) throw new Error(`Unsafe NSIS archive filter detected: ${archiveMethod}`);
  const missingPayloadFiles = requiredRuntimeFiles.filter((relativePath) => {
    const archivePath = relativePath.replace(/\//g, "\\");
    return !listing.includes(`Path = ${archivePath}\r\n`) && !listing.includes(`Path = ${archivePath}\n`);
  });
  if (missingPayloadFiles.length) {
    throw new Error(`NSIS payload is missing required files: ${missingPayloadFiles.join(", ")}`);
  }
  nsisArchive = { method: archiveMethod, verifiedWith: path.basename(sevenZip) };
}

const manifest = {
  product: packageJson.productName ?? "MarkLens",
  version,
  generatedAt: new Date().toISOString(),
  sevenZipFilter: "BCJ",
  nsisArchive,
  requiredRuntimeFiles,
  artifacts
};

fs.writeFileSync(path.join(outputDir, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.table(artifacts);

const unsigned = artifacts.filter((artifact) => artifact.signature === "NotSigned");
if (unsigned.length) {
  console.warn("WARNING: Windows executables are unsigned. Enterprise endpoints may block or deeply scan them.");
}
