-- Migration 0011: pre-configure Microsoft Clarity with the project
-- ID that should ship enabled by default.
--
-- The Tags admin module (/admin/settings → Tags) can later override
-- this value, pause it, or rotate the ID without another migration.
-- Recording the seed here keeps the config in version control + makes
-- fresh-database deploys (staging, preview branches) come up with
-- analytics already on.
--
-- Idempotent: on existing rows, only the value/enabled are bumped —
-- updated_at + updated_by_id stay attributed to whoever last edited
-- via the admin UI. On a missing row, we INSERT a fresh one.

INSERT INTO "site_tags" ("kind", "value", "enabled")
VALUES ('clarity', 'wqiccggb1t', true)
ON CONFLICT ("kind") DO UPDATE
SET
  "value"   = EXCLUDED."value",
  "enabled" = EXCLUDED."enabled",
  -- Touch updated_at so the admin "Editado X atrás" reflects the
  -- bootstrap, but DON'T overwrite the audit author — let it stay
  -- NULL (system) or whatever the previous admin edit set.
  "updated_at" = now();
