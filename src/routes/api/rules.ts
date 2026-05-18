import { createFileRoute } from "@tanstack/react-router";
import {
  corsHeaders,
  ensureRuleSchema,
  getDb,
  requireApiKey,
  safeJsonParse,
} from "@/lib/extension-api";

const ROUTE_METHODS = "GET, OPTIONS";

export const Route = createFileRoute("/api/rules")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders(ROUTE_METHODS) }),
      GET: async ({ request }) => {
        const auth = await requireApiKey(request, ROUTE_METHODS);
        if (auth instanceof Response) return auth;

        const sql = getDb();
        await ensureRuleSchema();
        const url = new URL(request.url);
        const idsParam = url.searchParams.get("ids")?.trim() ?? "";
        const scopedIds = idsParam
          ? idsParam
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null;

        const ifModifiedSince = request.headers.get("if-modified-since");
        if (ifModifiedSince) {
          const since = new Date(ifModifiedSince).getTime();
          if (!Number.isNaN(since)) {
            const recent = scopedIds
              ? await sql`
                  SELECT 1 FROM rules
                  WHERE user_id = ${auth.username} AND id::text = ANY(${scopedIds}::text[]) AND updated_at > ${since}
                  LIMIT 1
                `
              : await sql`
                  SELECT 1 FROM rules
                  WHERE user_id = ${auth.username} AND active = 1 AND updated_at > ${since}
                  LIMIT 1
                `;
            if (recent.length === 0)
              return new Response(null, { status: 304, headers: corsHeaders(ROUTE_METHODS) });
          }
        }

        const rows = scopedIds
          ? await sql`
              SELECT id, title, action, keywords, keyword_actions, body, severity,
                     scope, match_logic, domain, active
              FROM rules
              WHERE user_id = ${auth.username} AND id::text = ANY(${scopedIds}::text[])
              ORDER BY updated_at DESC
            `
          : await sql`
              SELECT id, title, action, keywords, keyword_actions, body, severity,
                     scope, match_logic, domain, active
              FROM rules
              WHERE user_id = ${auth.username} AND active = 1
              ORDER BY updated_at DESC
            `;

        const rules = rows.map((r) => ({
          id: String(r.id),
          title: r.title,
          action: r.action,
          keywords: safeJsonParse(r.keywords as string, [] as string[]),
          keyword_actions: safeJsonParse(r.keyword_actions as string, {} as Record<string, string>),
          body: r.body,
          severity: r.severity,
          scope: r.scope,
          match_logic: r.match_logic,
          domain: r.domain,
          active: Boolean(r.active),
        }));

        return Response.json(rules, {
          headers: { ...corsHeaders(ROUTE_METHODS), "Last-Modified": new Date().toUTCString() },
        });
      },
    },
  },
});
