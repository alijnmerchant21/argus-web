import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  corsHeaders,
  ensureAIInteractionsTable,
  getDb,
  jsonError,
  requireApiKey,
} from "@/lib/extension-api";

const ROUTE_METHODS = "POST, OPTIONS";

const interactionSchema = z.object({
  side: z.enum(["input", "output"]),
  platform: z.string().default(""),
  url: z.string().max(4000).default(""),
  content: z.string().min(1).max(20000),
  created_at: z.number().int().positive(),
});

const bodySchema = z.object({
  interactions: z.array(interactionSchema).min(1).max(100),
});

export const Route = createFileRoute("/api/interactions")({
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

        await ensureAIInteractionsTable();
        const sql = getDb();
        let accepted = 0;
        for (const entry of parsed.interactions) {
          await sql`
            INSERT INTO ai_interactions
              (api_key, user_id, side, platform, url, content, created_at)
            VALUES
              (${auth.apiKey}, ${auth.username}, ${entry.side}, ${entry.platform},
               ${entry.url}, ${entry.content}, ${entry.created_at})
          `;
          accepted++;
        }

        return Response.json({ accepted }, { headers: corsHeaders(ROUTE_METHODS) });
      },
    },
  },
});
