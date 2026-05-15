/**
 * One-time migration. Run with:
 *   node scripts/migrate.mjs
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dep needed)
const envPath = resolve(__dirname, "../.env");
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.trim().split("=");
    if (key && rest.length) process.env[key] = rest.join("=");
  }
} catch {
  // .env not found — rely on real env vars
}

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const sql = neon(url);

async function run() {
  console.log("Running migration…");

  await sql`
    CREATE TABLE IF NOT EXISTS rules (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      action      TEXT NOT NULL DEFAULT 'block',
      keywords    TEXT NOT NULL DEFAULT '[]',
      body        TEXT NOT NULL DEFAULT '',
      severity    TEXT NOT NULL DEFAULT 'medium',
      updated_at  BIGINT NOT NULL
    )
  `;
  console.log("✓ rules table ready");

  // Safe no-op column adds in case table already existed without new cols
  await sql`ALTER TABLE rules ADD COLUMN IF NOT EXISTS action   TEXT NOT NULL DEFAULT 'block'`;
  await sql`ALTER TABLE rules ADD COLUMN IF NOT EXISTS keywords TEXT NOT NULL DEFAULT '[]'`;
  console.log("✓ action + keywords columns ready");

  // Phase 2 columns
  await sql`ALTER TABLE rules ADD COLUMN IF NOT EXISTS platforms   TEXT NOT NULL DEFAULT '["chatgpt","claude"]'`;
  await sql`ALTER TABLE rules ADD COLUMN IF NOT EXISTS scope       TEXT NOT NULL DEFAULT 'input'`;
  await sql`ALTER TABLE rules ADD COLUMN IF NOT EXISTS match_logic TEXT NOT NULL DEFAULT 'any'`;
  await sql`ALTER TABLE rules ADD COLUMN IF NOT EXISTS domain      TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE rules ADD COLUMN IF NOT EXISTS active      INTEGER NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE rules ADD COLUMN IF NOT EXISTS notes       TEXT NOT NULL DEFAULT ''`;
  console.log("✓ phase-2 columns ready");

  await sql`CREATE INDEX IF NOT EXISTS rules_user_id_idx ON rules(user_id)`;
  console.log("✓ index ready");

  console.log("\n✅ Migration complete.");
}

run().catch((e) => { console.error(e); process.exit(1); });
