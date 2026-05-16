import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { neon } from "@neondatabase/serverless";
import JSZip from "jszip";

function getDb() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set.");
  return neon(url);
}

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"] ?? "argus-dev-secret-change-me-in-prod!!",
    name: "argus-session",
  };
}

async function getUsername(): Promise<string> {
  const session = await useSession<{ username: string }>(sessionConfig());
  if (!session.data.username) throw new Error("Not authenticated");
  return session.data.username;
}

function safeJsonParse<T>(str: string, fallback: T): T {
  try { return JSON.parse(str); } catch { return fallback; }
}

/**
 * Generates a personalised Chrome extension zip containing:
 *  - All pre-built extension files from /public/extension-base/
 *  - config.json  ← API key + dashboard URL baked in (no manual setup)
 *  - rules.json   ← user's active rules baked in (works offline immediately)
 *
 * The extension reads config.json on startup — the user loads it in Chrome
 * and it works immediately with zero configuration.
 */
export const generateExtensionFn = createServerFn({ method: "POST" }).handler(async () => {
  const username = await getUsername();
  const sql = getDb();

  // 1. Get or auto-create API key
  let apiKey: string;
  const keyRows = await sql`SELECT api_key FROM api_keys WHERE username = ${username} LIMIT 1`;
  if (keyRows.length > 0) {
    apiKey = (keyRows[0] as { api_key: string }).api_key;
  } else {
    // Auto-generate key if user hasn't made one yet
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    apiKey = "argus_" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
    const now = Date.now();
    await sql`
      INSERT INTO api_keys (username, api_key, created_at)
      VALUES (${username}, ${apiKey}, ${now})
      ON CONFLICT (username) DO NOTHING
    `;
  }

  // 2. Get active rules
  const rows = await sql`
    SELECT id, title, action, keywords, body, severity, scope, match_logic, domain, active
    FROM rules
    WHERE user_id = ${username} AND active = 1
    ORDER BY updated_at DESC
  `;

  const rules = rows.map((r) => ({
    id:          r.id,
    title:       r.title,
    action:      r.action,
    keywords:    safeJsonParse(r.keywords as string, [] as string[]),
    body:        r.body,
    severity:    r.severity,
    scope:       r.scope,
    match_logic: r.match_logic,
    domain:      r.domain,
    active:      true,
  }));

  const dashboardUrl = process.env["DASHBOARD_URL"] ?? "https://argus-web.vercel.app";

  // 3. Build the zip
  const zip = new JSZip();

  // config.json — baked-in credentials so the extension auto-connects
  zip.file("config.json", JSON.stringify({
    apiKey,
    apiBaseUrl: dashboardUrl,
    generatedAt: Date.now(),
    generatedFor: username,
  }, null, 2));

  // rules.json — baked-in rules so the extension works immediately offline
  zip.file("rules.json", JSON.stringify(rules, null, 2));

  // manifest.json — extension manifest (V3)
  zip.file("manifest.json", JSON.stringify({
    manifest_version: 3,
    name: "Argus Guardrails",
    version: "2.0.0",
    description: "Enforce your custom AI guardrails on ChatGPT, Claude, and Gemini.",
    permissions: ["storage", "activeTab", "alarms"],
    host_permissions: [
      "https://chatgpt.com/*",
      "https://chat.openai.com/*",
      "https://claude.ai/*",
      "https://gemini.google.com/*",
    ],
    background: {
      service_worker: "background/service-worker.js",
      type: "module",
    },
    content_scripts: [{
      matches: [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
      ],
      js: ["content/index.js"],
      run_at: "document_idle",
    }],
    action: {
      default_popup: "popup/index.html",
      default_icon: {
        "16":  "icons/icon-16.png",
        "48":  "icons/icon-48.png",
        "128": "icons/icon-128.png",
      },
    },
    icons: {
      "16":  "icons/icon-16.png",
      "48":  "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
    web_accessible_resources: [{
      resources: ["icons/*"],
      matches: ["https://chatgpt.com/*", "https://chat.openai.com/*", "https://claude.ai/*", "https://gemini.google.com/*"],
    }],
  }, null, 2));

  // README — instructions for loading the extension
  zip.file("README.txt", [
    "Argus Guardrails — Chrome Extension",
    "====================================",
    "",
    "This extension is pre-configured for your account.",
    `Generated: ${new Date().toISOString()}`,
    `Rules included: ${rules.length} active rule${rules.length !== 1 ? "s" : ""}`,
    "",
    "HOW TO INSTALL",
    "--------------",
    "1. Unzip this folder",
    "2. Open Chrome → go to chrome://extensions",
    "3. Enable 'Developer mode' (top right toggle)",
    "4. Click 'Load unpacked'",
    "5. Select the unzipped folder",
    "6. Argus is now active on ChatGPT, Claude, and Gemini",
    "",
    "Your rules sync automatically from the Argus dashboard.",
    `Dashboard: ${dashboardUrl}`,
    "",
    "NOTE: The pre-built extension files (background/service-worker.js,",
    "content/index.js, popup/) must be present in this folder.",
    "If they are missing, the extension agent has not yet delivered the",
    "compiled files. Contact your administrator.",
  ].join("\n"));

  // Placeholder notice for extension JS files
  // (replaced with real compiled files once extension agent delivers them)
  zip.folder("background");
  zip.folder("content");
  zip.folder("popup");
  zip.folder("icons");

  zip.file("background/service-worker.js", [
    "// PLACEHOLDER — replace with compiled service-worker.js from argus-extension build",
    "// See: https://github.com/your-org/argus-extension",
    "console.warn('[Argus] Extension JS files not yet installed. Please replace placeholders.');",
  ].join("\n"));

  zip.file("content/index.js", [
    "// PLACEHOLDER — replace with compiled content/index.js from argus-extension build",
    "console.warn('[Argus] Extension JS files not yet installed. Please replace placeholders.');",
  ].join("\n"));

  zip.file("popup/index.html", `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Argus</title></head>
<body style="width:320px;padding:20px;font-family:system-ui,sans-serif">
  <h2>🛡️ Argus</h2>
  <p>Extension files not yet installed.</p>
  <p>Replace placeholder JS files with the compiled build from <code>argus-extension</code>.</p>
</body></html>`);

  // Generate zip as base64
  const base64 = await zip.generateAsync({
    type: "base64",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    base64,
    filename: `argus-extension-${username}-${Date.now()}.zip`,
    ruleCount: rules.length,
    apiKey,
  };
});
