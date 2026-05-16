import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

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

function generateApiKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return "argus_" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const getApiKeyFn = createServerFn({ method: "GET" }).handler(async () => {
  const [sql, username] = await Promise.all([Promise.resolve(getDb()), getUsername()]);
  const rows = await sql`SELECT api_key, created_at FROM api_keys WHERE username = ${username} LIMIT 1`;
  if (rows.length === 0) return { api_key: null as string | null, created_at: null as number | null };
  const row = rows[0] as { api_key: string; created_at: number };
  return { api_key: row.api_key, created_at: row.created_at };
});

export const regenerateApiKeyFn = createServerFn({ method: "POST" }).handler(async () => {
  const [sql, username] = await Promise.all([Promise.resolve(getDb()), getUsername()]);
  const newKey = generateApiKey();
  const now    = Date.now();
  await sql`
    INSERT INTO api_keys (username, api_key, created_at)
    VALUES (${username}, ${newKey}, ${now})
    ON CONFLICT (username) DO UPDATE SET api_key = ${newKey}, created_at = ${now}
  `;
  return { api_key: newKey, created_at: now };
});

const reportLogsInput = z.object({
  ruleId:  z.string().min(1),
  limit:   z.number().int().positive().optional(),
  before:  z.number().int().positive().optional(),
});

export const getReportLogsFn = createServerFn({ method: "GET" })
  .inputValidator(reportLogsInput)
  .handler(async ({ data }) => {
    const [sql, username] = await Promise.all([Promise.resolve(getDb()), getUsername()]);

    const ruleCheck = await sql`
      SELECT id, title FROM rules WHERE id = ${data.ruleId} AND user_id = ${username} LIMIT 1
    `;
    if (ruleCheck.length === 0) throw new Error("Rule not found");
    const rule = ruleCheck[0] as { id: string; title: string };

    const limit  = Math.min(data.limit ?? 50, 500);
    const before = data.before ?? Date.now();

    const rows = await sql`
      SELECT id, action, matched_kw, platform, prompt_text, created_at
      FROM logs
      WHERE rule_id = ${data.ruleId} AND created_at < ${before}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const counts = await sql`
      SELECT
        COUNT(*)                                         AS total,
        COUNT(*) FILTER (WHERE action = 'block')        AS blocked,
        COUNT(*) FILTER (WHERE action = 'warn')         AS warned,
        COUNT(*) FILTER (WHERE action = 'flag')         AS flagged
      FROM logs WHERE rule_id = ${data.ruleId}
    `;
    const s = counts[0] as { total: string; blocked: string; warned: string; flagged: string };

    return {
      rule,
      summary: {
        total:   Number(s.total),
        blocked: Number(s.blocked),
        warned:  Number(s.warned),
        flagged: Number(s.flagged),
      },
      logs: rows as {
        id: string; action: string; matched_kw: string;
        platform: string; prompt_text: string; created_at: number;
      }[],
    };
  });
