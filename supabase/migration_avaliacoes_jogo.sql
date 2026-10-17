-- ============================================================
-- NOTAS DE JOGO (RACHÃO / COMPETIÇÃO) — AVALIAÇÃO ANÔNIMA
-- ============================================================
-- Objetivo:
--   * Registrar a nota da PARTIDA por letra (A+ .. D/F -> 5..1)
--   * Guardar QUEM jogou bem/mal de forma ANÔNIMA
--   * Permitir um resumo agregado (percentual + semáforo) para todos
--
-- Como a anonimidade é garantida:
--   * A tabela fica FECHADA para anon/authenticated (REVOKE ALL)
--   * Nada é lido/escrito direto na tabela
--   * Todo acesso passa por 3 funções SECURITY DEFINER
--     (salvar / minhas / resumo) que NUNCA devolvem o avaliador_id
--
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.avaliacoes_jogo (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  racao_id     UUID REFERENCES public.racoes(id)    ON DELETE CASCADE,
  partida_id   UUID REFERENCES public.partidas(id)  ON DELETE CASCADE,
  avaliador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jogador_id   UUID NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  nota         SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- exatamente um alvo: ou é de um rachão, ou de uma partida
  CONSTRAINT avaliacoes_jogo_alvo CHECK (
    ((racao_id IS NOT NULL)::int + (partida_id IS NOT NULL)::int) = 1
  )
);

-- Um voto por (alvo, avaliador, jogador). NULLs não colidem num UNIQUE normal,
-- por isso usamos índices parciais.
CREATE UNIQUE INDEX IF NOT EXISTS uq_aval_jogo_racao
  ON public.avaliacoes_jogo (racao_id, avaliador_id, jogador_id)
  WHERE racao_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_aval_jogo_partida
  ON public.avaliacoes_jogo (partida_id, avaliador_id, jogador_id)
  WHERE partida_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aval_jogo_racao   ON public.avaliacoes_jogo (racao_id);
CREATE INDEX IF NOT EXISTS idx_aval_jogo_partida ON public.avaliacoes_jogo (partida_id);
CREATE INDEX IF NOT EXISTS idx_aval_jogo_jogador ON public.avaliacoes_jogo (jogador_id);

-- ------------------------------------------------------------
-- 2) Fecha a tabela (só as funções abaixo acessam)
-- ------------------------------------------------------------
ALTER TABLE public.avaliacoes_jogo ENABLE ROW LEVEL SECURITY;

-- Sem policies = ninguém acessa direto (nem via API).
DROP POLICY IF EXISTS avaliacoes_jogo_nada ON public.avaliacoes_jogo;

REVOKE ALL ON public.avaliacoes_jogo FROM anon, authenticated;
GRANT ALL ON public.avaliacoes_jogo TO postgres;
GRANT ALL ON public.avaliacoes_jogo TO service_role;

-- ------------------------------------------------------------
-- 3) salvar_nota_jogo — grava/atualiza a nota (anônima)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salvar_nota_jogo(
  p_jogador_id UUID,
  p_nota       SMALLINT,
  p_partida_id UUID DEFAULT NULL,
  p_racao_id   UUID DEFAULT NULL,
  p_comentario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Você precisa estar logado.');
  END IF;

  IF p_jogador_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Jogador não informado.');
  END IF;

  IF ((p_partida_id IS NOT NULL)::int + (p_racao_id IS NOT NULL)::int) <> 1 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Informe a partida OU o rachão.');
  END IF;

  IF p_nota IS NULL OR p_nota < 1 OR p_nota > 5 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Nota inválida.');
  END IF;

  -- O alvo precisa ter jogado de verdade
  IF p_partida_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.partida_jogadores pj
      WHERE pj.partida_id = p_partida_id AND pj.jogador_id = p_jogador_id
    ) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Este jogador não participou da partida.');
    END IF;
  ELSIF p_racao_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.racao_participantes rp
      WHERE rp.racao_id = p_racao_id AND rp.jogador_id = p_jogador_id
    ) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Este jogador não participou do rachão.');
    END IF;
  END IF;

  -- Ninguém avalia a si mesmo
  IF EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_uid AND pr.player_id = p_jogador_id
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Você não pode avaliar a si mesmo.');
  END IF;

  SELECT id INTO v_id
  FROM public.avaliacoes_jogo
  WHERE avaliador_id = v_uid
    AND jogador_id = p_jogador_id
    AND (
      (p_partida_id IS NOT NULL AND partida_id = p_partida_id)
      OR (p_racao_id IS NOT NULL AND racao_id = p_racao_id)
    )
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.avaliacoes_jogo
      (partida_id, racao_id, avaliador_id, jogador_id, nota, comentario)
    VALUES
      (p_partida_id, p_racao_id, v_uid, p_jogador_id, p_nota, p_comentario);
  ELSE
    UPDATE public.avaliacoes_jogo
       SET nota = p_nota,
           comentario = p_comentario,
           updated_at = NOW()
     WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'nota', p_nota);
END;
$$;

-- ------------------------------------------------------------
-- 4) minhas_notas_jogo — o que EU avaliei (para marcar "✓ Avaliado")
--    Nunca devolve o avaliador de ninguém, só o meu.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.minhas_notas_jogo(
  p_partida_id UUID DEFAULT NULL,
  p_racao_id   UUID DEFAULT NULL
)
RETURNS TABLE (jogador_id UUID, nota SMALLINT, comentario TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT aj.jogador_id, aj.nota, aj.comentario
  FROM public.avaliacoes_jogo aj
  WHERE aj.avaliador_id = auth.uid()
    AND (
      (p_partida_id IS NOT NULL AND aj.partida_id = p_partida_id)
      OR (p_racao_id IS NOT NULL AND aj.racao_id = p_racao_id)
    );
$$;

-- ------------------------------------------------------------
-- 5) resumo_notas_jogo — média + percentuais agregados (anônimo)
--    Devolve por jogador: total, média, % bom (>=4) e % ruim (<=2)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resumo_notas_jogo(
  p_partida_id UUID DEFAULT NULL,
  p_racao_id   UUID DEFAULT NULL
)
RETURNS TABLE (
  jogador_id UUID,
  total      INTEGER,
  media      NUMERIC,
  pct_bom    INTEGER,
  pct_ruim   INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    aj.jogador_id,
    COUNT(*)::int AS total,
    ROUND(AVG(aj.nota)::numeric, 2) AS media,
    ROUND((100.0 * COUNT(*) FILTER (WHERE aj.nota >= 4)) / COUNT(*))::int AS pct_bom,
    ROUND((100.0 * COUNT(*) FILTER (WHERE aj.nota <= 2)) / COUNT(*))::int AS pct_ruim
  FROM public.avaliacoes_jogo aj
  WHERE (p_partida_id IS NOT NULL AND aj.partida_id = p_partida_id)
     OR (p_racao_id   IS NOT NULL AND aj.racao_id   = p_racao_id)
  GROUP BY aj.jogador_id;
$$;

-- ------------------------------------------------------------
-- 6) Permissões de execução: só usuário logado
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.salvar_nota_jogo(UUID, SMALLINT, UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.minhas_notas_jogo(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resumo_notas_jogo(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.salvar_nota_jogo(UUID, SMALLINT, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.minhas_notas_jogo(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumo_notas_jogo(UUID, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.salvar_nota_jogo(UUID, SMALLINT, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.minhas_notas_jogo(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.resumo_notas_jogo(UUID, UUID) TO service_role;

-- ------------------------------------------------------------
-- 7) Verificação rápida
-- ------------------------------------------------------------
-- Deve listar a tabela:
SELECT to_regclass('public.avaliacoes_jogo') AS tabela_criada;

-- Deve listar as 3 funções:
SELECT proname
FROM pg_proc
WHERE proname IN ('salvar_nota_jogo', 'minhas_notas_jogo', 'resumo_notas_jogo')
ORDER BY proname;
