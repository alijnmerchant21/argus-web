import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { neon } from "@neondatabase/serverless";
import JSZip from "jszip";
import { z } from "zod";

import extensionZipAssets from "./extension-zip-assets.generated.json";
import { ensureRuleSchema } from "./extension-api";

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
  // TanStack server functions expose useSession as an async server helper here.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const session = await useSession<{ username: string }>(sessionConfig());
  if (!session.data.username) throw new Error("Not authenticated");
  return session.data.username;
}

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/** Production dashboard / API base (no trailing slash). */
function getDashboardBaseUrl(): string {
  const fromEnv = process.env["DASHBOARD_URL"]?.trim();
  if (fromEnv) return normalizeDashboardBase(fromEnv);
  const vercel = process.env["VERCEL_URL"]?.trim();
  if (vercel) {
    const v = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    return normalizeDashboardBase(v);
  }
  return "http://localhost:3000";
}

function normalizeDashboardBase(u: string): string {
  let s = u.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

const generateInput = z.object({
  ruleId: z.string().optional(),
});

/**
 * Generates a personalised Chrome extension zip containing:
 *  - All pre-built extension files from /public/extension-base/
 *  - config.json  ← API key + dashboard URL baked in (no manual setup)
 *  - rules.json   ← user's active rules baked in (works offline immediately)
 *
 * Pass `ruleId` to bundle a single-rule extension instead of all rules.
 */
export const generateExtensionFn = createServerFn({ method: "POST" })
  .inputValidator(generateInput)
  .handler(async ({ data }) => {
    const username = await getUsername();
    const sql = getDb();
    const { ruleId } = data;
    await ensureRuleSchema();

    // 1. Get or auto-create API key
    let apiKey: string;
    const keyRows = await sql`SELECT api_key FROM api_keys WHERE username = ${username} LIMIT 1`;
    if (keyRows.length > 0) {
      apiKey = (keyRows[0] as { api_key: string }).api_key;
    } else {
      // Auto-generate key if user hasn't made one yet
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      apiKey =
        "argus_" +
        Array.from(arr)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      const now = Date.now();
      await sql`
      INSERT INTO api_keys (username, api_key, created_at)
      VALUES (${username}, ${apiKey}, ${now})
      ON CONFLICT (username) DO NOTHING
    `;
    }

    // 2. Get rules (all active, or a specific single rule)
    const rows = ruleId
      ? await sql`
        SELECT id, title, action, keywords, keyword_actions, body, severity, scope, match_logic, domain, active
        FROM rules
        WHERE user_id = ${username} AND id::text = ${ruleId}
        LIMIT 1
      `
      : await sql`
        SELECT id, title, action, keywords, keyword_actions, body, severity, scope, match_logic, domain, active
        FROM rules
        WHERE user_id = ${username} AND active = 1
        ORDER BY updated_at DESC
      `;

    const rules = rows.map((r) => ({
      id: r.id,
      title: r.title,
      action: r.action,
      keywords: safeJsonParse(r.keywords as string, [] as string[]),
      keyword_actions: safeJsonParse(r.keyword_actions as string, {} as Record<string, string>),
      body: r.body,
      severity: r.severity,
      scope: r.scope,
      match_logic: r.match_logic,
      domain: r.domain,
      active: true,
    }));

    const dashboardUrl = getDashboardBaseUrl();

    // 3. Build the zip
    const zip = new JSZip();

    // config.json — baked-in credentials + optional scope lock
    // scopedRuleIds: when set, the extension syncs ONLY these rule IDs.
    // For all-rules bundles this field is absent — extension fetches all active rules.
    const configPayload: Record<string, unknown> = {
      apiKey,
      apiBaseUrl: dashboardUrl,
      generatedAt: Date.now(),
      generatedFor: username,
    };
    if (ruleId && rules.length === 1) {
      configPayload.scopedRuleIds = [rules[0].id];
    }
    zip.file("config.json", JSON.stringify(configPayload, null, 2));

    // rules.json — baked-in rules so the extension works immediately offline
    zip.file("rules.json", JSON.stringify(rules, null, 2));

    // README — instructions for loading the extension
    zip.file(
      "README.txt",
      [
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
        "5. Select the folder that contains manifest.json (open the unzipped folder — Chrome needs the directory with manifest.json at the top level, not its parent).",
        "6. Argus is now active on ChatGPT, Claude, and Gemini",
        "",
        "Your rules sync automatically from the Argus dashboard.",
        `Dashboard: ${dashboardUrl}`,
        "",
        "NOTE: Re-download from the dashboard after changing rules or API key.",
      ].join("\n"),
    );

    // Pre-built extension files (embedded at app build time — works on Vercel serverless)
    const assets = extensionZipAssets as Record<string, string>;
    if (!assets["manifest.json"]) {
      throw new Error(
        "Extension bundle is missing manifest — run npm run ext:build:copy before building the app.",
      );
    }
    for (const [rel, b64] of Object.entries(assets)) {
      if (rel === "config.json" || rel === "rules.json") continue;
      zip.file(rel, Buffer.from(b64, "base64"), { binary: true });
    }

    // Generate zip as base64
    const base64 = await zip.generateAsync({
      type: "base64",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const singleRuleTitle =
      ruleId && rules.length === 1
        ? rules[0].title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
        : null;
    const filename = singleRuleTitle
      ? `argus-${singleRuleTitle}-${Date.now()}.zip`
      : `argus-extension-${username}-${Date.now()}.zip`;

    return { base64, filename, ruleCount: rules.length, apiKey, singleRule: !!ruleId };
  });
