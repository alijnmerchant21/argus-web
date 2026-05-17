/**
 * Reads public/extension-base (compiled Chrome extension) and writes a JSON map
 * of relative path → base64 file contents. The server zips this at download time
 * without relying on filesystem paths that don't exist on Vercel serverless.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const srcDir = join(root, "public/extension-base");
const outFile = join(root, "src/lib/extension-zip-assets.generated.json");

function walk(dir, base, acc = {}) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(base, full).split("\\").join("/");
    if (statSync(full).isDirectory()) walk(full, base, acc);
    else acc[rel] = readFileSync(full).toString("base64");
  }
  return acc;
}

try {
  statSync(srcDir);
} catch {
  console.error("[embed-extension] Missing public/extension-base — run npm run ext:build:copy first.");
  process.exit(1);
}

const assets = walk(srcDir, srcDir);
if (!assets["manifest.json"]) {
  console.error("[embed-extension] public/extension-base has no manifest.json");
  process.exit(1);
}

mkdirSync(join(root, "src/lib"), { recursive: true });
writeFileSync(outFile, JSON.stringify(assets));
console.log(`[embed-extension] Wrote ${Object.keys(assets).length} files → src/lib/extension-zip-assets.generated.json`);
