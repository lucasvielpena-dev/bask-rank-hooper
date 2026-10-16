-- ============================================================
-- FEATURES V2: Rachões + Ranking com confiança + votos pós-jogo
-- Rode no SQL Editor do Supabase
-- ============================================================

-- 1) Tabela de rachões (pickup games)
CREATE TABLE IF NOT EXISTS public.racoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  local TEXT,
  cidade TEXT DEFAULT 'Altamira',
  uf TEXT DEFAULT 'PA',
  data_hora TIMESTAMPTZ NOT NULL,
  max_jogadores INTEGER DEFAULT 10 CHECK (max_jogadores BETWEEN 2 AND 20),
  nivel TEXT DEFAULT 'Todos' CHECK (nivel IN ('Iniciante', 'Intermediário', 'Avançado', 'Todos')),
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'lotado', 'em_andamento', 'finalizado', 'cancelado')),
  criado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  esporte TEXT DEFAULT 'basquete',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.racao_participantes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  racao_id UUID NOT NULL REFERENCES public.racoes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jogador_id UUID REFERENCES public.jogadores(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'saiu')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (racao_id, usuario_id)
);

-- Vínculo opcional de avaliação a um rachão (anti-fraude)
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS racao_id UUID REFERENCES public.racoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_racoes_status_data ON public.racoes(status, data_hora);
CREATE INDEX IF NOT EXISTS idx_racoes_cidade ON public.racoes(cidade, uf);
CREATE INDEX IF NOT EXISTS idx_racao_part_racao ON public.racao_participantes(racao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_racao ON public.avaliacoes(racao_id);

ALTER TABLE public.racoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.racao_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "racoes_select_all" ON public.racoes;
CREATE POLICY "racoes_select_all" ON public.racoes FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "racoes_insert_auth" ON public.racoes;
CREATE POLICY "racoes_insert_auth" ON public.racoes
  FOR INSERT WITH CHECK (auth.uid() = criado_por);

DROP POLICY IF EXISTS "racoes_update_auth" ON public.racoes;
CREATE POLICY "racoes_update_auth" ON public.racoes
  FOR UPDATE USING (auth.uid() = criado_por OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "racao_part_select" ON public.racao_participantes;
CREATE POLICY "racao_part_select" ON public.racao_participantes FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "racao_part_insert" ON public.racao_participantes;
CREATE POLICY "racao_part_insert" ON public.racao_participantes
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "racao_part_update" ON public.racao_participantes;
CREATE POLICY "racao_part_update" ON public.racao_participantes
  FOR UPDATE USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "racao_part_delete" ON public.racao_participantes;
CREATE POLICY "racao_part_delete" ON public.racao_participantes
  FOR DELETE USING (auth.uid() = usuario_id);

-- 2) Ranking com score de confiança (Bayesian-ish)
-- score = (media * votos + prior_media * prior) / (votos + prior)
-- prior = 5 votos com média 3.0 → quem tem poucos votos não sobe artificialmente
CREATE OR REPLACE FUNCTION public.get_ranking(
  p_cidade TEXT DEFAULT NULL,
  p_uf TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_esporte TEXT DEFAULT 'basquete',
  p_posicao TEXT DEFAULT NULL
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
  score_confianca NUMERIC,
  nivel_confianca TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_prior NUMERIC := 5.0;
  v_prior_media NUMERIC := 3.0;
BEGIN
  RETURN QUERY
  WITH ranked AS (
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
      ROUND(
        (
          (COALESCE(j.media_estrelas, 0) * COALESCE(j.total_votos, 0)::NUMERIC)
          + (v_prior_media * v_prior)
        ) / NULLIF((COALESCE(j.total_votos, 0)::NUMERIC + v_prior), 0)
      , 3) AS score_confianca,
      CASE
        WHEN COALESCE(j.total_votos, 0) < 5 THEN 'provisorio'
        WHEN COALESCE(j.total_votos, 0) < 15 THEN 'em_evolucao'
        ELSE 'consolidado'
      END AS nivel_confianca
    FROM public.jogadores j
    WHERE j.ativo = TRUE
      AND COALESCE(j.total_votos, 0) >= 1
      AND (p_cidade IS NULL OR j.cidade = p_cidade)
      AND (p_uf IS NULL OR j.uf = p_uf)
      AND j.esporte = p_esporte
      AND (p_posicao IS NULL OR j.posicao ILIKE p_posicao OR j.posicao ILIKE ('%' || p_posicao || '%'))
  )
  SELECT
    r.id, r.nome, r.apelido, r.foto_url, r.media_estrelas, r.total_votos, r.votos_semana,
    r.atual_campeao, r.media_arremesso, r.media_defesa, r.media_controle_de_bola,
    r.media_explosao_fisica, r.media_visao_de_jogo, r.cidade, r.uf, r.pais, r.posicao,
    ROW_NUMBER() OVER (ORDER BY r.score_confianca DESC, r.total_votos DESC)::INTEGER AS posicao_ranking,
    r.score_confianca,
    r.nivel_confianca
  FROM ranked r
  ORDER BY r.score_confianca DESC, r.total_votos DESC
  LIMIT p_limit;
END;
$$;

-- Realtime (opcional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON pr.prpubid = p.oid
    JOIN pg_class c ON pr.prrelid = c.oid
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'racoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.racoes;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
