-- ============================================================
--  LIMPEZA TOTAL DOS DADOS ESPORTIVOS  (pre-lancamento)
-- ============================================================
--  O QUE ESTE SCRIPT FAZ
--    Apaga TODOS os dados esportivos, deixando o app zerado para
--    receber os atletas e avaliacoes de verdade:
--      jogadores, votos (estrelas), avaliacoes (A+/A/B/C/D-F),
--      notas de jogo, auditoria de votos, partidas e estatisticas,
--      campeoes da semana, rachoes, torneios/equipes, denuncias,
--      notificacoes e estatisticas pessoais.
--    Depois apaga as CONTAS DE LOGIN de teste, mantendo apenas as
--    contas listadas na lista _manter (a sua, de master).
--
--  O QUE ELE NAO TOCA
--    - O perfil (nome, apelido, foto, altura, cidade) das contas
--      mantidas: so zera is_player / player_id / reputacao
--    - admin_logs (historico de auditoria)
--    - Tabelas, funcoes, RLS e agendamentos: o esquema fica intacto
--
--  ROBUSTO A TABELA AUSENTE
--    O script confere information_schema antes de cada DELETE e
--    usa to_regclass() nas contagens. Se alguma tabela nao existir
--    neste banco (ex.: realtime_pings), ela e simplesmente pulada
--    em vez de derrubar a transacao.
--
--  COMO RODAR (SQL Editor do Supabase)
--    1. BLOCO 0 -> previa, so leitura. Confira os numeros e o
--       papel (role) da sua conta.
--    2. BLOCO 1 -> a limpeza. E UMA TRANSACAO: se qualquer coisa
--       falhar (inclusive a trava dos e-mails), NADA e apagado.
--    3. BLOCO 2 -> conferencia. Tudo em 0, menos contas/perfis.
--
--  ATENCAO: NAO TEM VOLTA. Se quiser guardar algo antes, exporte
--  as tabelas em Table Editor -> (tabela) -> Export as CSV.
-- ============================================================


-- ============================================================
--  BLOCO 0 — PREVIA  (rode primeiro; nao apaga nada)
-- ============================================================
-- Contador que devolve NULL quando a tabela nao existe neste banco.
CREATE OR REPLACE FUNCTION pg_temp.conta(p_tabela TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  IF to_regclass('public.' || p_tabela) IS NULL THEN
    RETURN NULL;   -- tabela nao existe aqui: nao e erro
  END IF;
  EXECUTE format('SELECT count(*) FROM public.%I', p_tabela) INTO v_total;
  RETURN v_total;
END $$;

SELECT t.tabela, pg_temp.conta(t.tabela) AS registros
FROM (VALUES
  ('jogadores'),
  ('avaliacoes'),                       -- nota A+/A/B/C/D-F
  ('avaliacoes_jogo'),                  -- nota do jogo
  ('votos'),                            -- estrelas
  ('votos_diarios'),                    -- antifraude
  ('auditoria_votos'),
  ('campeoes_semana'),
  ('partidas'),
  ('partida_jogadores'),
  ('jogos'),                            -- legado
  ('estatisticas_partida'),             -- legado
  ('racoes'),                           -- rachoes
  ('racao_participantes'),
  ('torneios'),
  ('equipes'),
  ('equipe_jogadores'),
  ('torneio_jogos'),
  ('torneio_estatisticas_jogadores'),
  ('denuncias'),
  ('notificacoes'),
  ('estatisticas_pessoais'),
  ('realtime_pings')
) AS t(tabela)
ORDER BY t.tabela;

-- Contas e perfis (numeros separados porque essas tabelas sempre existem):
SELECT 'CONTAS (auth.users)' AS tabela, count(*) FROM auth.users
UNION ALL
SELECT 'PERFIS (profiles)', count(*) FROM public.profiles;

-- Quem existe hoje. A SUA conta precisa aparecer aqui com role = 'master':
SELECT p.nome_completo, p.apelido, p.email, p.role, p.is_active, p.created_at
FROM public.profiles p
ORDER BY p.created_at;


-- ============================================================
--  BLOCO 1 — A LIMPEZA  (uma transacao: tudo ou nada)
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
--  1.1  QUEM SOBREVIVE
--       Pode ter quantos e-mails quiser (um por linha). Use
--       exatamente o e-mail que apareceu no BLOCO 0.
-- ------------------------------------------------------------
CREATE TEMP TABLE _manter (email TEXT) ON COMMIT DROP;

INSERT INTO _manter (email) VALUES
  ('lucasvielpena@gmail.com')                -- <<< conta master preservada
  -- ,('colega@exemplo.com')                 -- <<< descomente se quiser manter mais alguem
;

CREATE TEMP TABLE _manter_id ON COMMIT DROP AS
SELECT p.id, p.email, p.role
FROM public.profiles p
JOIN _manter m ON lower(m.email) = lower(p.email);

-- ------------------------------------------------------------
--  1.2  TRAVA DE SEGURANCA
--       Se algum e-mail da lista nao existir, ABORTA sem apagar
--       nada. E o que impede o desastre de apagar a conta master
--       por um e-mail escrito errado.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_listados INT;
  v_achados  INT;
  v_contas   INT;
  v_faltando TEXT;
BEGIN
  SELECT count(*) INTO v_listados FROM _manter;
  SELECT count(*) INTO v_achados  FROM _manter_id;
  SELECT count(*) INTO v_contas   FROM auth.users;

  SELECT string_agg(m.email, ', ') INTO v_faltando
  FROM _manter m
  WHERE NOT EXISTS (
    SELECT 1 FROM _manter_id i WHERE lower(i.email) = lower(m.email)
  );

  IF v_listados = 0 THEN
    RAISE EXCEPTION 'ABORTADO: a lista _manter esta vazia. Escreva o seu e-mail na secao 1.1.';
  END IF;

  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTADO: nao existe conta para: %. Corrija o e-mail na secao 1.1 (use o que apareceu no BLOCO 0).', v_faltando;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM _manter_id WHERE role IN ('master', 'admin')) THEN
    RAISE NOTICE 'AVISO: nenhuma conta preservada e master/admin. Veja o ANEXO no fim do arquivo.';
  END IF;

  RAISE NOTICE 'Trava OK -> preserva % conta(s); apaga % conta(s) de teste.', v_achados, v_contas - v_achados;
END $$;

-- ------------------------------------------------------------
--  1.3  DADOS ESPORTIVOS
--       Ordem importa: filhas antes das maes. Duas tabelas
--       (campeoes_semana e estatisticas_partida) tem chave
--       estrangeira SEM ON DELETE e por isso bloqueiam a
--       exclusao de jogador se ficarem para depois.
--       Tabela que nao existir neste banco e apenas pulada.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_alvos TEXT[] := ARRAY[
    'auditoria_votos',
    'avaliacoes',
    'avaliacoes_jogo',
    'votos',
    'votos_diarios',
    'denuncias',
    'notificacoes',
    'campeoes_semana',
    'estatisticas_partida',
    'partida_jogadores',
    'partidas',
    'jogos',
    'torneio_estatisticas_jogadores',
    'torneio_jogos',
    'equipe_jogadores',
    'equipes',
    'torneios',
    'racao_participantes',
    'racoes',
    'estatisticas_pessoais',
    'realtime_pings',
    'jogadores'
  ];
  v_tabela TEXT;
  v_puladas TEXT[] := ARRAY[]::TEXT[];
  v_linhas INT;
  v_total  INT := 0;
BEGIN
  FOREACH v_tabela IN ARRAY v_alvos LOOP
    IF to_regclass('public.' || v_tabela) IS NULL THEN
      v_puladas := array_append(v_puladas, v_tabela);
      CONTINUE;
    END IF;

    EXECUTE format('DELETE FROM public.%I', v_tabela);
    GET DIAGNOSTICS v_linhas = ROW_COUNT;
    v_total := v_total + v_linhas;
  END LOOP;

  IF array_length(v_puladas, 1) > 0 THEN
    RAISE NOTICE 'Tabelas que nao existem neste banco (puladas): %', array_to_string(v_puladas, ', ');
  END IF;

  RAISE NOTICE 'Dados esportivos apagados: % linha(s).', v_total;
END $$;

-- ------------------------------------------------------------
--  1.4  PERFIS DAS CONTAS QUE FICAM
--       Desvincula do jogador apagado e zera a reputacao (que era
--       fruto das avaliacoes de teste). Nome, apelido, foto,
--       altura e cidade continuam como estao.
-- ------------------------------------------------------------
UPDATE public.profiles
SET is_player   = FALSE,
    player_id   = NULL,
    reputacao   = 1.0,
    updated_at  = NOW();

-- ------------------------------------------------------------
--  1.5  CONTAS DE TESTE (login + perfil + o que for delas)
--       O ON DELETE CASCADE de profiles -> auth.users leva junto
--       votos, avaliacoes, notificacoes, denuncias e participacoes.
-- ------------------------------------------------------------
DELETE FROM auth.users
WHERE id NOT IN (SELECT id FROM _manter_id);

COMMIT;


-- ============================================================
--  BLOCO 2 — CONFERENCIA  (rode depois; tudo 0, menos contas/perfis)
-- ============================================================
CREATE OR REPLACE FUNCTION pg_temp.conta(p_tabela TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  IF to_regclass('public.' || p_tabela) IS NULL THEN
    RETURN NULL;
  END IF;
  EXECUTE format('SELECT count(*) FROM public.%I', p_tabela) INTO v_total;
  RETURN v_total;
END $$;

SELECT t.tabela, pg_temp.conta(t.tabela) AS registros
FROM (VALUES
  ('jogadores'),
  ('avaliacoes'),
  ('avaliacoes_jogo'),
  ('votos'),
  ('votos_diarios'),
  ('auditoria_votos'),
  ('campeoes_semana'),
  ('partidas'),
  ('partida_jogadores'),
  ('jogos'),
  ('estatisticas_partida'),
  ('racoes'),
  ('racao_participantes'),
  ('torneios'),
  ('equipes'),
  ('equipe_jogadores'),
  ('torneio_jogos'),
  ('torneio_estatisticas_jogadores'),
  ('denuncias'),
  ('notificacoes'),
  ('estatisticas_pessoais'),
  ('realtime_pings')
) AS t(tabela)
ORDER BY t.tabela;

-- Quem sobrou (a sua conta deve estar aqui, role = 'master'):
SELECT p.id, p.nome_completo, p.apelido, p.email, p.role, p.is_active
FROM public.profiles p
ORDER BY p.created_at;


-- ============================================================
--  ANEXO — SE VOCE PERDER O ACESSO DE MASTER
-- ============================================================
-- Rode so se precisar (o SQL Editor roda sem JWT, entao o gatilho
-- de protecao de campos admin deixa passar):
--
--   UPDATE public.profiles
--   SET role = 'master', is_active = TRUE
--   WHERE lower(email) = lower('lucasvielpena@gmail.com');
