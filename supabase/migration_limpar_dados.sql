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
--  COMO RODAR (SQL Editor do Supabase)
--    1. BLOCO 0 -> previa, so leitura. Confira os numeros.
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
SELECT 'jogadores'                        AS tabela, count(*) AS registros FROM public.jogadores
UNION ALL SELECT 'avaliacoes (nota A+/A/B/C/D-F)',   count(*) FROM public.avaliacoes
UNION ALL SELECT 'avaliacoes_jogo (nota do jogo)',   count(*) FROM public.avaliacoes_jogo
UNION ALL SELECT 'votos (estrelas)',                 count(*) FROM public.votos
UNION ALL SELECT 'votos_diarios (antifraude)',       count(*) FROM public.votos_diarios
UNION ALL SELECT 'auditoria_votos',                  count(*) FROM public.auditoria_votos
UNION ALL SELECT 'campeoes_semana',                  count(*) FROM public.campeoes_semana
UNION ALL SELECT 'partidas',                         count(*) FROM public.partidas
UNION ALL SELECT 'partida_jogadores',                count(*) FROM public.partida_jogadores
UNION ALL SELECT 'jogos (legado)',                   count(*) FROM public.jogos
UNION ALL SELECT 'estatisticas_partida (legado)',    count(*) FROM public.estatisticas_partida
UNION ALL SELECT 'racoes (rachoes)',                 count(*) FROM public.racoes
UNION ALL SELECT 'racao_participantes',              count(*) FROM public.racao_participantes
UNION ALL SELECT 'torneios',                         count(*) FROM public.torneios
UNION ALL SELECT 'equipes',                          count(*) FROM public.equipes
UNION ALL SELECT 'equipe_jogadores',                 count(*) FROM public.equipe_jogadores
UNION ALL SELECT 'torneio_jogos',                    count(*) FROM public.torneio_jogos
UNION ALL SELECT 'torneio_estatisticas_jogadores',   count(*) FROM public.torneio_estatisticas_jogadores
UNION ALL SELECT 'denuncias',                        count(*) FROM public.denuncias
UNION ALL SELECT 'notificacoes',                     count(*) FROM public.notificacoes
UNION ALL SELECT 'estatisticas_pessoais',            count(*) FROM public.estatisticas_pessoais
UNION ALL SELECT 'CONTAS (auth.users)',              count(*) FROM auth.users
UNION ALL SELECT 'PERFIS (profiles)',                count(*) FROM public.profiles
ORDER BY tabela;

-- Quem existe hoje (copie daqui o seu e-mail para o BLOCO 1):
-- Essa consulta mostra o papel (role) de cada conta. A sua deve ser 'master'.
SELECT p.nome_completo, p.apelido, p.email, p.role, p.is_active, p.created_at
FROM public.profiles p
ORDER BY p.created_at;


-- ============================================================
--  BLOCO 1 — A LIMPEZA  (uma transacao: tudo ou nada)
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
--  1.1  QUEM SOBREVIVE  <-- troque/adicione os e-mails AQUI
--       Pode ter quantos quiser (um por linha, separados por
--       virgula). Use exatamente o e-mail que apareceu no
--       BLOCO 0. Nao diferencia maiuscula de minuscula.
-- ------------------------------------------------------------
CREATE TEMP TABLE _manter (email TEXT) ON COMMIT DROP;

INSERT INTO _manter (email) VALUES
  ('COLOQUE-SEU-EMAIL-AQUI@exemplo.com')     -- <<< TROQUE PELO SEU E-MAIL
  -- ,('colega@exemplo.com')                 -- <<< descomente se quiser manter mais alguem
;

CREATE TEMP TABLE _manter_id ON COMMIT DROP AS
SELECT p.id, p.email, p.role
FROM public.profiles p
JOIN _manter m ON lower(m.email) = lower(p.email);

-- ------------------------------------------------------------
--  1.2  TRAVA DE SEGURANCA
--       Se algum e-mail da lista nao existir, ABORTA sem apagar
--       nada. E isso que impede o desastre de rodar o script com
--       o "COLOQUE-SEU-EMAIL-AQUI" ainda no lugar (nesse caso a
--       lista nao acha ninguem -> nada e apagado).
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
    RAISE NOTICE 'AVISO: nenhuma conta preservada e master/admin. Se perder o acesso, veja o ANEXO no fim do arquivo.';
  END IF;

  RAISE NOTICE 'Trava OK -> preserva % conta(s); apaga % conta(s) de teste.', v_achados, v_contas - v_achados;
END $$;

-- ------------------------------------------------------------
--  1.3  DADOS ESPORTIVOS
--       A ordem importa: filhas antes das maes. Duas tabelas
--       (campeoes_semana e estatisticas_partida) tem chave
--       estrangeira SEM ON DELETE e por isso BLOQUEIAM a
--       exclusao de jogador se ficarem para depois.
-- ------------------------------------------------------------
DELETE FROM public.auditoria_votos;
DELETE FROM public.avaliacoes;
DELETE FROM public.avaliacoes_jogo;
DELETE FROM public.votos;
DELETE FROM public.votos_diarios;
DELETE FROM public.denuncias;
DELETE FROM public.notificacoes;
DELETE FROM public.campeoes_semana;
DELETE FROM public.estatisticas_partida;
DELETE FROM public.partida_jogadores;
DELETE FROM public.partidas;
DELETE FROM public.jogos;
DELETE FROM public.torneio_estatisticas_jogadores;
DELETE FROM public.torneio_jogos;
DELETE FROM public.equipe_jogadores;
DELETE FROM public.equipes;
DELETE FROM public.torneios;
DELETE FROM public.racao_participantes;
DELETE FROM public.racoes;
DELETE FROM public.estatisticas_pessoais;
DELETE FROM public.realtime_pings;
DELETE FROM public.jogadores;

-- ------------------------------------------------------------
--  1.4  PERFIS DAS CONTAS QUE FICAM
--       Desvincula do jogador apagado e zera a reputacao
--       (que era fruto das avaliacoes de teste). Nome, apelido,
--       foto, altura e cidade continuam como estao.
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
--       As sessoes/tokens dessas contas morrem junto no GoTrue.
-- ------------------------------------------------------------
DELETE FROM auth.users
WHERE id NOT IN (SELECT id FROM _manter_id);

COMMIT;


-- ============================================================
--  BLOCO 2 — CONFERENCIA  (rode depois; tudo 0, menos contas/perfis)
-- ============================================================
SELECT 'jogadores'                        AS tabela, count(*) AS registros FROM public.jogadores
UNION ALL SELECT 'avaliacoes (nota A+/A/B/C/D-F)',   count(*) FROM public.avaliacoes
UNION ALL SELECT 'avaliacoes_jogo (nota do jogo)',   count(*) FROM public.avaliacoes_jogo
UNION ALL SELECT 'votos (estrelas)',                 count(*) FROM public.votos
UNION ALL SELECT 'votos_diarios (antifraude)',       count(*) FROM public.votos_diarios
UNION ALL SELECT 'auditoria_votos',                  count(*) FROM public.auditoria_votos
UNION ALL SELECT 'campeoes_semana',                  count(*) FROM public.campeoes_semana
UNION ALL SELECT 'partidas',                         count(*) FROM public.partidas
UNION ALL SELECT 'partida_jogadores',                count(*) FROM public.partida_jogadores
UNION ALL SELECT 'jogos (legado)',                   count(*) FROM public.jogos
UNION ALL SELECT 'estatisticas_partida (legado)',    count(*) FROM public.estatisticas_partida
UNION ALL SELECT 'racoes (rachoes)',                 count(*) FROM public.racoes
UNION ALL SELECT 'racao_participantes',              count(*) FROM public.racao_participantes
UNION ALL SELECT 'torneios',                         count(*) FROM public.torneios
UNION ALL SELECT 'equipes',                          count(*) FROM public.equipes
UNION ALL SELECT 'equipe_jogadores',                 count(*) FROM public.equipe_jogadores
UNION ALL SELECT 'torneio_jogos',                    count(*) FROM public.torneio_jogos
UNION ALL SELECT 'torneio_estatisticas_jogadores',   count(*) FROM public.torneio_estatisticas_jogadores
UNION ALL SELECT 'denuncias',                        count(*) FROM public.denuncias
UNION ALL SELECT 'notificacoes',                     count(*) FROM public.notificacoes
UNION ALL SELECT 'estatisticas_pessoais',            count(*) FROM public.estatisticas_pessoais
UNION ALL SELECT 'CONTAS (auth.users)',              count(*) FROM auth.users
UNION ALL SELECT 'PERFIS (profiles)',                count(*) FROM public.profiles
ORDER BY tabela;

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
--   WHERE lower(email) = lower('seu@email.com');
