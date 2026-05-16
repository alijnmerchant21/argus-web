import { defineEventHandler, createError } from "h3";
import { requireSession, getDb } from "../../../utils/api";

// GET  /api/settings/api-key  → return current key (or null)
// POST /api/settings/api-key  → generate / rotate key

function generateApiKey(): string {
  // 64 random hex chars — works in both Node and Cloudflare edge
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return "argus_" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default defineEventHandler(async (event) => {
  const username = await requireSession(event);
  const sql      = getDb();

  if (event.method === "GET") {
    const rows = await sql`
      SELECT api_key, created_at FROM api_keys WHERE username = ${username} LIMIT 1
    `;
    if (rows.length === 0) return { api_key: null };
    const row = rows[0] as { api_key: string; created_at: number };
    return { api_key: row.api_key, created_at: row.created_at };
  }

  if (event.method === "POST") {
    const newKey = generateApiKey();
    const now    = Date.now();
    await sql`
      INSERT INTO api_keys (username, api_key, created_at)
      VALUES (${username}, ${newKey}, ${now})
      ON CONFLICT (username) DO UPDATE SET api_key = ${newKey}, created_at = ${now}
    `;
    return { api_key: newKey, created_at: now };
  }

  throw createError({ statusCode: 405, message: "Method not allowed" });
});
