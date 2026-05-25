-- Backfill: anonimiza emails de users soft-deleted ANTES da
-- migração 0032_notification_overrides + fix do softDelete.ts
-- que passou a anonimizar no momento da exclusão.
--
-- Antes do fix, soft-delete só setava deleted_at e o email
-- original ficava preso pela UNIQUE constraint — impedia que o
-- mesmo email criasse uma nova conta. Esta migração liberta esses
-- emails reescrevendo-os pro formato canônico
-- `<userId>@deleted.muusic.live` (mesma forma que softDeleteUser
-- usa agora).
--
-- Idempotente: NOT LIKE garante que rows já anonimizadas (por
-- chamadas recentes ao softDeleteUser pós-fix) não são tocadas.

UPDATE users
SET email = id::text || '@deleted.muusic.live'
WHERE deleted_at IS NOT NULL
  AND email NOT LIKE '%@deleted.muusic.live';
