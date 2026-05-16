import { neon } from "@neondatabase/serverless";
import { getHeader, createError, useSession } from "h3";
import type { H3Event } from "h3";

export function getDb() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw createError({ statusCode: 500, message: "DATABASE_URL not set" });
  return neon(url);
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, If-Modified-Since",
  };
}

export function safeJsonParse<T>(str: string, fallback: T): T {
  try { return JSON.parse(str); } catch { return fallback; }
}

/** Validate Bearer API key → return username or throw 401 */
export async function requireApiKey(event: H3Event): Promise<string> {
  const auth  = getHeader(event, "authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || !token.startsWith("argus_")) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }
  const sql  = getDb();
  const rows = await sql`SELECT username FROM api_keys WHERE api_key = ${token} LIMIT 1`;
  const row  = rows[0] as { username: string } | undefined;
  if (!row) throw createError({ statusCode: 401, message: "Invalid API key" });
  return row.username;
}

/** Validate session cookie → return username or throw 401 */
export async function requireSession(event: H3Event): Promise<string> {
  const session = await useSession<{ username?: string }>(event, {
    password: process.env["SESSION_SECRET"] ?? "argus-dev-secret-change-me-in-prod!!",
    name: "argus-session",
  });
  if (!session.data.username) {
    throw createError({ statusCode: 401, message: "Not authenticated" });
  }
  return session.data.username;
}
