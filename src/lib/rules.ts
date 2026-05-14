import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

function getDb() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set. Add it to your environment variables.");
  return neon(url);
}

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"] ?? "argus-dev-secret-change-me-in-prod!!",
    name: "argus-session",
  };
}

async function getCurrentUserId(): Promise<string> {
  const session = await useSession<{ username: string }>(sessionConfig());
  const userId = session.data.username;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export type Rule = {
  id: string;
  title: string;
  body: string;
  severity: string;
  updated_at: number;
  user_id: string;
};

export const getRulesFn = createServerFn({ method: "GET" }).handler(async () => {
  const [sql, userId] = await Promise.all([Promise.resolve(getDb()), getCurrentUserId()]);
  const rows = await sql`
    SELECT id, title, body, severity, updated_at, user_id
    FROM rules
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return rows as Rule[];
});

export const saveRuleFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().optional(),
      title: z.string().min(1),
      body: z.string().min(1),
      severity: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const [sql, userId] = await Promise.all([Promise.resolve(getDb()), getCurrentUserId()]);
    const now = Date.now();

    if (data.id) {
      await sql`
        UPDATE rules
        SET title = ${data.title}, body = ${data.body}, severity = ${data.severity}, updated_at = ${now}
        WHERE id = ${data.id} AND user_id = ${userId}
      `;
      return { id: data.id };
    }

    const rows = await sql`
      INSERT INTO rules (title, body, severity, updated_at, user_id)
      VALUES (${data.title}, ${data.body}, ${data.severity}, ${now}, ${userId})
      RETURNING id
    `;
    return { id: (rows[0] as { id: string }).id };
  });

export const deleteRuleFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [sql, userId] = await Promise.all([Promise.resolve(getDb()), getCurrentUserId()]);
    await sql`DELETE FROM rules WHERE id = ${data.id} AND user_id = ${userId}`;
  });
