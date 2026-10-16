-- ============================================================
-- ⚠️  ARQUIVO OBSOLETO — NÃO EXECUTE
-- ============================================================
-- Este arquivo foi SUBSTITUÍDO por `migration_racoes.sql`.
--
-- Motivos para não executá-lo:
--
--   1) Ele define `get_ranking` com 5 argumentos (p_posicao), criando um
--      OVERLOAD ambíguo com a versão de 4 argumentos do `schema.sql`.
--      O app chama `get_ranking(p_cidade, p_uf, p_limit, p_esporte)` —
--      com as duas versões presentes o PostgREST não consegue escolher e o
--      ranking quebra (item A2 do docs/AUDITORIA.md).
--
--   2) As policies de rações usavam `USING (TRUE)` sem cláusula TO, o que
--      vale para o papel `public` — incluindo usuários ANÔNIMOS. Executá-lo
--      depois do hardening reabriria a leitura pública das rações.
--
-- PARA CRIAR OS RACHÕES, use:
--     supabase/migration_racoes.sql
--   (somente rachões, sem mexer no get_ranking, já com RLS endurecida).
--
-- Este arquivo é mantido apenas como histórico/referência.
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE 'migration_features_v2.sql é obsoleto. Use migration_racoes.sql.';
END $$;
