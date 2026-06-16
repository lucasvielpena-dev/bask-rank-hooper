-- ============================================================
-- MIGRAÇÃO: Suporte ao Handebol — Rank Hooper
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- PASSO 1.1 — Adicionar coluna "esporte" nas tabelas principais
-- ============================================================

-- Tabela de jogadores
ALTER TABLE public.jogadores
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete'
  CHECK (esporte IN ('basquete', 'handebol'));

-- Tabela de avaliações (votos)
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete'
  CHECK (esporte IN ('basquete', 'handebol'));

-- Tabela de jogos/partidas
ALTER TABLE public.jogos
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete'
  CHECK (esporte IN ('basquete', 'handebol'));

ALTER TABLE public.partidas
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete'
  CHECK (esporte IN ('basquete', 'handebol'));

-- Estatísticas de partida
ALTER TABLE public.estatisticas_partida
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete'
  CHECK (esporte IN ('basquete', 'handebol'));

-- Estatísticas pessoais
ALTER TABLE public.estatisticas_pessoais
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete'
  CHECK (esporte IN ('basquete', 'handebol'));

-- Perfil do usuário (esporte preferido)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS esporte_preferido TEXT NOT NULL DEFAULT 'basquete'
  CHECK (esporte_preferido IN ('basquete', 'handebol'));

-- ============================================================
-- PASSO 1.2 — Colunas de habilidades do handebol em jogadores
-- ============================================================

ALTER TABLE public.jogadores
  ADD COLUMN IF NOT EXISTS media_finalizacao NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_passes NUMERIC(3,2) DEFAULT 0;
-- media_defesa, media_explosao_fisica, media_visao_de_jogo já existem — reutilizar.

-- ============================================================
-- PASSO 1.3 — Colunas de habilidades do handebol em avaliacoes
-- ============================================================

ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS finalizacao INTEGER CHECK (finalizacao BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS passes INTEGER CHECK (passes BETWEEN 1 AND 5);
-- defesa, explosao_fisica, visao_de_jogo já existem — reutilizar.
-- arremesso e controle_de_bola ficam NULL para avaliações de handebol.

-- ============================================================
-- PASSO 1.4 — Stats de partida para handebol
-- ============================================================

ALTER TABLE public.estatisticas_partida
  ADD COLUMN IF NOT EXISTS gols INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defesas_goleiro INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assistencias INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faltas_cometidas INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faltas_sofridas INTEGER DEFAULT 0;

-- ============================================================
-- PASSO 1.5 — Stats pessoais para handebol
-- ============================================================

ALTER TABLE public.estatisticas_pessoais
  ADD COLUMN IF NOT EXISTS gols INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defesas_goleiro INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assistencias INTEGER DEFAULT 0;

-- ============================================================
-- PASSO 1.6 — Função registrar_avaliacao_handebol
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_avaliacao_handebol(
  p_jogador_id UUID,
  p_finalizacao INTEGER,
  p_defesa INTEGER,
  p_passes INTEGER,
  p_explosao_fisica INTEGER,
  p_visao_de_jogo INTEGER,
  p_ip TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_localizacao TEXT DEFAULT NULL,
  p_comentario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avaliador_id UUID;
  v_reputacao NUMERIC;
  v_media_nova NUMERIC;
  v_peso_total NUMERIC;
  v_finalizacao NUMERIC(3,2);
  v_defesa NUMERIC(3,2);
  v_passes NUMERIC(3,2);
  v_explosao NUMERIC(3,2);
  v_visao NUMERIC(3,2);
BEGIN
  -- Validações
  IF p_finalizacao < 1 OR p_finalizacao > 5 OR
     p_defesa < 1 OR p_defesa > 5 OR
     p_passes < 1 OR p_passes > 5 OR
     p_explosao_fisica < 1 OR p_explosao_fisica > 5 OR
     p_visao_de_jogo < 1 OR p_visao_de_jogo > 5
  THEN
    RETURN jsonb_build_object('erro', 'Avaliação inválida: valores devem ser entre 1 e 5');
  END IF;

  v_avaliador_id := auth.uid();
  IF v_avaliador_id IS NULL THEN
    RETURN jsonb_build_object('erro', 'Usuário não autenticado');
  END IF;

  -- Bloquear auto-voto
  IF EXISTS (SELECT 1 FROM public.jogadores WHERE id = p_jogador_id AND criado_por = v_avaliador_id) THEN
    RETURN jsonb_build_object('erro', 'Você não pode votar em si mesmo');
  END IF;

  -- Bloquear voto duplicado em 24h
  IF EXISTS (
    SELECT 1 FROM public.avaliacoes
    WHERE avaliador_id = v_avaliador_id
      AND jogador_id = p_jogador_id
      AND esporte = 'handebol'
      AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN jsonb_build_object('erro', 'Você já avaliou este atleta nas últimas 24 horas');
  END IF;

  -- Reputação do avaliador
  SELECT COALESCE(reputacao, 1.0) INTO v_reputacao FROM public.profiles WHERE id = v_avaliador_id;

  -- Inserir avaliação
  INSERT INTO public.avaliacoes (
    avaliador_id, jogador_id, esporte,
    finalizacao, defesa, passes, explosao_fisica, visao_de_jogo,
    peso_voto, comentario
  ) VALUES (
    v_avaliador_id, p_jogador_id, 'handebol',
    p_finalizacao, p_defesa, p_passes, p_explosao_fisica, p_visao_de_jogo,
    v_reputacao, p_comentario
  );

  -- Recalcular médias do jogador
  SELECT
    SUM(peso_voto),
    ROUND(SUM(finalizacao * peso_voto)::NUMERIC / SUM(peso_voto), 2),
    ROUND(SUM(defesa * peso_voto)::NUMERIC / SUM(peso_voto), 2),
    ROUND(SUM(passes * peso_voto)::NUMERIC / SUM(peso_voto), 2),
    ROUND(SUM(explosao_fisica * peso_voto)::NUMERIC / SUM(peso_voto), 2),
    ROUND(SUM(visao_de_jogo * peso_voto)::NUMERIC / SUM(peso_voto), 2)
  INTO v_peso_total, v_finalizacao, v_defesa, v_passes, v_explosao, v_visao
  FROM public.avaliacoes
  WHERE jogador_id = p_jogador_id AND esporte = 'handebol';

  v_media_nova := ROUND((v_finalizacao + v_defesa + v_passes + v_explosao + v_visao) / 5.0, 2);

  UPDATE public.jogadores SET
    media_finalizacao = v_finalizacao,
    media_defesa = v_defesa,
    media_passes = v_passes,
    media_explosao_fisica = v_explosao,
    media_visao_de_jogo = v_visao,
    media_estrelas = v_media_nova,
    total_votos = total_votos + 1,
    updated_at = NOW()
  WHERE id = p_jogador_id;

  RETURN jsonb_build_object('sucesso', true, 'nova_media', v_media_nova);
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_avaliacao_handebol TO authenticated;

-- ============================================================
-- PASSO 1.7 — Atualizar get_ranking para filtrar por esporte
-- ============================================================
-- NOTA: A função get_ranking existente precisa ser atualizada para aceitar
-- o parâmetro p_esporte. Como não temos a definição exata da função,
-- adicionamos um wrapper que pode ser usado caso a função original
-- não aceite o parâmetro diretamente.
--
-- SE a função get_ranking já aceita parâmetros nomeados, adicione
-- manualmente a seguinte linha no WHERE da função:
--   AND j.esporte = COALESCE(p_esporte, 'basquete')
--
-- E adicione o parâmetro na assinatura:
--   p_esporte TEXT DEFAULT 'basquete'
-- ============================================================
