-- ============================================================
-- LINHA DE EVOLUÇÃO — CORREÇÃO DE FUSO HORÁRIO
-- ============================================================
-- A `migration_evolucao_jogador.sql` agrupava as avaliações por mês usando o
-- fuso do servidor (UTC). Como o app é de Altamira/PA (UTC-3), uma nota
-- lançada entre 21h e 23h59 no ÚLTIMO dia do mês caía no mês seguinte:
--
--   nota de 31/jan às 21h30 (horário local)
--     = 01/fev 00h30 (UTC)  ->  contava em FEVEREIRO
--
-- Que é, justamente, o horário em que os rachões acontecem. Esta versão agrupa
-- pelo horário do Pará (America/Santarem), então o mês mostrado no gráfico é o
-- mês em que o jogo realmente aconteceu — e a janela dos 6 meses também passa a
-- começar/terminar no mês local (antes, nos últimos 3h do mês, a janela já
-- pulava para o mês seguinte e "engolia" o mês corrente).
--
-- Idempotente: apenas substitui a função. Rode no SQL Editor do Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.evolucao_jogador(
  p_jogador_id UUID,
  p_meses      INTEGER DEFAULT 6
)
RETURNS TABLE (
  mes      DATE,
  media    NUMERIC,
  total    INTEGER,
  jogos    INTEGER,
  votos    INTEGER,
  pct_bom  INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    -- entre 1 e 24 meses
    SELECT GREATEST(LEAST(COALESCE(p_meses, 6), 24), 1) AS n
  ),
  agora AS (
    -- "agora" no horário local, já no primeiro dia do mês (timestamp, sem fuso)
    SELECT date_trunc('month', (NOW() AT TIME ZONE 'America/Santarem')) AS mes_atual
  ),
  janela AS (
    SELECT (a.mes_atual
            - make_interval(months => (SELECT n FROM params) - 1)) AS inicio
    FROM agora a
  ),
  meses AS (
    SELECT generate_series(j.inicio, a.mes_atual, INTERVAL '1 month')::date AS mes
    FROM janela j, agora a
  ),
  notas AS (
    -- 1) notas de partida (1..5) — rachões, competições e torneios
    SELECT date_trunc('month', (aj.created_at AT TIME ZONE 'America/Santarem'))::date AS mes,
           aj.nota::numeric                                                           AS nota,
           1                                                                          AS eh_jogo
    FROM public.avaliacoes_jogo aj, janela j
    WHERE aj.jogador_id = p_jogador_id
      AND (aj.created_at AT TIME ZONE 'America/Santarem') >= j.inicio

    UNION ALL

    -- 2) votos de estrela: média dos 5 fundamentos (1..5)
    SELECT date_trunc('month', (a.created_at AT TIME ZONE 'America/Santarem'))::date AS mes,
           ((a.arremesso + a.defesa + a.controle_de_bola
             + a.explosao_fisica + a.visao_de_jogo) / 5.0)::numeric                  AS nota,
           0                                                                          AS eh_jogo
    FROM public.avaliacoes a, janela j
    WHERE a.jogador_id = p_jogador_id
      AND (a.created_at AT TIME ZONE 'America/Santarem') >= j.inicio
  ),
  agg AS (
    SELECT
      mes,
      ROUND(AVG(nota), 2)                                               AS media,
      COUNT(*)::int                                                     AS total,
      COUNT(*) FILTER (WHERE eh_jogo = 1)::int                          AS jogos,
      COUNT(*) FILTER (WHERE eh_jogo = 0)::int                          AS votos,
      ROUND(100.0 * COUNT(*) FILTER (WHERE nota >= 4) / COUNT(*))::int  AS pct_bom
    FROM notas
    GROUP BY mes
  )
  SELECT
    m.mes,
    agg.media,
    COALESCE(agg.total, 0),
    COALESCE(agg.jogos, 0),
    COALESCE(agg.votos, 0),
    COALESCE(agg.pct_bom, 0)
  FROM meses m
  LEFT JOIN agg ON agg.mes = m.mes
  ORDER BY m.mes;
$$;

-- Só quem está logado consulta (o resultado é agregado, mas não abrimos pro anon)
REVOKE ALL ON FUNCTION public.evolucao_jogador(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evolucao_jogador(UUID, INTEGER) TO authenticated;

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- Troque o UUID por um atleta real (pegue em: SELECT id, nome FROM public.jogadores LIMIT 5;)
-- SELECT * FROM public.evolucao_jogador('00000000-0000-4000-8000-000000000000', 6);
