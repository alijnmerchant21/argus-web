import { defineEventHandler, setResponseHeaders, getQuery, createError } from "h3";
import { requireSession, getDb } from "../../utils/api";

export default defineEventHandler(async (event) => {
  if (event.method === "OPTIONS") { return null; }

  const username = await requireSession(event);
  const sql      = getDb();
  const query    = getQuery(event);

  const ruleId = String(query.rule_id ?? "").trim();
  const limit  = Math.min(Math.max(Number(query.limit ?? 50), 1), 500);
  const before = Number(query.before ?? Date.now());

  if (!ruleId) throw createError({ statusCode: 400, message: "rule_id required" });

  // Verify this rule belongs to the logged-in user
  const ruleCheck = await sql`
    SELECT id, title FROM rules WHERE id = ${ruleId} AND user_id = ${username} LIMIT 1
  `;
  if (ruleCheck.length === 0) throw createError({ statusCode: 404, message: "Rule not found" });

  const rule = ruleCheck[0] as { id: string; title: string };

  const rows = await sql`
    SELECT id, action, matched_kw, platform, prompt_text, created_at
    FROM logs
    WHERE rule_id = ${ruleId} AND created_at < ${before}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  // Summary counts
  const counts = await sql`
    SELECT
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE action = 'block')             AS blocked,
      COUNT(*) FILTER (WHERE action = 'warn')              AS warned,
      COUNT(*) FILTER (WHERE action = 'flag')              AS flagged
    FROM logs
    WHERE rule_id = ${ruleId}
  `;
  const summary = counts[0] as { total: string; blocked: string; warned: string; flagged: string };

  return {
    rule: { id: rule.id, title: rule.title },
    summary: {
      total:   Number(summary.total),
      blocked: Number(summary.blocked),
      warned:  Number(summary.warned),
      flagged: Number(summary.flagged),
    },
    logs: rows,
  };
});
