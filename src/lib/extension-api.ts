import { neon } from "@neondatabase/serverless";

export interface ApiKeyAuth {
  username: string;
  apiKey: string;
}

export function getDb() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set.");
  return neon(url);
}

export function corsHeaders(methods = "GET, POST, OPTIONS") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, If-Modified-Since, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonError(error: string, status: number, methods?: string): Response {
  return Response.json({ error }, { status, headers: corsHeaders(methods) });
}

export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export async function ensureRuleSchema(): Promise<void> {
  await getDb()`
    ALTER TABLE rules
    ADD COLUMN IF NOT EXISTS keyword_actions TEXT NOT NULL DEFAULT '{}'
  `;
}

export async function requireApiKey(
  request: Request,
  methods?: string,
): Promise<ApiKeyAuth | Response> {
  const apiKey = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!apiKey || !apiKey.startsWith("argus_")) {
    return jsonError("Unauthorized", 401, methods);
  }

  const rows = await getDb()`SELECT username FROM api_keys WHERE api_key = ${apiKey} LIMIT 1`;
  const row = rows[0] as { username: string } | undefined;
  if (!row) return jsonError("Invalid API key", 401, methods);

  return { username: row.username, apiKey };
}

export async function ensureAIInteractionsTable(): Promise<void> {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS ai_interactions (
      id         TEXT   PRIMARY KEY DEFAULT gen_random_uuid()::text,
      api_key    TEXT   NOT NULL,
      user_id    TEXT   NOT NULL,
      side       TEXT   NOT NULL,
      platform   TEXT   NOT NULL DEFAULT '',
      url        TEXT   NOT NULL DEFAULT '',
      content    TEXT   NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ai_interactions_user_created_idx
    ON ai_interactions(user_id, created_at DESC)
  `;
}
