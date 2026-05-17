/**
 * Builds CSP-safe main-world hook as a standalone extension script (not inline).
 * Runs after vite so dist/ already exists.
 */
import esbuild from "esbuild";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const outfile = process.argv.includes("--dist")
  ? resolve(root, "dist/argus-main-world.js")
  : resolve(root, "public/argus-main-world.js");

await esbuild.build({
  entryPoints: [resolve(root, "src/main-world/argusMainWorld.ts")],
  outfile,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  logLevel: "info",
});

console.log(`[argus] argus-main-world.js → ${outfile}`);
