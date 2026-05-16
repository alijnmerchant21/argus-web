-- Argus — canonical DB schema
-- Run once in your Neon SQL editor, or use scripts/migrate.mjs (preferred).
-- This file is the source of truth for documentation and fresh DB setups.
-- Last updated: phase 3 (api_keys + logs)

-- ── rules ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rules (
  id          TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  action      TEXT    NOT NULL DEFAULT 'block',     -- block | warn | flag
  keywords    TEXT    NOT NULL DEFAULT '[]',         -- JSON string[]
  body        TEXT    NOT NULL DEFAULT '',           -- message shown to user
  severity    TEXT    NOT NULL DEFAULT 'medium',     -- low | medium | high
  platforms   TEXT    NOT NULL DEFAULT '["chatgpt","claude"]', -- JSON string[]
  scope       TEXT    NOT NULL DEFAULT 'input',      -- input | output | both
  match_logic TEXT    NOT NULL DEFAULT 'any',        -- any | all
  domain      TEXT    NOT NULL DEFAULT '',           -- e.g. "Medical", "Legal"
  active      INTEGER NOT NULL DEFAULT 1,            -- 1 = active, 0 = inactive
  notes       TEXT    NOT NULL DEFAULT '',           -- internal notes, not shown to users
  updated_at  BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS rules_user_id_idx ON rules(user_id);

-- ── api_keys ─────────────────────────────────────────────────────────────────
-- One API key per user. Used by the Chrome extension (Bearer token auth).
-- NOTE: stored in plaintext for V1 (allows showing key in dashboard UI).
-- TODO (V2): hash with SHA-256, one-time reveal on generation only.

CREATE TABLE IF NOT EXISTS api_keys (
  username    TEXT   PRIMARY KEY,
  api_key     TEXT   NOT NULL UNIQUE,  -- format: argus_<64 hex chars>
  created_at  BIGINT NOT NULL
);

-- ── logs ─────────────────────────────────────────────────────────────────────
-- Every rule trigger event sent from the Chrome extension.

CREATE TABLE IF NOT EXISTS logs (
  id           TEXT   PRIMARY KEY DEFAULT gen_random_uuid()::text,
  api_key      TEXT   NOT NULL,          -- which key submitted this log
  rule_id      TEXT   NOT NULL,          -- FK → rules.id
  rule_title   TEXT   NOT NULL DEFAULT '',
  action       TEXT   NOT NULL,          -- block | warn | flag
  matched_kw   TEXT   NOT NULL DEFAULT '',
  platform     TEXT   NOT NULL DEFAULT '', -- chatgpt | claude | gemini
  prompt_text  TEXT   NOT NULL DEFAULT '', -- full prompt text (MVP: plaintext)
  created_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS logs_api_key_idx    ON logs(api_key);
CREATE INDEX IF NOT EXISTS logs_rule_id_idx    ON logs(rule_id);
CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs(created_at DESC);
