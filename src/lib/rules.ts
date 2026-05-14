import { createServerFn } from "@tanstack/react-start";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

function getDb() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set. Add a Neon or Vercel Postgres database.");
  return neon(url);
}

export type Rule = {
  id: string;
  title: string;
  body: string;
  severity: string;
  updated_at: number;
};

export const getRulesFn = createServerFn({ method: "GET" }).handler(async () => {
  const sql = getDb();
  const rows = await sql`SELECT id, title, body, severity, updated_at FROM rules ORDER BY updated_at DESC`;
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
    const sql = getDb();
    const now = Date.now();
    if (data.id) {
      await sql`
        UPDATE rules SET title = ${data.title}, body = ${data.body}, severity = ${data.severity}, updated_at = ${now}
        WHERE id = ${data.id}
      `;
      return { id: data.id };
    }
    const rows = await sql`
      INSERT INTO rules (title, body, severity, updated_at)
      VALUES (${data.title}, ${data.body}, ${data.severity}, ${now})
      RETURNING id
    `;
    return { id: (rows[0] as { id: string }).id };
  });

export const deleteRuleFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = getDb();
    await sql`DELETE FROM rules WHERE id = ${data.id}`;
  });
