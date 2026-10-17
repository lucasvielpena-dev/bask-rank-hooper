-- ============================================================
-- LINHA DE EVOLUÇÃO DO ATLETA
-- ============================================================
-- Substitui a antiga "linha" decorativa (níveis e anos fixos) por um
-- histórico REAL, mês a mês, das avaliações que o atleta recebeu:
--
--   * notas de partida  -> public.avaliacoes_jogo
--                          (rachões, competições e torneios)
--   * votos de estrela  -> public.avaliacoes
--                          (aba Atletas, média dos 5 fundamentos)
--
-- REGRAS:
--   - Devolve TODOS os meses da janela, inclusive os vazios (total = 0),
--     para o gráfico marcar os buracos em vez de "inventar" linha reta.
--   - `media`  = média das avaliações daquele mês (1 a 5)
--   - `total`  = quantas avaliações o atleta recebeu no mês
--   - `jogos`  = quantas foram notas de partida
--   - `votos`  = quantos foram votos de estrela
--   - `pct_bom`= % das notas do mês que foram >= 4
--   - Nunca devolve quem avaliou: continua anônimo.
--
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

DROP FUNCTION IF EXISTS public.evolucao_jogador(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.evolucao_jogador(UUID);

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
  janela AS (
    SELECT (date_trunc('month', NOW())
            - make_interval(months => (SELECT n FROM params) - 1))::date AS inicio
  ),
  meses AS (
    SELECT generate_series(
             j.inicio,
             date_trunc('month', NOW())::date,
             INTERVAL '1 month'
           )::date AS mes
    FROM janela j
  ),
  notas AS (
    -- 1) notas de partida (1..5)
    SELECT date_trunc('month', aj.created_at)::date AS mes,
           aj.nota::numeric                         AS nota,
           1                                        AS eh_jogo
    FROM public.avaliacoes_jogo aj, janela j
    WHERE aj.jogador_id = p_jogador_id
      AND aj.created_at >= j.inicio

    UNION ALL

    -- 2) votos de estrela: média dos 5 fundamentos (1..5)
    SELECT date_trunc('month', a.created_at)::date AS mes,
           ((a.arremesso + a.defesa + a.controle_de_bola
             + a.explosao_fisica + a.visao_de_jogo) / 5.0)::numeric AS nota,
           0                                        AS eh_jogo
    FROM public.avaliacoes a, janela j
    WHERE a.jogador_id = p_jogador_id
      AND a.created_at >= j.inicio
  ),
  agg AS (
    SELECT
      mes,
      ROUND(AVG(nota), 2)                                              AS media,
      COUNT(*)::int                                                    AS total,
      COUNT(*) FILTER (WHERE eh_jogo = 1)::int                          AS jogos,
      COUNT(*) FILTER (WHERE eh_jogo = 0)::int                          AS votos,
      ROUND(100.0 * COUNT(*) FILTER (WHERE nota >= 4) / COUNT(*))::int   AS pct_bom
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
-- SELECT * FROM public.evolucao_jogador('00000000-0000-0000-0000-000000000000', 6);
