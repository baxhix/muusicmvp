-- Migration 0012: pre-configure PostHog with the production
-- project token (project 424506, US Cloud).
--
-- Same idempotent upsert pattern used by 0011 (Clarity): the admin
-- can rotate the token via /admin/settings → Tags later without
-- needing another migration. Recording the seed in version control
-- means staging / preview / fresh-DB deploys all come up with
-- product analytics already on.

INSERT INTO "site_tags" ("kind", "value", "enabled")
VALUES ('posthog', 'phc_nF5RFX6ZUgV7tLtkq3qZgw5NERQKcmJySwM9uSrq4cJY', true)
ON CONFLICT ("kind") DO UPDATE
SET
  "value"      = EXCLUDED."value",
  "enabled"    = EXCLUDED."enabled",
  "updated_at" = now();
