-- ============================================================
-- Ranking por média bayesiana (confiança)
-- score = (media * votos + 3.0 * 8) / (votos + 8)
-- Evita que 3 votos altos passem fácil quem tem mais avaliações.
-- ============================================================

CREATE OR REPLACE FUNCTION public.score_confianca(p_media NUMERIC, p_votos INTEGER)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_votos, 0) <= 0 THEN 0::numeric
    ELSE ROUND(
      (COALESCE(p_media, 0) * p_votos + 3.0 * 8) / (p_votos + 8)
    , 4)
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_ranking(
  p_cidade TEXT DEFAULT NULL,
  p_uf TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_esporte TEXT DEFAULT 'basquete'
)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  apelido TEXT,
  foto_url TEXT,
  media_estrelas NUMERIC,
  total_votos INTEGER,
  votos_semana INTEGER,
  atual_campeao BOOLEAN,
  media_arremesso NUMERIC,
  media_defesa NUMERIC,
  media_controle_de_bola NUMERIC,
  media_explosao_fisica NUMERIC,
  media_visao_de_jogo NUMERIC,
  cidade TEXT,
  uf TEXT,
  pais TEXT,
  posicao TEXT,
  posicao_ranking INTEGER,
  score_confianca NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.nome,
    j.apelido,
    j.foto_url,
    j.media_estrelas,
    j.total_votos,
    j.votos_semana,
    j.atual_campeao,
    j.media_arremesso,
    j.media_defesa,
    j.media_controle_de_bola,
    j.media_explosao_fisica,
    j.media_visao_de_jogo,
    j.cidade,
    j.uf,
    j.pais,
    j.posicao,
    ROW_NUMBER() OVER (
      ORDER BY public.score_confianca(j.media_estrelas, j.total_votos) DESC,
               j.total_votos DESC,
               j.media_estrelas DESC
    )::INTEGER AS posicao_ranking,
    public.score_confianca(j.media_estrelas, j.total_votos) AS score_confianca
  FROM public.jogadores j
  WHERE j.ativo = TRUE
    AND j.total_votos >= 1
    AND (p_cidade IS NULL OR j.cidade = p_cidade)
    AND (p_uf IS NULL OR j.uf = p_uf)
    AND j.esporte = p_esporte
  ORDER BY public.score_confianca(j.media_estrelas, j.total_votos) DESC,
           j.total_votos DESC,
           j.media_estrelas DESC
  LIMIT p_limit;
END;
$$;

SELECT 'migration_ranking_confianca aplicada' AS status;
