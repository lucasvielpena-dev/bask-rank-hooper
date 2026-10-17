-- ============================================================
-- NOTA DO JOGO PASSA A CONTAR NA MEDIA DO ATLETA
-- ============================================================
-- ANTES: a media do atleta (jogadores.media_estrelas / total_votos)
--        vinha SO dos votos de estrela (aba Atletas, 5 fundamentos).
--        A nota da partida (public.avaliacoes_jogo) ficava isolada no
--        resumo do jogo e NAO mexia no ranking.
--
-- AGORA: as duas fontes entram na mesma media, com o mesmo peso por
--        avaliacao -- exatamente a regra que a Linha de Evolucao
--        (evolucao_jogador) ja usa desde sempre.
--
--   media_estrelas = (media_estrelas_antiga * peso_estrelas
--                     + media_notas_jogo    * qtd_notas_jogo)
--                    / (peso_estrelas + qtd_notas_jogo)
--
--   total_votos    = votos de estrela + notas de jogo
--
-- DETALHES
--   * nota de jogo vai de 1 a 5 (A+ .. D/F) e entra com peso 1;
--   * voto de estrela continua entrando com peso_voto (antifraude);
--   * atleta SEM nota de jogo -> o resultado e IDENTICO ao de antes;
--   * vale para rachao, competicao e torneio (e a mesma tabela);
--   * handebol fica de fora de proposito: quem recalcula la e a
--     RPC registrar_avaliacao_handebol (evita brigar com ela).
--
-- REQUER: migration_avaliacoes_jogo.sql ja aplicada.
-- Idempotente: pode rodar mais de uma vez. Rode no SQL Editor.
-- ============================================================


-- ============================================================
-- 1) COLUNAS DE DETALHAMENTO (aparecem no perfil do atleta)
-- ============================================================
ALTER TABLE public.jogadores
  ADD COLUMN IF NOT EXISTS total_votos_estrelas INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_notas_jogo     INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_notas_jogo     NUMERIC(3,2) DEFAULT 0;


-- ============================================================
-- 2) FUNCAO UNICA DE RECALCULO
--    (chamada tanto pelo voto de estrela quanto pela nota de jogo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalcular_media_jogador(p_jogador_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_esporte        TEXT;
  v_n_estrelas     INTEGER := 0;
  v_peso_estrelas  NUMERIC := 0;
  v_n_jogos        INTEGER := 0;
  v_media_jogos    NUMERIC(3,2) := 0;
  v_arremesso      NUMERIC(3,2) := 0;
  v_defesa         NUMERIC(3,2) := 0;
  v_controle       NUMERIC(3,2) := 0;
  v_explosao       NUMERIC(3,2) := 0;
  v_visao          NUMERIC(3,2) := 0;
  v_media_estrelas NUMERIC(3,2) := 0;
  v_peso_total     NUMERIC := 0;
  v_media_final    NUMERIC(3,2) := 0;
BEGIN
  IF p_jogador_id IS NULL THEN
    RETURN;
  END IF;

  SELECT esporte INTO v_esporte FROM public.jogadores WHERE id = p_jogador_id;
  IF NOT FOUND THEN
    RETURN;  -- jogador apagado: nao ha o que atualizar
  END IF;

  -- Handebol tem RPC propria que cuida da media. Nao mexemos.
  IF COALESCE(v_esporte, 'basquete') <> 'basquete' THEN
    RETURN;
  END IF;

  -- ----------------------------------------------------------
  -- A) votos de estrela (aba Atletas) - mesma conta de sempre
  -- ----------------------------------------------------------
  SELECT COUNT(*), COALESCE(SUM(peso_voto), 0)
    INTO v_n_estrelas, v_peso_estrelas
  FROM public.avaliacoes
  WHERE jogador_id = p_jogador_id;

  IF v_n_estrelas > 0 AND v_peso_estrelas <= 0 THEN
    v_peso_estrelas := v_n_estrelas;  -- fallback: peso invalido
  END IF;

  IF v_n_estrelas > 0 THEN
    SELECT
      ROUND(SUM(arremesso        * peso_voto)::numeric / v_peso_estrelas, 2),
      ROUND(SUM(defesa           * peso_voto)::numeric / v_peso_estrelas, 2),
      ROUND(SUM(controle_de_bola * peso_voto)::numeric / v_peso_estrelas, 2),
      ROUND(SUM(explosao_fisica  * peso_voto)::numeric / v_peso_estrelas, 2),
      ROUND(SUM(visao_de_jogo    * peso_voto)::numeric / v_peso_estrelas, 2)
    INTO v_arremesso, v_defesa, v_controle, v_explosao, v_visao
    FROM public.avaliacoes
    WHERE jogador_id = p_jogador_id;

    v_media_estrelas := ROUND(
      (v_arremesso + v_defesa + v_controle + v_explosao + v_visao) / 5.0, 2);
  END IF;

  -- ----------------------------------------------------------
  -- B) notas de jogo (rachao / competicao / torneio)
  -- ----------------------------------------------------------
  SELECT COUNT(*), COALESCE(ROUND(AVG(nota)::numeric, 2), 0)
    INTO v_n_jogos, v_media_jogos
  FROM public.avaliacoes_jogo
  WHERE jogador_id = p_jogador_id;

  -- ----------------------------------------------------------
  -- C) media final = as duas fontes pesadas juntas
  --    (sem nota de jogo, cai exatamente no valor antigo)
  -- ----------------------------------------------------------
  v_peso_total := v_peso_estrelas + v_n_jogos;

  IF v_peso_total > 0 THEN
    v_media_final := ROUND(
      ( (v_media_estrelas * v_peso_estrelas) + (v_media_jogos * v_n_jogos) )
      / v_peso_total, 2);
  ELSE
    v_media_final := 0.00;
    v_media_jogos := 0.00;
  END IF;

  UPDATE public.jogadores SET
    total_votos          = v_n_estrelas + v_n_jogos,
    total_votos_estrelas = v_n_estrelas,
    total_notas_jogo     = v_n_jogos,
    media_notas_jogo     = v_media_jogos,
    media_estrelas       = v_media_final,
    media_arremesso      = v_arremesso,
    media_defesa         = v_defesa,
    media_controle_de_bola = v_controle,
    media_explosao_fisica  = v_explosao,
    media_visao_de_jogo    = v_visao,
    updated_at           = NOW()
  WHERE id = p_jogador_id;
END;
$$;


-- ============================================================
-- 3) TRIGGER DO VOTO DE ESTRELA (agora so delega)
-- ============================================================
CREATE OR REPLACE FUNCTION public.atualizar_media_jogador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_media_jogador(OLD.jogador_id);
  ELSE
    PERFORM public.recalcular_media_jogador(NEW.jogador_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_media_jogador ON public.avaliacoes;
CREATE TRIGGER trg_atualizar_media_jogador
  AFTER INSERT OR UPDATE OR DELETE ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_media_jogador();


-- ============================================================
-- 4) TRIGGER NOVO: NOTA DE JOGO
-- ============================================================
CREATE OR REPLACE FUNCTION public.atualizar_media_jogador_notas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_media_jogador(OLD.jogador_id);
  ELSE
    PERFORM public.recalcular_media_jogador(NEW.jogador_id);
    IF TG_OP = 'UPDATE' AND OLD.jogador_id IS DISTINCT FROM NEW.jogador_id THEN
      PERFORM public.recalcular_media_jogador(OLD.jogador_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_media_jogador_notas ON public.avaliacoes_jogo;
CREATE TRIGGER trg_atualizar_media_jogador_notas
  AFTER INSERT OR UPDATE OR DELETE ON public.avaliacoes_jogo
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_media_jogador_notas();


-- ============================================================
-- 5) BACKFILL - recalcula quem ja tem historico
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.jogadores
    WHERE COALESCE(esporte, 'basquete') = 'basquete'
  LOOP
    PERFORM public.recalcular_media_jogador(r.id);
  END LOOP;
END $$;


-- ============================================================
-- 6) PERMISSOES
--    recalcular_media_jogador e interno: so os triggers usam.
-- ============================================================
REVOKE ALL ON FUNCTION public.recalcular_media_jogador(UUID) FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 7) VERIFICACAO
-- ============================================================
-- Top 10 do ranking com o detalhamento das fontes:
--
-- SELECT nome, apelido, media_estrelas, total_votos,
--        total_votos_estrelas, total_notas_jogo, media_notas_jogo
-- FROM public.jogadores
-- WHERE total_notas_jogo > 0
-- ORDER BY media_estrelas DESC
-- LIMIT 10;
--
-- Um atleta especifico (troque o UUID):
--
-- SELECT j.nome, j.media_estrelas, j.total_votos,
--        j.total_votos_estrelas, j.total_notas_jogo, j.media_notas_jogo
-- FROM public.jogadores j
-- WHERE j.id = '00000000-0000-0000-0000-000000000000';
