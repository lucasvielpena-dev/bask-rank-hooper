-- ============================================================
-- SEGURANÇA v3 — fecha o que o hardening deixou passar
-- ============================================================
-- Aplicar DEPOIS de: schema.sql, schema_tournaments.sql,
-- migration_master.sql, migration_racoes.sql, migration_rls_hardening.sql.
--
-- POR QUE ESTE ARQUIVO EXISTE (auditoria de 17/10/2026)
--   O que estava BOM (verificado no banco de produção):
--     * Anônimo não lê NENHUMA tabela (42501 em todas).
--     * `email` e GPS de `profiles` escondidos de quem está logado
--       (o Passo 2 do hardening rodou).
--     * `avaliacoes_jogo` fechada; notas de jogo anônimas de verdade.
--     * Nenhuma view, nenhum bucket público, RLS ligada em todas as tabelas.
--
--   O que estava ABERTO:
--     A) O hardening tentou bloquear funções com
--        `REVOKE EXECUTE ON ALL FUNCTIONS ... FROM PUBLIC`.
--        Só que o Supabase concede EXECUTE **explicitamente ao papel
--        `anon`** quando cria a função — então aquele revoke não tirava
--        nada do anônimo. Resultado: o anônimo executava quase toda RPC.
--
--     B) Entre essas RPCs estava `rotina_semanal_domingo()`: é SECURITY
--        DEFINER, sem guarda nenhuma, e faz `media_estrelas = media_estrelas
--        * 0,9` em TODOS os atletas + zera `votos_semana` + grava campeão.
--        Ou seja: qualquer pessoa, SEM LOGIN, com a chave pública que está
--        no bundle do site, podia zerar o ranking chamando essa RPC em loop.
--
--     C) Qualquer usuário logado podia virar `master` de graça: a policy
--        `profiles_update_own` só exige `auth.uid() = id`, e `role` é uma
--        coluna comum da mesma linha. Feito isso, o painel admin inteiro
--        abre — inclusive `admin_get_users()`, que devolve o **email de
--        todo mundo**, e `admin_delete_user()`.
--
--     D) `avaliacoes` era legível linha por linha por qualquer logado,
--        com `avaliador_id` e `comentario` — dava para montar "quem votou
--        em quem, com que nota". O app só precisa ler as PRÓPRIAS
--        avaliações (Atletas.jsx e PlayerProfileModal.jsx filtram por
--        `avaliador_id = user.id`), então dá para restringir sem quebrar.
--
-- Idempotente: pode rodar mais de uma vez. Rode no SQL Editor do Supabase.
-- ============================================================


-- ============================================================
-- PASSO 1 — ANÔNIMO NÃO EXECUTA NENHUMA FUNÇÃO
-- ============================================================
-- `FROM PUBLIC` sozinho não resolve (o Supabase concede EXECUTE direto
-- para `anon`). Precisa revogar do `anon` nominalmente — e também deixar
-- isso valendo para as funções que ainda forem criadas
-- (ALTER DEFAULT PRIVILEGES).
--
-- Não concedemos nada a `authenticated`: ele já tem o que precisa (foi
-- concedido na criação de cada função, e CREATE OR REPLACE não mexe em
-- privilégio). Fazer um `GRANT ... TO authenticated` genérico aqui seria
-- pior: devolveria para o logado funções que hoje são só internas
-- (`recalcular_media_jogador`, `notificar_realtime`, `salvar_nota_jogo`...).

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;


-- ============================================================
-- PASSO 2 — ROTINA SEMANAL FORA DE ALCANCE
-- ============================================================
-- (a) ninguém pelo cliente executa — nem logado;
-- (b) o corpo ganha uma guarda, para o caso de alguém reconceder isso no
--     futuro. O agendador (pg_cron / service_role) roda sem JWT, então
--     `auth.uid()` é NULL e a rotina passa normalmente.

REVOKE ALL ON FUNCTION public.rotina_semanal_domingo() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rotina_semanal_domingo()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campeao RECORD;
  v_semana_inicio DATE;
  v_semana_fim DATE;
BEGIN
  -- GUARDA: só o agendador. Usuário comum (com JWT) não dispara a rotina.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Rotina semanal: execução apenas pelo agendador.';
  END IF;

  v_semana_fim := CURRENT_DATE;
  v_semana_inicio := CURRENT_DATE - INTERVAL '6 days';

  -- A. Identificar o campeão (1º lugar no ranking - mínimo 5 votos)
  SELECT id, nome, media_estrelas, total_votos
  INTO v_campeao
  FROM public.jogadores
  WHERE ativo = TRUE AND total_votos >= 5
  ORDER BY media_estrelas DESC, total_votos DESC
  LIMIT 1;

  IF v_campeao IS NOT NULL THEN
    -- A. Registrar na tabela de histórico
    INSERT INTO public.campeoes_semana (jogador_id, nome_jogador, media_estrelas, total_votos, semana_inicio, semana_fim)
    VALUES (v_campeao.id, v_campeao.nome, v_campeao.media_estrelas, v_campeao.total_votos, v_semana_inicio, v_semana_fim);

    -- B. Remover atual_campeao de todos e ativar apenas no novo campeão
    UPDATE public.jogadores SET atual_campeao = FALSE WHERE atual_campeao = TRUE;
    UPDATE public.jogadores SET atual_campeao = TRUE WHERE id = v_campeao.id;
  END IF;

  -- C. Reset técnico: reduzir 10% na média de estrelas de todos os jogadores
  UPDATE public.jogadores
  SET
    media_estrelas = ROUND(media_estrelas * 0.9, 2),
    soma_estrelas = ROUND(soma_estrelas * 0.9)::INTEGER,
    updated_at = NOW()
  WHERE ativo = TRUE;

  -- D. Zerar votos_semana (manter total_votos histórico intacto)
  UPDATE public.jogadores
  SET votos_semana = 0, updated_at = NOW()
  WHERE ativo = TRUE;

  RAISE LOG 'Rotina semanal executada com sucesso em %', NOW();
END;
$$;

-- De novo, porque CREATE OR REPLACE preserva privilégios mas não custa garantir.
REVOKE ALL ON FUNCTION public.rotina_semanal_domingo() FROM PUBLIC, anon, authenticated;


-- ============================================================
-- PASSO 3 — ANTI-ESCALADA: ninguém se promove a "master"
-- ============================================================
-- A policy de UPDATE do próprio perfil continua valendo (o app edita
-- apelido, foto, cidade, altura...), mas `role` e `is_active` passam a ser
-- campos protegidos por gatilho.
--
-- Regras:
--   * sem JWT (service_role/cron) -> passa;
--   * se `role`/`is_active` não mudaram -> passa (99% das atualizações);
--   * mudou o próprio papel/status -> bloqueado (evita autopromoção e
--     também evita o master se rebaixar e travar o app);
--   * só `master` altera papel/status de outra pessoa (é o mesmo que as
--     RPCs admin_set_user_role / admin_toggle_user_active já exigem).

CREATE OR REPLACE FUNCTION public.proteger_campos_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;

  IF NEW.id = auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido alterar o próprio papel ou status.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'
  ) THEN
    RAISE EXCEPTION 'Apenas o master pode alterar papel ou status de usuário.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_campos_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_proteger_campos_admin ON public.profiles;
CREATE TRIGGER trg_proteger_campos_admin
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_admin();


-- ============================================================
-- PASSO 4 — AVALIAÇÃO ANÔNIMA DE VERDADE
-- ============================================================
-- Antes: `avaliacoes_select_auth USING (TRUE)` -> qualquer logado lia a
-- tabela inteira, incluindo `avaliador_id`, `nota` e `comentario`.
-- Agora: cada um lê apenas as PRÓPRIAS avaliações (é o que o app usa para
-- saber em quem já votou e para pré-preencher as estrelas).
--
-- Os agregados que aparecem nas telas vêm de `jogadores.media_*`, que é
-- recalculado por trigger SECURITY DEFINER (`atualizar_media_jogador`),
-- então nada quebra.

DROP POLICY IF EXISTS avaliacoes_select_auth ON public.avaliacoes;
DROP POLICY IF EXISTS avaliacoes_select_own ON public.avaliacoes;
CREATE POLICY avaliacoes_select_own ON public.avaliacoes
  FOR SELECT TO authenticated USING (avaliador_id = auth.uid());


-- ============================================================
-- PASSO 5 — ✅ APLICADO em 2026-10-17 (backfill + policy estrita)
-- ============================================================
-- `jogadores` e `partidas` aceitavam UPDATE de qualquer logado quando
-- `criado_por IS NULL` (cláusula de transição do hardening). Atletas
-- antigos sem dono ficavam, portanto, editáveis por qualquer um — inclusive
-- `media_estrelas`. O backfill abaixo liga cada atleta antigo ao usuário do
-- perfil que aponta para ele; depois disso o dono passa a ser exigido.
--
-- ⚠️ O código abaixo JÁ FOI EXECUTADO no banco de produção (conferido no
-- `pg_policy`: `jogadores_update_own` com USING e WITH CHECK ambos
-- `(criado_por = auth.uid())`). Fica comentado só como registro do que foi
-- feito. Atleta sem perfil vinculado passa a poder ser editado apenas pelo
-- master / pelo SQL Editor.

-- UPDATE public.jogadores j
-- SET criado_por = p.id
-- FROM public.profiles p
-- WHERE p.player_id = j.id AND j.criado_por IS NULL;
--
-- DROP POLICY IF EXISTS jogadores_update_own ON public.jogadores;
-- CREATE POLICY jogadores_update_own ON public.jogadores
--   FOR UPDATE TO authenticated
--   USING (criado_por = auth.uid())
--   WITH CHECK (criado_por = auth.uid());


-- ============================================================
-- VERIFICAÇÃO (rode depois; deve vir tudo `false`, exceto o último)
-- ============================================================
select
  has_table_privilege('anon', 'public.profiles', 'SELECT')                                 as anon_le_profiles,        -- false
  has_function_privilege('anon', 'public.rotina_semanal_domingo()', 'EXECUTE')             as anon_roda_rotina,        -- false
  has_function_privilege('anon', 'public.admin_get_users(text)', 'EXECUTE')                as anon_admin_get_users,    -- false
  has_function_privilege('anon', 'public.get_ranking(text,text,integer,text)', 'EXECUTE')  as anon_get_ranking,        -- false
  has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT')              as logado_le_email,         -- false
  has_column_privilege('authenticated', 'public.profiles', 'latitude', 'SELECT')           as logado_le_latitude,      -- false
  has_function_privilege('authenticated', 'public.touch_last_seen()', 'EXECUTE')           as logado_usa_last_seen;    -- true (o app precisa)
