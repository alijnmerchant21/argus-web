import { defineEventHandler, setResponseHeaders, getRequestHeader } from "h3";
import { requireApiKey, getDb, corsHeaders, safeJsonParse } from "../../utils/api";

export default defineEventHandler(async (event) => {
  // CORS preflight
  if (event.method === "OPTIONS") {
    setResponseHeaders(event, corsHeaders());
    return null;
  }

  setResponseHeaders(event, corsHeaders());

  const username = await requireApiKey(event);
  const sql      = getDb();

  // If-Modified-Since support — cheap no-op if nothing changed
  const ifModifiedSince = getRequestHeader(event, "if-modified-since");
  if (ifModifiedSince) {
    const since = new Date(ifModifiedSince).getTime();
    if (!isNaN(since)) {
      const recent = await sql`
        SELECT 1 FROM rules
        WHERE user_id = ${username} AND active = 1 AND updated_at > ${since}
        LIMIT 1
      `;
      if (recent.length === 0) {
        event.node.res.statusCode = 304;
        return null;
      }
    }
  }

  const rows = await sql`
    SELECT id, title, action, keywords, body, severity,
           scope, match_logic, domain, active
    FROM rules
    WHERE user_id = ${username} AND active = 1
    ORDER BY updated_at DESC
  `;

  const rules = rows.map((r) => ({
    id:          r.id,
    title:       r.title,
    action:      r.action,
    keywords:    safeJsonParse(r.keywords as string, [] as string[]),
    body:        r.body,
    severity:    r.severity,
    scope:       r.scope,
    match_logic: r.match_logic,
    domain:      r.domain,
    active:      true,
  }));

  event.node.res.setHeader("Last-Modified", new Date().toUTCString());
  return rules;
});
