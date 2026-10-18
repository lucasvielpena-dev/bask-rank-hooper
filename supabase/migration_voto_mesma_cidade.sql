-- ============================================================
-- VOTO SÓ NA MESMA CIDADE + limpeza de votos cruzados
-- ============================================================
-- Regra: só pode avaliar atleta da mesma cidade (e UF, se ambos tiverem).
-- Avaliações antigas entre cidades diferentes são removidas e as médias
-- dos jogadores afetados são recalculadas pelo trigger.

-- 1) Helper: normaliza cidade para comparação
CREATE OR REPLACE FUNCTION public.normalizar_cidade(p TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both FROM lower(coalesce(p, '')));
$$;

-- 2) Atualiza registrar_avaliacao com checagem de cidade
CREATE OR REPLACE FUNCTION public.registrar_avaliacao(
  p_jogador_id UUID,
  p_arremesso INTEGER,
  p_defesa INTEGER,
  p_controle_de_bola INTEGER,
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

  IF p_arremesso < 1 OR p_arremesso > 5 OR
     p_defesa < 1 OR p_defesa > 5 OR
     p_controle_de_bola < 1 OR p_controle_de_bola > 5 OR
     p_explosao_fisica < 1 OR p_explosao_fisica > 5 OR
     p_visao_de_jogo < 1 OR p_visao_de_jogo > 5 THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Todas as notas devem ser de 1 a 5.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jogadores WHERE id = p_jogador_id AND ativo = TRUE) THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Jogador não encontrado.');
  END IF;

  SELECT player_id INTO v_jogador_player_id
  FROM public.profiles WHERE id = v_avaliador_id;

  IF v_jogador_player_id = p_jogador_id THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você não pode avaliar a si mesmo.');
  END IF;

  -- Cidade do atleta avaliado
  SELECT j.cidade, j.uf INTO v_cidade_jogador, v_uf_jogador
  FROM public.jogadores j WHERE j.id = p_jogador_id;

  -- Cidade do avaliador (prioriza cidade_atual)
  SELECT COALESCE(NULLIF(trim(p.cidade_atual), ''), NULLIF(trim(p.cidade), '')),
         NULLIF(trim(p.uf), '')
  INTO v_cidade_avaliador, v_uf_avaliador
  FROM public.profiles p WHERE p.id = v_avaliador_id;

  IF v_cidade_avaliador IS NULL OR public.normalizar_cidade(v_cidade_avaliador) = '' THEN
    RETURN jsonb_build_object(
      'sucesso', FALSE,
      'erro', 'Defina sua cidade (localização) antes de avaliar atletas.'
    );
  END IF;

  IF v_cidade_jogador IS NULL OR public.normalizar_cidade(v_cidade_jogador) = '' THEN
    RETURN jsonb_build_object(
      'sucesso', FALSE,
      'erro', 'Este atleta ainda não tem cidade definida e não pode ser avaliado.'
    );
  END IF;

  IF public.normalizar_cidade(v_cidade_avaliador) <> public.normalizar_cidade(v_cidade_jogador) THEN
    RETURN jsonb_build_object(
      'sucesso', FALSE,
      'erro', 'Você só pode avaliar atletas da sua cidade. Em outras cidades, apenas consulte o ranking.'
    );
  END IF;

  -- UF: se os dois tiverem, precisam bater
  IF v_uf_avaliador IS NOT NULL AND v_uf_jogador IS NOT NULL
     AND upper(v_uf_avaliador) <> upper(v_uf_jogador) THEN
    RETURN jsonb_build_object(
      'sucesso', FALSE,
      'erro', 'Você só pode avaliar atletas da sua cidade (UF diferente).'
    );
  END IF;

  SELECT total_votos INTO v_votos_hoje
  FROM public.votos_diarios
  WHERE votante_id = v_avaliador_id AND data = CURRENT_DATE;

  IF v_votos_hoje >= 20 THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você atingiu o limite de 20 avaliações por dia.');
  END IF;

  SELECT COALESCE(reputacao, 1.0) INTO v_reputacao
  FROM public.profiles WHERE id = v_avaliador_id;

  INSERT INTO public.avaliacoes (
    avaliador_id, jogador_id, arremesso, defesa, controle_de_bola, explosao_fisica, visao_de_jogo, peso_voto, comentario
  )
  VALUES (
    v_avaliador_id, p_jogador_id, p_arremesso, p_defesa, p_controle_de_bola, p_explosao_fisica, p_visao_de_jogo, v_reputacao, p_comentario
  )
  ON CONFLICT (avaliador_id, jogador_id)
  DO UPDATE SET
    arremesso = EXCLUDED.arremesso,
    defesa = EXCLUDED.defesa,
    controle_de_bola = EXCLUDED.controle_de_bola,
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

-- 3) Remove avaliações entre cidades diferentes
-- Compara cidade do atleta (jogadores) com cidade do avaliador (profiles)
DELETE FROM public.avaliacoes a
USING public.jogadores j, public.profiles p
WHERE a.jogador_id = j.id
  AND a.avaliador_id = p.id
  AND (
    -- cidades diferentes (normalizadas)
    public.normalizar_cidade(j.cidade)
      IS DISTINCT FROM
    public.normalizar_cidade(COALESCE(NULLIF(trim(p.cidade_atual), ''), p.cidade))
    OR
    -- UF diferente quando ambos existem
    (
      NULLIF(trim(j.uf), '') IS NOT NULL
      AND NULLIF(trim(p.uf), '') IS NOT NULL
      AND upper(trim(j.uf)) <> upper(trim(p.uf))
    )
  );

-- 4) O trigger trg_atualizar_media_jogador recalcula ao DELETE.
-- Reforço: zera quem ficou sem avaliações (caso edge)
UPDATE public.jogadores j
SET
  total_votos = COALESCE((SELECT COUNT(*) FROM public.avaliacoes av WHERE av.jogador_id = j.id), 0),
  media_estrelas = COALESCE((
    SELECT ROUND(AVG((av.arremesso + av.defesa + av.controle_de_bola + av.explosao_fisica + av.visao_de_jogo) / 5.0)::numeric, 2)
    FROM public.avaliacoes av WHERE av.jogador_id = j.id
  ), 0)
WHERE TRUE;

SELECT 'migration_voto_mesma_cidade aplicada' AS status;
