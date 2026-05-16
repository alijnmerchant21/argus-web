import { defineEventHandler, setResponseHeaders, readBody, createError, getRequestHeader } from "h3";
import { z } from "zod";
import { requireApiKey, getDb, corsHeaders } from "../../utils/api";

const logEntrySchema = z.object({
  rule_id:     z.string().min(1),
  rule_title:  z.string().default(""),
  action:      z.enum(["block", "warn", "flag"]),
  matched_kw:  z.string().default(""),
  platform:    z.string().default(""),
  prompt_text: z.string().max(20000).default(""),
  created_at:  z.number().int().positive(),
});

const bodySchema = z.object({
  logs: z.array(logEntrySchema).min(1).max(100),
});

export default defineEventHandler(async (event) => {
  if (event.method === "OPTIONS") {
    setResponseHeaders(event, corsHeaders());
    return null;
  }

  setResponseHeaders(event, corsHeaders());

  const apiKey  = (getRequestHeader(event, "authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const username = await requireApiKey(event);
  const sql      = getDb();

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await readBody(event);
    parsed = bodySchema.parse(raw);
  } catch (e) {
    throw createError({ statusCode: 400, message: "Invalid request body" });
  }

  // Verify all rule_ids belong to this user (security: prevent log injection for other users' rules)
  const ids = [...new Set(parsed.logs.map((l) => l.rule_id))];
  const owned = await sql`
    SELECT id FROM rules WHERE id = ANY(${ids}) AND user_id = ${username}
  `;
  const ownedIds = new Set((owned as { id: string }[]).map((r) => r.id));

  let accepted = 0;
  for (const entry of parsed.logs) {
    if (!ownedIds.has(entry.rule_id)) continue; // skip logs for rules that don't belong to this user
    await sql`
      INSERT INTO logs
        (api_key, rule_id, rule_title, action, matched_kw, platform, prompt_text, created_at)
      VALUES
        (${apiKey}, ${entry.rule_id}, ${entry.rule_title}, ${entry.action},
         ${entry.matched_kw}, ${entry.platform}, ${entry.prompt_text}, ${entry.created_at})
    `;
    accepted++;
  }

  return { accepted };
});
