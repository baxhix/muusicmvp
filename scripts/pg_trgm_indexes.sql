-- ARQUIVO OPT-IN — NÃO É APLICADO AUTOMATICAMENTE PELO DRIZZLE.
--
-- Para rodar:
--   psql "$DATABASE_URL" -f scripts/pg_trgm_indexes.sql
--
-- Por que está aqui e não em `drizzle/`: `CREATE EXTENSION pg_trgm`
-- exige privilégio de superuser em vários setups Postgres. Se o
-- role da app não tiver, o drizzle-migrator aborta a sequência de
-- migrations e nenhuma migration futura roda (mesmo padrão do
-- incidente 0025_users_soft_delete). Em AWS RDS o master user tem
-- o privilégio nativo; em VPS depende do setup.
--
-- Quando aplicar:
--   - **Hoje (VPS Hostinger)**: rode manualmente SE/QUANDO precisar.
--     Com tabelas pequenas (< 5k rows) o ganho é irrelevante e o
--     ILIKE faz seq scan rápido mesmo. Pode esperar.
--   - **Migração AWS**: rodar logo após o `pg_dump | pg_restore`
--     no RDS. Lá o CREATE EXTENSION funciona com o role master
--     padrão sem ajustes.
--
-- pg_trgm + GIN indexes nas colunas ILIKE do admin e busca pública.
--
-- Por quê: queries `WHERE col ILIKE '%foo%'` fazem sequential scan
-- (índice B-tree não cobre wildcard à esquerda). Em tabelas pequenas
-- é ms; quando passa de ~10k rows, vira segundos e o admin trava.
-- pg_trgm + GIN resolve em sub-50ms até milhões de rows.
--
-- RDS-compatible: AWS RDS Postgres aceita `pg_trgm` como managed
-- extension (Postgres ≥ 9.6). Quando migrar pra AWS, basta restore
-- do dump — extension e índices viajam junto, zero refactor no dev
-- backend.
--
-- Idempotente: `IF NOT EXISTS` em tudo. Safe pra rodar em prod
-- sem coordenação.
--
-- Impacto em write: cada INSERT/UPDATE em coluna indexada paga
-- ~10-20µs a mais pra atualizar o GIN. Insignificante comparado
-- ao ganho do read.

-- 1) Extensão (cria se não existe; idempotente).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) Índices GIN nas colunas ILIKE identificadas no audit.
--    `gin_trgm_ops` é o operator class que casa com ILIKE `%foo%`.
--    `CONCURRENTLY` evita lock pesado em tabelas grandes — mas
--    drizzle migrator não suporta CONCURRENTLY (precisa fora de
--    transação). Aceitamos lock de write por alguns segundos:
--    em tabelas pequenas (estado atual) é imperceptível; quando
--    a base crescer e o lock for visível, rodar manualmente via
--    psql com CONCURRENTLY (versão sem `_idx` no final, drizzle
--    ignora).

-- users (admin: busca por nome/email)
CREATE INDEX IF NOT EXISTS users_name_trgm_idx
  ON users USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_email_trgm_idx
  ON users USING GIN (email gin_trgm_ops);

-- communities (busca pública + admin)
CREATE INDEX IF NOT EXISTS communities_name_trgm_idx
  ON communities USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS communities_description_trgm_idx
  ON communities USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS communities_slug_trgm_idx
  ON communities USING GIN (slug gin_trgm_ops);

-- community_topics (busca pública + admin)
CREATE INDEX IF NOT EXISTS community_topics_title_trgm_idx
  ON community_topics USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS community_topics_body_trgm_idx
  ON community_topics USING GIN (body gin_trgm_ops);

-- feed_posts (admin de feed)
CREATE INDEX IF NOT EXISTS feed_posts_title_trgm_idx
  ON feed_posts USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS feed_posts_description_trgm_idx
  ON feed_posts USING GIN (description gin_trgm_ops);
