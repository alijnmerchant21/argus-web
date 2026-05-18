import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { corsHeaders, getDb, jsonError, requireApiKey } from "@/lib/extension-api";

const ROUTE_METHODS = "POST, OPTIONS";

const logEntrySchema = z.object({
  rule_id: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  rule_title: z.string().default(""),
  action: z.enum(["block", "warn", "flag"]),
  matched_kw: z.string().default(""),
  platform: z.string().default(""),
  prompt_text: z.string().max(20000).default(""),
  created_at: z.number().int().positive(),
});

const bodySchema = z.object({
  logs: z.array(logEntrySchema).min(1).max(100),
});

export const Route = createFileRoute("/api/logs")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders(ROUTE_METHODS) }),
      POST: async ({ request }) => {
        const auth = await requireApiKey(request, ROUTE_METHODS);
        if (auth instanceof Response) return auth;

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return jsonError("Invalid request body", 400, ROUTE_METHODS);
        }

        const sql = getDb();
        const ids = [...new Set(parsed.logs.map((l) => l.rule_id))];
        const owned = await sql`
          SELECT id FROM rules WHERE user_id = ${auth.username} AND id::text = ANY(${ids}::text[])
        `;
        const ownedIds = new Set((owned as { id: string }[]).map((r) => String(r.id).trim()));

        let accepted = 0;
        for (const entry of parsed.logs) {
          if (!ownedIds.has(entry.rule_id)) continue;
          await sql`
            INSERT INTO logs
              (api_key, rule_id, rule_title, action, matched_kw, platform, prompt_text, created_at)
            VALUES
              (${auth.apiKey}, ${entry.rule_id}, ${entry.rule_title}, ${entry.action},
               ${entry.matched_kw}, ${entry.platform}, ${entry.prompt_text}, ${entry.created_at})
          `;
          accepted++;
        }

        return Response.json({ accepted }, { headers: corsHeaders(ROUTE_METHODS) });
      },
    },
  },
});
