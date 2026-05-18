/**
 * Copies the compiled extension dist/ into the main web app's
 * public/extension-base/ folder so generate-extension.ts can
 * read and bundle the real JS/HTML files at download time.
 *
 * Patches manifest.json host_permissions with the dashboard API origin from
 * DASHBOARD_URL or VERCEL_URL so the service worker can reach your deployment
 * (not a hard-coded *.vercel.app host).
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "../dist");
const dest = resolve(__dirname, "../../public/extension-base");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

const dashboardUrl = resolveDashboardUrlFromEnv();
if (dashboardUrl) {
  try {
    const origin = new URL(dashboardUrl).origin + "/*";
    const manifestPath = resolve(dest, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.host_permissions = manifest.host_permissions ?? [];
    if (!manifest.host_permissions.includes(origin)) {
      manifest.host_permissions.push(origin);
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[argus] manifest host_permissions += ${origin}`);
  } catch (e) {
    console.warn("[argus] could not patch manifest.json host_permissions:", e);
  }
}

console.log(`[argus] Extension files copied → public/extension-base`);

/** @returns {string} */
function resolveDashboardUrlFromEnv() {
  const d = process.env.DASHBOARD_URL?.trim();
  if (d) return normalizeUrl(d);
  const v = process.env.VERCEL_URL?.trim();
  if (v) return normalizeUrl(v.startsWith("http") ? v : `https://${v}`);
  const vite = process.env.VITE_ARGUS_DASHBOARD_URL?.trim();
  if (vite) return normalizeUrl(vite);
  return "";
}

/** @param {string} u */
function normalizeUrl(u) {
  let s = u.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}
