-- ============================================================
-- HARDENING DE RLS / SEGURANÇA — Rank Hooper
-- ============================================================
-- Objetivo:
--   1) Bloquear TOTALMENTE usuários anônimos (sem login) de ler/escrever.
--   2) Esconder PII dos atletas (email + GPS) de qualquer leitura pelo cliente.
--   3) Exigir posse (dono) para alterar jogadores, jogos, partidas e rações.
--   4) Adicionar checagem de papel (role) nas RPCs de estatística.
--
-- COMO RODAR:
--   Cole no SQL Editor do Supabase e execute. DEPOIS de:
--     schema.sql, schema_tournaments.sql, migration_master.sql,
--     migration_racoes.sql   (cria as tabelas de rachões)
--
--   ⚠️ NÃO rode `migration_features_v2.sql` (redefine `get_ranking` com 5
--      argumentos → overload ambíguo com a versão de 4 args do schema).
--   ⚠️ NÃO rode `migration_cleanup.sql`: ele remove a tabela `auditoria_votos`
--      que `registrar_avaliacao` ainda usa e quebra a votação. Esta migration
--      já cobre a parte de RLS que o cleanup tentava corrigir.
--
-- Este script é IDEMPOTENTE: pode ser executado mais de uma vez.
--
-- Depois de aplicar, rode o frontend com as consultas atualizadas
-- (src/lib/supabase.js usa PROFILE_SAFE_COLUMNS em vez de select('*')).
-- ============================================================


-- ============================================================
-- PASSO 0 (opcional) — diagnóstico ANTES
-- ============================================================
-- select tablename, policyname, cmd, roles, qual
-- from pg_policies where schemaname = 'public' order by tablename, cmd;


-- ============================================================
-- PASSO 1 — LEITURAS: só para usuários LOGADOS (fim do acesso anônimo)
-- ============================================================
-- Todas as policies abaixo eram `FOR SELECT USING (TRUE)` sem cláusula TO,
-- o que valia para o papel `public` — incluindo `anon` (sem login).
-- Recriamos com `TO authenticated`. (DROP antes do CREATE → reexecutável.)

DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
CREATE POLICY profiles_select_auth ON public.profiles
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS jogadores_select_all ON public.jogadores;
DROP POLICY IF EXISTS jogadores_select_auth ON public.jogadores;
CREATE POLICY jogadores_select_auth ON public.jogadores
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS avaliacoes_select_all ON public.avaliacoes;
DROP POLICY IF EXISTS avaliacoes_select_auth ON public.avaliacoes;
CREATE POLICY avaliacoes_select_auth ON public.avaliacoes
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS campeoes_select_all ON public.campeoes_semana;
DROP POLICY IF EXISTS campeoes_select_auth ON public.campeoes_semana;
CREATE POLICY campeoes_select_auth ON public.campeoes_semana
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS jogos_select_all ON public.jogos;
DROP POLICY IF EXISTS jogos_select_auth ON public.jogos;
CREATE POLICY jogos_select_auth ON public.jogos
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS stats_select_all ON public.estatisticas_partida;
DROP POLICY IF EXISTS stats_select_auth ON public.estatisticas_partida;
CREATE POLICY stats_select_auth ON public.estatisticas_partida
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS partidas_select_all ON public.partidas;
DROP POLICY IF EXISTS partidas_select_auth ON public.partidas;
CREATE POLICY partidas_select_auth ON public.partidas
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS partida_jogadores_select_all ON public.partida_jogadores;
DROP POLICY IF EXISTS partida_jogadores_select_auth ON public.partida_jogadores;
CREATE POLICY partida_jogadores_select_auth ON public.partida_jogadores
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS torneios_select_all ON public.torneios;
DROP POLICY IF EXISTS torneios_select_auth ON public.torneios;
CREATE POLICY torneios_select_auth ON public.torneios
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS equipes_select_all ON public.equipes;
DROP POLICY IF EXISTS equipes_select_auth ON public.equipes;
CREATE POLICY equipes_select_auth ON public.equipes
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS equipe_jogadores_select_all ON public.equipe_jogadores;
DROP POLICY IF EXISTS equipe_jogadores_select_auth ON public.equipe_jogadores;
CREATE POLICY equipe_jogadores_select_auth ON public.equipe_jogadores
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS torneio_jogos_select_all ON public.torneio_jogos;
DROP POLICY IF EXISTS torneio_jogos_select_auth ON public.torneio_jogos;
CREATE POLICY torneio_jogos_select_auth ON public.torneio_jogos
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS torneio_estatisticas_jogadores_select_all ON public.torneio_estatisticas_jogadores;
DROP POLICY IF EXISTS torneio_estatisticas_jogadores_select_auth ON public.torneio_estatisticas_jogadores;
CREATE POLICY torneio_estatisticas_jogadores_select_auth ON public.torneio_estatisticas_jogadores
  FOR SELECT TO authenticated USING (TRUE);

-- Rações: tabelas criadas por `migration_racoes.sql`.
-- Só aplica se elas existirem (assim o hardening não falha se rações
-- ainda não tiverem sido criadas).
DO $$
BEGIN
  IF to_regclass('public.racoes') IS NOT NULL THEN
    DROP POLICY IF EXISTS racoes_select_all ON public.racoes;
    DROP POLICY IF EXISTS racoes_select_auth ON public.racoes;
    CREATE POLICY racoes_select_auth ON public.racoes
      FOR SELECT TO authenticated USING (TRUE);
  END IF;

  IF to_regclass('public.racao_participantes') IS NOT NULL THEN
    DROP POLICY IF EXISTS racao_part_select ON public.racao_participantes;
    DROP POLICY IF EXISTS racao_part_select_auth ON public.racao_participantes;
    CREATE POLICY racao_part_select_auth ON public.racao_participantes
      FOR SELECT TO authenticated USING (TRUE);
  END IF;
END $$;

-- auditoria_votos (IP/device/localização): ninguém lê pelo cliente.
-- Só `registrar_avaliacao` (SECURITY DEFINER) escreve. Sem policy = negado.
DROP POLICY IF EXISTS auditoria_select_all ON public.auditoria_votos;

-- Defesa em profundidade: tira QUALQUER privilégio de tabela do papel anônimo.
-- O app exige login para tudo, então isto não afeta nada legítimo.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;


-- ============================================================
-- PASSO 2 — PII: esconder `email` e colunas de GPS de `profiles`
-- ============================================================
-- Revogamos o SELECT da tabela inteira e concedemos apenas as colunas
-- seguras. Assim, mesmo um usuário logado não consegue ler o email nem
-- a localização exata de outro atleta. (O dono lê o próprio email pela
-- sessão de autenticação, não pela tabela.)
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name NOT IN (
      'email', 'latitude', 'longitude', 'latitude_atual', 'longitude_atual'
    );

  EXECUTE 'REVOKE SELECT ON public.profiles FROM authenticated';
  EXECUTE 'GRANT SELECT (' || cols || ') ON public.profiles TO authenticated';
END $$;


-- ============================================================
-- PASSO 3 — ESCRITAS: exigir posse (dono do registro)
-- ============================================================

-- 3.1 JOGADORES -------------------------------------------------
DROP POLICY IF EXISTS jogadores_insert_auth ON public.jogadores;
DROP POLICY IF EXISTS jogadores_insert_own ON public.jogadores;
CREATE POLICY jogadores_insert_own ON public.jogadores
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid() OR criado_por IS NULL);

DROP POLICY IF EXISTS jogadores_update_auth ON public.jogadores;
DROP POLICY IF EXISTS jogadores_update_own ON public.jogadores;
CREATE POLICY jogadores_update_own ON public.jogadores
  FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR criado_por IS NULL)
  WITH CHECK (criado_por = auth.uid() OR criado_por IS NULL);

-- 3.2 JOGOS -----------------------------------------------------
DROP POLICY IF EXISTS jogos_insert_auth ON public.jogos;
DROP POLICY IF EXISTS jogos_insert_own ON public.jogos;
CREATE POLICY jogos_insert_own ON public.jogos
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

DROP POLICY IF EXISTS jogos_update_auth ON public.jogos;
DROP POLICY IF EXISTS jogos_update_own ON public.jogos;
CREATE POLICY jogos_update_own ON public.jogos
  FOR UPDATE TO authenticated
  USING (criado_por = auth.uid())
  WITH CHECK (criado_por = auth.uid());

-- 3.3 PARTIDAS --------------------------------------------------
-- A tabela não tinha coluna de dono. Adicionamos com default = quem criou.
ALTER TABLE public.partidas
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id) DEFAULT auth.uid();

DROP POLICY IF EXISTS partidas_insert_auth ON public.partidas;
DROP POLICY IF EXISTS partidas_insert_own ON public.partidas;
CREATE POLICY partidas_insert_own ON public.partidas
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid() OR criado_por IS NULL);

DROP POLICY IF EXISTS partidas_update_auth ON public.partidas;
DROP POLICY IF EXISTS partidas_update_own ON public.partidas;
CREATE POLICY partidas_update_own ON public.partidas
  FOR UPDATE TO authenticated
  -- partidas antigas (criado_por NULL) continuam editáveis na transição;
  -- partidas novas ficam presas ao dono.
  USING (criado_por = auth.uid() OR criado_por IS NULL)
  WITH CHECK (criado_por = auth.uid() OR criado_por IS NULL);

-- 3.4 RAÇÕES ----------------------------------------------------
-- Antes: USING (criado_por = auth.uid() OR auth.role() = 'authenticated')
-- O `OR authenticated` liberava edição para QUALQUER logado. Removido.
DO $$
BEGIN
  IF to_regclass('public.racoes') IS NOT NULL THEN
    DROP POLICY IF EXISTS racoes_update_auth ON public.racoes;
    DROP POLICY IF EXISTS racoes_update_own ON public.racoes;
    CREATE POLICY racoes_update_own ON public.racoes
      FOR UPDATE TO authenticated
      USING (criado_por = auth.uid())
      WITH CHECK (criado_por = auth.uid());
  END IF;
END $$;


-- ============================================================
-- PASSO 4 — RPCs: checagem de papel + não expor execução ao anônimo
-- ============================================================

-- 4.1 get_master_stats: só master/admin
CREATE OR REPLACE FUNCTION public.get_master_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_users INTEGER;
  v_total_players INTEGER;
  v_total_matches INTEGER;
  v_total_tournaments INTEGER;
  v_total_ratings INTEGER;
  v_total_cities INTEGER;
  v_online_now INTEGER;
  v_new_30d INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('master', 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE cadastro_completo = TRUE;
  SELECT COUNT(*) INTO v_total_players FROM public.jogadores WHERE ativo = TRUE;
  SELECT COUNT(*) INTO v_total_matches FROM public.partidas;
  SELECT COUNT(*) INTO v_total_tournaments FROM public.torneios;
  SELECT COUNT(*) INTO v_total_ratings FROM public.avaliacoes;
  SELECT COUNT(DISTINCT cidade) INTO v_total_cities FROM public.profiles WHERE cidade IS NOT NULL AND cidade != '';
  SELECT COUNT(*) INTO v_online_now FROM public.profiles WHERE last_seen > NOW() - INTERVAL '5 minutes';
  SELECT COUNT(*) INTO v_new_30d FROM public.profiles WHERE created_at > NOW() - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'total_players', v_total_players,
    'total_matches', v_total_matches,
    'total_tournaments', v_total_tournaments,
    'total_ratings', v_total_ratings,
    'total_cities', v_total_cities,
    'online_now', v_online_now,
    'new_30d', v_new_30d
  );
END;
$$;

-- 4.2 get_city_stats: só master/admin
CREATE OR REPLACE FUNCTION public.get_city_stats()
RETURNS TABLE (
  cidade TEXT,
  user_count BIGINT,
  player_count BIGINT,
  tournament_count BIGINT,
  match_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('master', 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    p.cidade,
    COUNT(DISTINCT p.id) AS user_count,
    COUNT(DISTINCT j.id) AS player_count,
    COUNT(DISTINCT t.id) AS tournament_count,
    COUNT(DISTINCT m.id) AS match_count
  FROM public.profiles p
  LEFT JOIN public.jogadores j ON j.cidade = p.cidade AND j.ativo = TRUE
  LEFT JOIN public.torneios t ON t.cidade = p.cidade
  LEFT JOIN public.partidas m ON m.cidade = p.cidade
  WHERE p.cadastro_completo = TRUE AND p.cidade IS NOT NULL AND p.cidade != ''
  GROUP BY p.cidade
  ORDER BY user_count DESC;
END;
$$;

-- 4.3 Anônimo não executa NENHUMA função do schema public.
-- (As funções eram concedidas a PUBLIC por padrão; isso inclui `anon`.)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;


-- ============================================================
-- PASSO 5 — VERIFICAÇÃO (rode depois; não é alteração)
-- ============================================================
-- 5.1 As policies de SELECT agora devem mostrar roles = {authenticated}
-- select tablename, policyname, cmd, roles, qual
-- from pg_policies where schemaname = 'public' and cmd = 'SELECT'
-- order by tablename;
--
-- 5.2 Privilégios de coluna de profiles (email/GPS NÃO devem aparecer):
-- select column_name, privilege_type
-- from information_schema.column_privileges
-- where grantee = 'authenticated' and table_name = 'profiles'
-- order by column_name;
--
-- 5.3 Teste como anônimo (deve retornar [] ou erro 401/403):
--   curl "https://SEU_PROJETO.supabase.co/rest/v1/jogadores?select=*&limit=3" \
--     -H "apikey: SUA_ANON_KEY" -H "Authorization: Bearer SUA_ANON_KEY"
--
-- 5.4 Teste lendo email como logado (deve falhar por permissão):
--   curl "https://SEU_PROJETO.supabase.co/rest/v1/profiles?select=email&limit=3" \
--     -H "apikey: SUA_ANON_KEY" -H "Authorization: Bearer SEU_ACCESS_TOKEN"
-- ============================================================
