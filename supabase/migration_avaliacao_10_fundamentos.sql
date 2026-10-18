-- ============================================================
-- Avaliação principal: 10 fundamentos de basquete
-- ============================================================
-- 1 Arremesso
-- 2 Finalização
-- 3 Controle de Bola
-- 4 Passe e Visão
-- 5 Defesa Perimetral
-- 6 Defesa de Garrafão
-- 7 Rebote
-- 8 Velocidade e Agilidade
-- 9 Explosão e Força
-- 10 Trabalho em Equipe e Garra

-- Colunas em avaliacoes
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS finalizacao INTEGER;
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS passe_visao INTEGER;
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS defesa_perimetral INTEGER;
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS defesa_garrafao INTEGER;
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS rebote INTEGER;
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS velocidade_agilidade INTEGER;
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS explosao_forca INTEGER;
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS hustle_equipe INTEGER;

-- Colunas de média em jogadores
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_finalizacao NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_passe_visao NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_defesa_perimetral NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_defesa_garrafao NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_rebote NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_velocidade_agilidade NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_explosao_forca NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_hustle_equipe NUMERIC(3,2) DEFAULT 0;

-- Preenche votos antigos (mapeamento a partir dos 5 eixos)
UPDATE public.avaliacoes SET
  finalizacao = COALESCE(finalizacao, arremesso),
  passe_visao = COALESCE(passe_visao, visao_de_jogo),
  defesa_perimetral = COALESCE(defesa_perimetral, defesa),
  defesa_garrafao = COALESCE(defesa_garrafao, defesa),
  rebote = COALESCE(rebote, GREATEST(1, LEAST(5, ROUND(((arremesso + defesa + controle_de_bola + explosao_fisica + visao_de_jogo) / 5.0))::int))),
  velocidade_agilidade = COALESCE(velocidade_agilidade, explosao_fisica),
  explosao_forca = COALESCE(explosao_forca, explosao_fisica),
  hustle_equipe = COALESCE(hustle_equipe, GREATEST(1, LEAST(5, ROUND(((defesa + visao_de_jogo) / 2.0))::int))))
WHERE finalizacao IS NULL
   OR passe_visao IS NULL
   OR defesa_perimetral IS NULL
   OR defesa_garrafao IS NULL
   OR rebote IS NULL
   OR velocidade_agilidade IS NULL
   OR explosao_forca IS NULL
   OR hustle_equipe IS NULL;

-- Constraints 1–5 nos novos campos (após preencher)
DO $$
BEGIN
  ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_finalizacao_check;
  ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_finalizacao_check CHECK (finalizacao IS NULL OR finalizacao BETWEEN 1 AND 5);
  ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_passe_visao_check;
  ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_passe_visao_check CHECK (passe_visao IS NULL OR passe_visao BETWEEN 1 AND 5);
  ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_defesa_perimetral_check;
  ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_defesa_perimetral_check CHECK (defesa_perimetral IS NULL OR defesa_perimetral BETWEEN 1 AND 5);
  ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_defesa_garrafao_check;
  ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_defesa_garrafao_check CHECK (defesa_garrafao IS NULL OR defesa_garrafao BETWEEN 1 AND 5);
  ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_rebote_check;
  ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_rebote_check CHECK (rebote IS NULL OR rebote BETWEEN 1 AND 5);
  ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_velocidade_agilidade_check;
  ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_velocidade_agilidade_check CHECK (velocidade_agilidade IS NULL OR velocidade_agilidade BETWEEN 1 AND 5);
  ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_explosao_forca_check;
  ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_explosao_forca_check CHECK (explosao_forca IS NULL OR explosao_forca BETWEEN 1 AND 5);
  ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_hustle_equipe_check;
  ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_hustle_equipe_check CHECK (hustle_equipe IS NULL OR hustle_equipe BETWEEN 1 AND 5);
END $$;

-- Trigger de média (10 eixos; mantém colunas antigas espelhadas quando possível)
CREATE OR REPLACE FUNCTION public.atualizar_media_jogador()
RETURNS TRIGGER AS $$
DECLARE
  v_jogador_id UUID;
  v_total_votos INTEGER;
  v_peso_total NUMERIC;
  v_arremesso NUMERIC(3,2);
  v_finalizacao NUMERIC(3,2);
  v_controle NUMERIC(3,2);
  v_passe NUMERIC(3,2);
  v_def_p NUMERIC(3,2);
  v_def_g NUMERIC(3,2);
  v_rebote NUMERIC(3,2);
  v_vel NUMERIC(3,2);
  v_exp NUMERIC(3,2);
  v_hustle NUMERIC(3,2);
  v_media NUMERIC(3,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_jogador_id := OLD.jogador_id;
  ELSE
    v_jogador_id := NEW.jogador_id;
  END IF;

  SELECT COUNT(*) INTO v_total_votos
  FROM public.avaliacoes WHERE jogador_id = v_jogador_id;

  IF v_total_votos = 0 THEN
    UPDATE public.jogadores SET
      total_votos = 0,
      media_estrelas = 0,
      media_arremesso = 0,
      media_defesa = 0,
      media_controle_de_bola = 0,
      media_explosao_fisica = 0,
      media_visao_de_jogo = 0,
      media_finalizacao = 0,
      media_passe_visao = 0,
      media_defesa_perimetral = 0,
      media_defesa_garrafao = 0,
      media_rebote = 0,
      media_velocidade_agilidade = 0,
      media_explosao_forca = 0,
      media_hustle_equipe = 0,
      updated_at = NOW()
    WHERE id = v_jogador_id;
  ELSE
    SELECT COALESCE(SUM(peso_voto), 1) INTO v_peso_total
    FROM public.avaliacoes WHERE jogador_id = v_jogador_id;
    IF v_peso_total IS NULL OR v_peso_total = 0 THEN v_peso_total := 1; END IF;

    SELECT
      ROUND(SUM(arremesso * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(COALESCE(finalizacao, arremesso) * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(controle_de_bola * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(COALESCE(passe_visao, visao_de_jogo) * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(COALESCE(defesa_perimetral, defesa) * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(COALESCE(defesa_garrafao, defesa) * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(COALESCE(rebote, defesa) * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(COALESCE(velocidade_agilidade, explosao_fisica) * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(COALESCE(explosao_forca, explosao_fisica) * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(COALESCE(hustle_equipe, defesa) * peso_voto)::NUMERIC / v_peso_total, 2)
    INTO v_arremesso, v_finalizacao, v_controle, v_passe, v_def_p, v_def_g, v_rebote, v_vel, v_exp, v_hustle
    FROM public.avaliacoes WHERE jogador_id = v_jogador_id;

    v_media := ROUND((
      v_arremesso + v_finalizacao + v_controle + v_passe + v_def_p +
      v_def_g + v_rebote + v_vel + v_exp + v_hustle
    ) / 10.0, 2);

    UPDATE public.jogadores SET
      total_votos = v_total_votos,
      media_estrelas = v_media,
      media_arremesso = v_arremesso,
      media_controle_de_bola = v_controle,
      media_defesa = ROUND((v_def_p + v_def_g) / 2.0, 2),
      media_visao_de_jogo = v_passe,
      media_explosao_fisica = v_exp,
      media_finalizacao = v_finalizacao,
      media_passe_visao = v_passe,
      media_defesa_perimetral = v_def_p,
      media_defesa_garrafao = v_def_g,
      media_rebote = v_rebote,
      media_velocidade_agilidade = v_vel,
      media_explosao_forca = v_exp,
      media_hustle_equipe = v_hustle,
      updated_at = NOW()
    WHERE id = v_jogador_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove versões antigas da RPC
DROP FUNCTION IF EXISTS public.registrar_avaliacao(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.registrar_avaliacao(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.registrar_avaliacao(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.registrar_avaliacao(
  p_jogador_id UUID,
  p_arremesso INTEGER,
  p_finalizacao INTEGER,
  p_controle_de_bola INTEGER,
  p_passe_visao INTEGER,
  p_defesa_perimetral INTEGER,
  p_defesa_garrafao INTEGER,
  p_rebote INTEGER,
  p_velocidade_agilidade INTEGER,
  p_explosao_forca INTEGER,
  p_hustle_equipe INTEGER,
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
  v_avaliador_id UUID := auth.uid();
  v_reputacao NUMERIC;
  v_jogador_player_id UUID;
  v_votos_hoje INTEGER;
  v_avaliacao_id UUID;
  v_novo_total INTEGER;
  v_nova_media NUMERIC(3,2);
  v_cidade_jogador TEXT;
  v_uf_jogador TEXT;
  v_cidade_avaliador TEXT;
  v_uf_avaliador TEXT;
BEGIN
  IF v_avaliador_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você precisa estar logado para avaliar.');
  END IF;

  IF p_arremesso < 1 OR p_arremesso > 5
     OR p_finalizacao < 1 OR p_finalizacao > 5
     OR p_controle_de_bola < 1 OR p_controle_de_bola > 5
     OR p_passe_visao < 1 OR p_passe_visao > 5
     OR p_defesa_perimetral < 1 OR p_defesa_perimetral > 5
     OR p_defesa_garrafao < 1 OR p_defesa_garrafao > 5
     OR p_rebote < 1 OR p_rebote > 5
     OR p_velocidade_agilidade < 1 OR p_velocidade_agilidade > 5
     OR p_explosao_forca < 1 OR p_explosao_forca > 5
     OR p_hustle_equipe < 1 OR p_hustle_equipe > 5 THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Todas as notas devem ser de 1 a 5.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jogadores WHERE id = p_jogador_id AND ativo = TRUE) THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Jogador não encontrado.');
  END IF;

  SELECT player_id INTO v_jogador_player_id FROM public.profiles WHERE id = v_avaliador_id;
  IF v_jogador_player_id = p_jogador_id THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você não pode avaliar a si mesmo.');
  END IF;

  SELECT j.cidade, j.uf INTO v_cidade_jogador, v_uf_jogador FROM public.jogadores j WHERE j.id = p_jogador_id;
  SELECT COALESCE(NULLIF(trim(p.cidade_atual), ''), NULLIF(trim(p.cidade), '')), NULLIF(trim(p.uf), '')
  INTO v_cidade_avaliador, v_uf_avaliador
  FROM public.profiles p WHERE p.id = v_avaliador_id;

  IF v_cidade_avaliador IS NULL OR public.normalizar_cidade(v_cidade_avaliador) = '' THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Defina sua cidade (localização) antes de avaliar atletas.');
  END IF;
  IF v_cidade_jogador IS NULL OR public.normalizar_cidade(v_cidade_jogador) = '' THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Este atleta ainda não tem cidade definida e não pode ser avaliado.');
  END IF;
  IF public.normalizar_cidade(v_cidade_avaliador) <> public.normalizar_cidade(v_cidade_jogador) THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você só pode avaliar atletas da sua cidade. Em outras cidades, apenas consulte o ranking.');
  END IF;
  IF v_uf_avaliador IS NOT NULL AND v_uf_jogador IS NOT NULL AND upper(v_uf_avaliador) <> upper(v_uf_jogador) THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você só pode avaliar atletas da sua cidade (UF diferente).');
  END IF;

  SELECT total_votos INTO v_votos_hoje FROM public.votos_diarios
  WHERE votante_id = v_avaliador_id AND data = CURRENT_DATE;
  IF v_votos_hoje >= 20 THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você atingiu o limite de 20 avaliações por dia.');
  END IF;

  SELECT COALESCE(reputacao, 1.0) INTO v_reputacao FROM public.profiles WHERE id = v_avaliador_id;

  INSERT INTO public.avaliacoes (
    avaliador_id, jogador_id,
    arremesso, finalizacao, controle_de_bola, passe_visao,
    defesa_perimetral, defesa_garrafao, rebote,
    velocidade_agilidade, explosao_forca, hustle_equipe,
    -- espelho legado (mantém telas antigas e constraints NOT NULL)
    defesa, explosao_fisica, visao_de_jogo,
    peso_voto, comentario
  ) VALUES (
    v_avaliador_id, p_jogador_id,
    p_arremesso, p_finalizacao, p_controle_de_bola, p_passe_visao,
    p_defesa_perimetral, p_defesa_garrafao, p_rebote,
    p_velocidade_agilidade, p_explosao_forca, p_hustle_equipe,
    ROUND((p_defesa_perimetral + p_defesa_garrafao) / 2.0)::int,
    p_explosao_forca,
    p_passe_visao,
    v_reputacao, p_comentario
  )
  ON CONFLICT (avaliador_id, jogador_id) DO UPDATE SET
    arremesso = EXCLUDED.arremesso,
    finalizacao = EXCLUDED.finalizacao,
    controle_de_bola = EXCLUDED.controle_de_bola,
    passe_visao = EXCLUDED.passe_visao,
    defesa_perimetral = EXCLUDED.defesa_perimetral,
    defesa_garrafao = EXCLUDED.defesa_garrafao,
    rebote = EXCLUDED.rebote,
    velocidade_agilidade = EXCLUDED.velocidade_agilidade,
    explosao_forca = EXCLUDED.explosao_forca,
    hustle_equipe = EXCLUDED.hustle_equipe,
    defesa = EXCLUDED.defesa,
    explosao_fisica = EXCLUDED.explosao_fisica,
    visao_de_jogo = EXCLUDED.visao_de_jogo,
    peso_voto = EXCLUDED.peso_voto,
    comentario = EXCLUDED.comentario,
    updated_at = NOW()
  RETURNING id INTO v_avaliacao_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.avaliacoes
    WHERE id = v_avaliacao_id AND created_at::DATE = CURRENT_DATE AND updated_at::DATE <> CURRENT_DATE
  ) THEN
    INSERT INTO public.votos_diarios (votante_id, data, total_votos)
    VALUES (v_avaliador_id, CURRENT_DATE, 1)
    ON CONFLICT (votante_id, data)
    DO UPDATE SET total_votos = votos_diarios.total_votos + 1;
  END IF;

  INSERT INTO public.auditoria_votos (avaliacao_id, ip, device_id, localizacao, status)
  VALUES (v_avaliacao_id, p_ip, p_device_id, p_localizacao, 'aprovado');

  SELECT total_votos, media_estrelas INTO v_novo_total, v_nova_media
  FROM public.jogadores WHERE id = p_jogador_id;

  RETURN jsonb_build_object(
    'sucesso', TRUE,
    'total_votos', v_novo_total,
    'media_estrelas', v_nova_media,
    'mensagem', 'Avaliação registrada com sucesso!'
  );
END;
$$;

-- Recalcula todos os jogadores
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT jogador_id FROM public.avaliacoes LOOP
    UPDATE public.avaliacoes SET updated_at = COALESCE(updated_at, NOW()) WHERE jogador_id = r.jogador_id AND id = (
      SELECT id FROM public.avaliacoes WHERE jogador_id = r.jogador_id LIMIT 1
    );
  END LOOP;
END $$;

-- Recalculo direto (mais confiável)
UPDATE public.jogadores j SET
  total_votos = COALESCE((SELECT COUNT(*) FROM public.avaliacoes a WHERE a.jogador_id = j.id), 0),
  media_estrelas = COALESCE((
    SELECT ROUND(AVG((
      a.arremesso
      + COALESCE(a.finalizacao, a.arremesso)
      + a.controle_de_bola
      + COALESCE(a.passe_visao, a.visao_de_jogo)
      + COALESCE(a.defesa_perimetral, a.defesa)
      + COALESCE(a.defesa_garrafao, a.defesa)
      + COALESCE(a.rebote, a.defesa)
      + COALESCE(a.velocidade_agilidade, a.explosao_fisica)
      + COALESCE(a.explosao_forca, a.explosao_fisica)
      + COALESCE(a.hustle_equipe, a.defesa)
    ) / 10.0)::numeric, 2)
    FROM public.avaliacoes a WHERE a.jogador_id = j.id
  ), 0);

SELECT 'migration_avaliacao_10_fundamentos aplicada' AS status;
