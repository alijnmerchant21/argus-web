import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
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

async function getCurrentUserId(): Promise<string> {
  // TanStack server functions expose useSession as an async server helper here.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const session = await useSession<{ username: string }>(sessionConfig());
  const userId = session.data.username;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export type RuleAction = "block" | "warn" | "flag";
export type RuleSeverity = "low" | "medium" | "high";
export type RuleScope = "input" | "output" | "both";
export type MatchLogic = "any" | "all";

/** Raw DB row */
type RuleRow = {
  id: string;
  user_id: string;
  title: string;
  action: RuleAction;
  keywords: string;
  keyword_actions: string;
  body: string;
  severity: RuleSeverity;
  platforms: string;
  scope: RuleScope;
  match_logic: MatchLogic;
  domain: string;
  active: number;
  notes: string;
  updated_at: number;
};

/** Parsed view for the UI */
export type RuleView = Omit<RuleRow, "keywords" | "keyword_actions" | "platforms" | "active"> & {
  keywords: string[];
  keyword_actions: Record<string, RuleAction>;
  platforms: string[];
  active: boolean;
};

function toView(r: RuleRow): RuleView {
  let keywords: string[] = [];
  let keyword_actions: Record<string, RuleAction> = {};
  let platforms: string[] = ["chatgpt", "claude"];
  try {
    keywords = JSON.parse(r.keywords);
  } catch {
    /**/
  }
  try {
    keyword_actions = JSON.parse(r.keyword_actions || "{}");
  } catch {
    /**/
  }
  try {
    platforms = JSON.parse(r.platforms);
  } catch {
    /**/
  }
  return { ...r, keywords, keyword_actions, platforms, active: r.active !== 0 };
}

// ── Server functions ──────────────────────────────────────────────────────────

export const getRulesFn = createServerFn({ method: "GET" }).handler(async () => {
  const [sql, userId] = await Promise.all([Promise.resolve(getDb()), getCurrentUserId()]);
  await ensureRuleSchema();
  const rows = await sql`
    SELECT id, user_id, title, action, keywords, keyword_actions, body, severity,
           platforms, scope, match_logic, domain, active, notes, updated_at
    FROM rules
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return (rows as RuleRow[]).map(toView);
});

const ruleInput = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  action: z.enum(["block", "warn", "flag"]),
  keywords: z.array(z.string()),
  keyword_actions: z.record(z.enum(["block", "warn", "flag"])).default({}),
  body: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  platforms: z.array(z.string()),
  scope: z.enum(["input", "output", "both"]),
  match_logic: z.enum(["any", "all"]),
  domain: z.string(),
  active: z.boolean(),
  notes: z.string(),
});

export const saveRuleFn = createServerFn({ method: "POST" })
  .inputValidator(ruleInput)
  .handler(async ({ data }) => {
    const [sql, userId] = await Promise.all([Promise.resolve(getDb()), getCurrentUserId()]);
    await ensureRuleSchema();
    const now = Date.now();
    const kw = JSON.stringify(data.keywords);
    const ka = JSON.stringify(data.keyword_actions);
    const pf = JSON.stringify(data.platforms);
    const act = data.active ? 1 : 0;

    if (data.id) {
      await sql`
        UPDATE rules SET
          title = ${data.title}, action = ${data.action}, keywords = ${kw},
          keyword_actions = ${ka},
          body = ${data.body}, severity = ${data.severity}, platforms = ${pf},
          scope = ${data.scope}, match_logic = ${data.match_logic},
          domain = ${data.domain}, active = ${act}, notes = ${data.notes},
          updated_at = ${now}
        WHERE id::text = ${data.id} AND user_id = ${userId}
      `;
      return { id: data.id };
    }

    const rows = await sql`
      INSERT INTO rules
        (user_id, title, action, keywords, keyword_actions, body, severity, platforms, scope, match_logic, domain, active, notes, updated_at)
      VALUES
        (${userId}, ${data.title}, ${data.action}, ${kw}, ${ka}, ${data.body}, ${data.severity},
         ${pf}, ${data.scope}, ${data.match_logic}, ${data.domain}, ${act}, ${data.notes}, ${now})
      RETURNING id
    `;
    return { id: (rows[0] as { id: string }).id };
  });

export const deleteRuleFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [sql, userId] = await Promise.all([Promise.resolve(getDb()), getCurrentUserId()]);
    await sql`DELETE FROM rules WHERE id::text = ${data.id} AND user_id = ${userId}`;
  });
