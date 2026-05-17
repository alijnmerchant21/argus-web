import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const extRoot = join(__dirname, "..");
const pub = join(extRoot, "public");
const src = join(extRoot, "..", "public", "argus-logo.png");
const dest = join(pub, "argus-logo.png");

mkdirSync(pub, { recursive: true });
copyFileSync(src, dest);
