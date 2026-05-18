import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { ensureAIInteractionsTable } from "./extension-api";

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

async function useUsername(): Promise<string> {
  // TanStack server functions expose useSession as an async server helper here.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const session = await useSession<{ username: string }>(sessionConfig());
  if (!session.data.username) throw new Error("Not authenticated");
  return session.data.username;
}

function generateApiKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return (
    "argus_" +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export const getApiKeyFn = createServerFn({ method: "GET" }).handler(async () => {
  const [sql, username] = await Promise.all([Promise.resolve(getDb()), useUsername()]);
  const rows =
    await sql`SELECT api_key, created_at FROM api_keys WHERE username = ${username} LIMIT 1`;
  if (rows.length === 0)
    return { api_key: null as string | null, created_at: null as number | null };
  const row = rows[0] as { api_key: string; created_at: number };
  return { api_key: row.api_key, created_at: row.created_at };
});

export const regenerateApiKeyFn = createServerFn({ method: "POST" }).handler(async () => {
  const [sql, username] = await Promise.all([Promise.resolve(getDb()), useUsername()]);
  const newKey = generateApiKey();
  const now = Date.now();
  await sql`
    INSERT INTO api_keys (username, api_key, created_at)
    VALUES (${username}, ${newKey}, ${now})
    ON CONFLICT (username) DO UPDATE SET api_key = ${newKey}, created_at = ${now}
  `;
  return { api_key: newKey, created_at: now };
});

const reportLogsInput = z.object({
  ruleId: z.string().min(1),
  limit: z.number().int().positive().optional(),
  before: z.number().int().positive().optional(),
});

const aiInteractionsInput = z.object({
  limit: z.number().int().positive().optional(),
  before: z.number().int().positive().optional(),
});

const dashboardActivityInput = z.object({
  limit: z.number().int().positive().optional(),
});

export const getDashboardActivityFn = createServerFn({ method: "GET" })
  .inputValidator(dashboardActivityInput)
  .handler(async ({ data }) => {
    const [sql, username] = await Promise.all([Promise.resolve(getDb()), useUsername()]);
    const limit = Math.min(data.limit ?? 8, 50);

    const counts = await sql`
      SELECT
        COUNT(l.*)                                      AS total,
        COUNT(l.*) FILTER (WHERE l.action = 'block')   AS blocked,
        COUNT(l.*) FILTER (WHERE l.action = 'warn')    AS warned,
        COUNT(l.*) FILTER (WHERE l.action = 'flag')    AS flagged
      FROM logs l
      INNER JOIN rules r ON r.id::text = l.rule_id
      WHERE r.user_id = ${username}
    `;
    const s = counts[0] as { total: string; blocked: string; warned: string; flagged: string };

    const latest = await sql`
      SELECT
        l.id, l.rule_id, r.title AS rule_title, l.action, l.matched_kw,
        l.platform, l.prompt_text, l.created_at
      FROM logs l
      INNER JOIN rules r ON r.id::text = l.rule_id
      WHERE r.user_id = ${username}
      ORDER BY l.created_at DESC
      LIMIT ${limit}
    `;

    return {
      summary: {
        total: Number(s.total),
        blocked: Number(s.blocked),
        warned: Number(s.warned),
        flagged: Number(s.flagged),
      },
      latest: latest as {
        id: string;
        rule_id: string;
        rule_title: string;
        action: "block" | "warn" | "flag";
        matched_kw: string;
        platform: string;
        prompt_text: string;
        created_at: number;
      }[],
    };
  });

export const getReportLogsFn = createServerFn({ method: "GET" })
  .inputValidator(reportLogsInput)
  .handler(async ({ data }) => {
    const [sql, username] = await Promise.all([Promise.resolve(getDb()), useUsername()]);

    const ruleCheck = await sql`
      SELECT id, title FROM rules WHERE id::text = ${data.ruleId} AND user_id = ${username} LIMIT 1
    `;
    if (ruleCheck.length === 0) throw new Error("Rule not found");
    const rule = ruleCheck[0] as { id: string; title: string };

    const limit = Math.min(data.limit ?? 50, 500);
    // created_at is set by the extension (client clock). Default upper bound used
    // Date.now() on the server, so fast machines or clock skew could hide fresh rows.
    // Omit the bound on the first page (before unset); use strict `< before` only when paginating.
    const rows =
      data.before != null
        ? await sql`
            SELECT id, action, matched_kw, platform, prompt_text, created_at
            FROM logs
            WHERE rule_id = ${data.ruleId} AND created_at < ${data.before}
            ORDER BY created_at DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT id, action, matched_kw, platform, prompt_text, created_at
            FROM logs
            WHERE rule_id = ${data.ruleId}
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
        total: Number(s.total),
        blocked: Number(s.blocked),
        warned: Number(s.warned),
        flagged: Number(s.flagged),
      },
      logs: rows as {
        id: string;
        action: string;
        matched_kw: string;
        platform: string;
        prompt_text: string;
        created_at: number;
      }[],
    };
  });

export const getAIInteractionsFn = createServerFn({ method: "GET" })
  .inputValidator(aiInteractionsInput)
  .handler(async ({ data }) => {
    const [sql, username] = await Promise.all([Promise.resolve(getDb()), useUsername()]);
    const limit = Math.min(data.limit ?? 100, 500);

    await ensureAIInteractionsTable();

    const rows =
      data.before != null
        ? await sql`
            SELECT id, side, platform, url, content, created_at
            FROM ai_interactions
            WHERE user_id = ${username} AND created_at < ${data.before}
            ORDER BY created_at DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT id, side, platform, url, content, created_at
            FROM ai_interactions
            WHERE user_id = ${username}
            ORDER BY created_at DESC
            LIMIT ${limit}
          `;

    return (
      rows as {
        id: string;
        side: "input" | "output";
        platform: string;
        url: string;
        content: string;
        created_at: number;
      }[]
    ).filter((row) => !isInternalAITransportNoise(row.content, row.url));
  });

function isInternalAITransportNoise(content: string, url = ""): boolean {
  const text = content.trim();
  if (
    /\/backend-api\/(settings|aip|accounts|conversation\/limit|models|sentinel|voice)/i.test(url)
  ) {
    return true;
  }
  if (!text.startsWith("{") && !text.startsWith("[")) return false;
  return /"conduit_token"|"persona"|"conversation_detail_metadata"|"blocked_features"|"status"\s*:\s*"?(ok|OK|success)"?|"detail"\s*:\s*"Unauthorized"|"links"\s*:|"integrations"\s*:|"voices"\s*:|"object"\s*:\s*"user"|"beta_settings"\s*:/.test(
    text,
  );
}
