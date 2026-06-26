-- Produtos: quantidade disponível (estoque).
--
-- Para não vender além do que existe, cada produto pode ter um estoque
-- finito. `quantity_available`:
--   NULL    → ilimitado (sem controle de estoque) — comportamento dos
--             produtos já existentes, que não tinham a coluna;
--   número  → unidades restantes (0 = esgotado).
--
-- Idempotente: pode rodar onde a coluna já exista.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "quantity_available" integer;
