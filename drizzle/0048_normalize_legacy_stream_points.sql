-- Migration 0048: normaliza pontos de atividades `stream` legadas.
--
-- Contexto: a migration 0017_reward_kinds.sql intencionalmente
-- DEIXOU rows antigas de `stream` com 100 FP cada (a tabela
-- user_activities armazena os points no instante do INSERT, não
-- referencia fanpoint_rules em runtime). Migrations 0017+ e
-- fanpoint_rules.kind='stream' = 0 garantem que NOVOS streams
-- chegam com 0 FP, mas o histórico continuava inflacionando o
-- saldo via SUM.
--
-- Sintoma reportado: usuários com ~30.000 FP "do nada" — vinha de
-- ~300 plays legados × 100 FP = 30.000. As regras integradas
-- atuais não comportam tal velocidade de ganho.
--
-- Fix: zera o ponto de TODAS as rows `stream` que ainda têm
-- points > 0 (rows com points=0 já são do regime novo e ficam
-- iguais). As rows continuam existindo — só o score é
-- normalizado pra refletir a regra atual.
--
-- O three_streams (10 FP a cada 3 plays) NÃO é tocado — é a
-- única recompensa de listening que sobrevive no regime atual,
-- e tanto rows legadas quanto novas já têm o mesmo valor (10).
--
-- Idempotente: rodar novamente é no-op (após a primeira execução
-- não há mais stream rows com points > 0).
--
-- Ranking se recalcula automaticamente — o profile API usa
-- SUM(user_activities.points), então o saldo atualiza no
-- próximo fetch sem precisar mexer no cache.

UPDATE "user_activities"
   SET "points" = 0
 WHERE "kind"   = 'stream'
   AND "points" > 0;
