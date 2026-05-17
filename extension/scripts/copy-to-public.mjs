/**
 * Copies the compiled extension dist/ into the main web app's
 * public/extension-base/ folder so generate-extension.ts can
 * read and bundle the real JS/HTML files at download time.
 */
import { cpSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src  = resolve(__dirname, "../dist");
const dest = resolve(__dirname, "../../public/extension-base");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[argus] Extension files copied → public/extension-base`);
