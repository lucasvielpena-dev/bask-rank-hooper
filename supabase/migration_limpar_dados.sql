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
--    contas listadas na variavel v_manter (a sua, de master).
--
--  O QUE ELE NAO TOCA
--    - O perfil (nome, apelido, foto, altura, cidade) das contas
--      mantidas: so zera is_player / player_id / reputacao
--    - admin_logs (historico de auditoria)
--    - Tabelas, funcoes, RLS e agendamentos: o esquema fica intacto
--
--  POR QUE O BLOCO 1 E UM SO "DO $$ ... $$"
--    O SQL Editor do Supabase confirma cada comando isoladamente
--    (autocommit). Por isso NAO se pode usar tabela temporaria
--    criada num comando e lida no seguinte -- sem ON COMMIT DROP
--    ela some, e com ON COMMIT DROP some ainda mais rapido (erro
--    42P01: relation "_manter" does not exist). Um bloco DO e uma
--    unica instrucao: ele e atomico sozinho e nao depende de nada
--    sobreviver de um comando para o outro. Se qualquer coisa
--    falhar dentro dele (inclusive a trava dos e-mails), TODAS as
--    exclusoes daquele bloco sao desfeitas.
--
--  ROBUSTO A TABELA AUSENTE
--    to_regclass()/information_schema conferem antes de cada
--    DELETE. Tabela que nao existir neste banco (ex.: 
--    realtime_pings) e apenas pulada, sem derrubar a limpeza.
--
--  COMO RODAR (SQL Editor do Supabase)
--    1. BLOCO 0 -> previa, so leitura. Confira os numeros e o
--       papel (role) da sua conta.
--    2. BLOCO 1 -> a limpeza.
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

-- Contas e perfis:
SELECT 'CONTAS (auth.users)' AS tabela, count(*) FROM auth.users
UNION ALL
SELECT 'PERFIS (profiles)', count(*) FROM public.profiles;

-- Quem existe hoje. A SUA conta precisa aparecer aqui com role = 'master':
SELECT p.nome_completo, p.apelido, p.email, p.role, p.is_active, p.created_at
FROM public.profiles p
ORDER BY p.created_at;


-- ============================================================
--  BLOCO 1 — A LIMPEZA  (bloco unico = atomico)
-- ============================================================
DO $$
DECLARE
  ----------------------------------------------------------------
  --  QUEM SOBREVIVE: coloque aqui o(s) e-mail(s) que NAO podem ser
  --  apagados. Use exatamente o que apareceu no BLOCO 0.
  ----------------------------------------------------------------
  v_manter TEXT[] := ARRAY[
    'lucasvielpena@gmail.com'
    -- ,'colega@exemplo.com'
  ];

  -- IDs das contas preservadas (preenchido pela trava)
  v_manter_id UUID[];

  -- Tabelas alvo, na ordem: filhas antes das maes. Duas delas
  -- (campeoes_semana e estatisticas_partida) tem chave estrangeira
  -- SEM ON DELETE e por isso bloqueiam a exclusao de jogador se
  -- ficarem para depois.
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

  v_tabela  TEXT;
  v_puladas TEXT[] := ARRAY[]::TEXT[];
  v_faltando TEXT;
  v_linhas  INT;
  v_total   INT := 0;
  v_contas_depois INT;
  v_total_antes INT := 0;
BEGIN
  ----------------------------------------------------------------
  --  TRAVA DE SEGURANCA: roda ANTES de qualquer exclusao.
  ----------------------------------------------------------------
  SELECT array_agg(p.id) INTO v_manter_id
  FROM public.profiles p
  WHERE lower(p.email) IN (SELECT lower(x) FROM unnest(v_manter) AS x);

  IF v_manter_id IS NULL OR array_length(v_manter_id, 1) IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: nao encontrei conta para nenhum dos e-mails: %. Confira no BLOCO 0.',
      array_to_string(v_manter, ', ');
  END IF;

  SELECT string_agg(x, ', ') INTO v_faltando
  FROM unnest(v_manter) AS x
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE lower(p.email) = lower(x)
  );

  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTADO: nao existe conta para: %. Corrija a lista no inicio do BLOCO 1.',
      v_faltando;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = ANY (v_manter_id) AND role IN ('master', 'admin')
  ) THEN
    RAISE NOTICE 'AVISO: nenhuma conta preservada e master/admin. Veja o ANEXO no fim do arquivo.';
  END IF;

  ----------------------------------------------------------------
  --  DADOS ESPORTIVOS
  ----------------------------------------------------------------
  FOREACH v_tabela IN ARRAY v_alvos LOOP
    IF to_regclass('public.' || v_tabela) IS NULL THEN
      v_puladas := array_append(v_puladas, v_tabela);
      CONTINUE;   -- tabela nao existe neste banco: pula
    END IF;

    EXECUTE format('DELETE FROM public.%I', v_tabela);
    GET DIAGNOSTICS v_linhas = ROW_COUNT;
    v_total := v_total + v_linhas;
  END LOOP;

  ----------------------------------------------------------------
  --  PERFIS DAS CONTAS QUE FICAM: desvincula do jogador apagado e
  --  zera a reputacao (que era fruto das avaliacoes de teste).
  --  Nome, apelido, foto, altura e cidade continuam como estao.
  ----------------------------------------------------------------
  UPDATE public.profiles
  SET is_player  = FALSE,
      player_id  = NULL,
      reputacao  = 1.0,
      updated_at = NOW();

  ----------------------------------------------------------------
  --  CONTAS DE TESTE: login + perfil + tudo que for delas (o
  --  ON DELETE CASCADE de profiles -> auth.users cuida do resto).
  ----------------------------------------------------------------
  SELECT count(*) INTO v_total_antes FROM auth.users;

  DELETE FROM auth.users
  WHERE NOT (id = ANY (v_manter_id));

  SELECT count(*) INTO v_contas_depois FROM auth.users;

  ----------------------------------------------------------------
  --  RELATORIO (aparece em Notices; o BLOCO 2 confirma de novo)
  ----------------------------------------------------------------
  RAISE NOTICE 'Contas: % antes -> % agora (preservadas: %).',
    v_total_antes,
    v_contas_depois,
    array_to_string(v_manter, ', ');

  RAISE NOTICE 'Dados esportivos apagados: % linha(s).', v_total;

  IF array_length(v_puladas, 1) > 0 THEN
    RAISE NOTICE 'Tabelas que nao existem neste banco (puladas): %',
      array_to_string(v_puladas, ', ');
  END IF;
END $$;


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
  ('jogadores'), ('avaliacoes'), ('avaliacoes_jogo'), ('votos'),
  ('votos_diarios'), ('auditoria_votos'), ('campeoes_semana'),
  ('partidas'), ('partida_jogadores'), ('jogos'), ('estatisticas_partida'),
  ('racoes'), ('racao_participantes'), ('torneios'), ('equipes'),
  ('equipe_jogadores'), ('torneio_jogos'), ('torneio_estatisticas_jogadores'),
  ('denuncias'), ('notificacoes'), ('estatisticas_pessoais'), ('realtime_pings')
) AS t(tabela)
ORDER BY t.tabela;

-- Quem sobrou (a sua conta deve estar aqui, com role = 'master'):
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
