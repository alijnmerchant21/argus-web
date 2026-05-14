-- Run this once in your Neon / Vercel Postgres SQL editor
-- Vercel dashboard → Storage → your DB → Query

CREATE TABLE IF NOT EXISTS rules (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  severity    TEXT    NOT NULL DEFAULT 'medium',
  updated_at  BIGINT  NOT NULL
);
