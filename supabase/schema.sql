-- ============================================================
-- RANKS HOOPS - Altamira, Pará, Brasil
-- Schema completo: tabelas, RLS, funções e automações
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- Comentado para evitar erro se a extensão não estiver disponível

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfis de usuários (extends auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  apelido TEXT,
  email TEXT,
  foto_perfil TEXT,
  altura NUMERIC,
  idade INTEGER,
  cadastro_completo BOOLEAN DEFAULT FALSE,
  is_player BOOLEAN DEFAULT FALSE,
  player_id UUID,
  posicao TEXT,
  cidade TEXT DEFAULT 'Altamira',
  uf TEXT DEFAULT 'PA',
  pais TEXT DEFAULT 'Brasil',
  latitude NUMERIC,
  longitude NUMERIC,
  reputacao NUMERIC DEFAULT 1.0,
  cidade_atual TEXT DEFAULT 'Altamira',
  latitude_atual NUMERIC,
  longitude_atual NUMERIC,
  ultima_verificacao_localizacao TIMESTAMPTZ DEFAULT NOW(),
  ultima_mudanca_cidade TIMESTAMPTZ DEFAULT NOW(),
  cidade_detectada TEXT,
  uf_detectada TEXT,
  data_primeira_deteccao TIMESTAMPTZ,
  tema_preferido TEXT DEFAULT 'system' CHECK (tema_preferido IN ('light', 'dark', 'system')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir colunas para bancos de dados já existentes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cidade TEXT DEFAULT 'Altamira';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS posicao TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uf TEXT DEFAULT 'PA';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'Brasil';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputacao NUMERIC DEFAULT 1.0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cidade_atual TEXT DEFAULT 'Altamira';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude_atual NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude_atual NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ultima_verificacao_localizacao TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ultima_mudanca_cidade TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cidade_detectada TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uf_detectada TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_primeira_deteccao TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tema_preferido TEXT DEFAULT 'system' CHECK (tema_preferido IN ('light', 'dark', 'system'));

-- Jogadores cadastrados
CREATE TABLE IF NOT EXISTS public.jogadores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  apelido TEXT,
  posicao TEXT,
  foto_url TEXT,
  criado_por UUID REFERENCES auth.users(id),
  -- Estatísticas de avaliação (peer voting)
  total_votos INTEGER DEFAULT 0,
  votos_semana INTEGER DEFAULT 0,        -- reset toda semana
  media_estrelas NUMERIC(3,2) DEFAULT 0, -- recalculada a cada voto
  soma_estrelas INTEGER DEFAULT 0,       -- acumulado total para cálculo
  -- Fundamentos individuais
  media_arremesso NUMERIC(3,2) DEFAULT 0,
  media_defesa NUMERIC(3,2) DEFAULT 0,
  media_controle_de_bola NUMERIC(3,2) DEFAULT 0,
  media_explosao_fisica NUMERIC(3,2) DEFAULT 0,
  media_visao_de_jogo NUMERIC(3,2) DEFAULT 0,
  -- Localização
  cidade TEXT DEFAULT 'Altamira',
  uf TEXT DEFAULT 'PA',
  pais TEXT DEFAULT 'Brasil',
  -- Status
  atual_campeao BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir colunas de cidade e fundamentos caso a tabela já existisse
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_arremesso NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_defesa NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_controle_de_bola NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_explosao_fisica NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_visao_de_jogo NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS cidade TEXT DEFAULT 'Altamira';
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS uf TEXT DEFAULT 'PA';
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'Brasil';

-- Garantir coluna comentario caso a tabela já existisse
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS comentario TEXT;

-- Votos individuais
CREATE TABLE IF NOT EXISTS public.votos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  votante_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  jogador_id UUID REFERENCES public.jogadores(id) ON DELETE CASCADE NOT NULL,
  estrelas INTEGER NOT NULL CHECK (estrelas BETWEEN 1 AND 5),
  data_voto DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (votante_id, jogador_id, data_voto)
);

-- Controle de votos diários por usuário (antifraude)
CREATE TABLE IF NOT EXISTS public.votos_diarios (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  votante_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  total_votos INTEGER DEFAULT 0,
  UNIQUE (votante_id, data)
);

-- Avaliações Community de 5 Aspectos
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  avaliador_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  jogador_id UUID REFERENCES public.jogadores(id) ON DELETE CASCADE NOT NULL,
  arremesso INTEGER NOT NULL CHECK (arremesso BETWEEN 1 AND 5),
  defesa INTEGER NOT NULL CHECK (defesa BETWEEN 1 AND 5),
  controle_de_bola INTEGER NOT NULL CHECK (controle_de_bola BETWEEN 1 AND 5),
  explosao_fisica INTEGER NOT NULL CHECK (explosao_fisica BETWEEN 1 AND 5),
  visao_de_jogo INTEGER NOT NULL CHECK (visao_de_jogo BETWEEN 1 AND 5),
  peso_voto NUMERIC DEFAULT 1.0 NOT NULL,
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (avaliador_id, jogador_id)
);

-- Auditoria de votos e avaliações suspeitas
CREATE TABLE IF NOT EXISTS public.auditoria_votos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  avaliacao_id UUID REFERENCES public.avaliacoes(id) ON DELETE CASCADE NOT NULL,
  ip TEXT,
  device_id TEXT,
  localizacao TEXT,
  status TEXT DEFAULT 'aprovado',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de campeões semanais
CREATE TABLE IF NOT EXISTS public.campeoes_semana (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  jogador_id UUID REFERENCES public.jogadores(id),
  nome_jogador TEXT NOT NULL,
  media_estrelas NUMERIC(3,2),
  total_votos INTEGER,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  registrado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Jogos da noite
CREATE TABLE IF NOT EXISTS public.jogos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'finalizado', 'cancelado')),
  criado_por UUID REFERENCES auth.users(id),
  times JSONB DEFAULT '[]', -- [{nome, jogadores: [id...]}]
  placar JSONB DEFAULT '{}', -- {time1: 0, time2: 0}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estatísticas individuais de partidas
CREATE TABLE IF NOT EXISTS public.estatisticas_partida (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  jogo_id UUID REFERENCES public.jogos(id) ON DELETE CASCADE,
  jogador_id UUID REFERENCES public.jogadores(id),
  pontos INTEGER DEFAULT 0,
  rebotes INTEGER DEFAULT 0,
  assistencias INTEGER DEFAULT 0,
  roubos INTEGER DEFAULT 0,
  bloqueios INTEGER DEFAULT 0,
  arremessos_tentados INTEGER DEFAULT 0,
  arremessos_convertidos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_jogadores_media ON public.jogadores(media_estrelas DESC, total_votos DESC);
CREATE INDEX IF NOT EXISTS idx_votos_jogador ON public.votos(jogador_id);
CREATE INDEX IF NOT EXISTS idx_votos_votante_data ON public.votos(votante_id, data_voto);
CREATE INDEX IF NOT EXISTS idx_votos_diarios_votante ON public.votos_diarios(votante_id, data);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jogadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votos_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campeoes_semana ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estatisticas_partida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_votos ENABLE ROW LEVEL SECURITY;

-- Profiles: usuário vê/edita apenas o próprio; todos podem ver
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Jogadores: todos podem ver; autenticados podem inserir
DROP POLICY IF EXISTS "jogadores_select_all" ON public.jogadores;
DROP POLICY IF EXISTS "jogadores_insert_auth" ON public.jogadores;
DROP POLICY IF EXISTS "jogadores_update_auth" ON public.jogadores;
CREATE POLICY "jogadores_select_all" ON public.jogadores FOR SELECT USING (TRUE);
CREATE POLICY "jogadores_insert_auth" ON public.jogadores FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "jogadores_update_auth" ON public.jogadores FOR UPDATE USING (auth.role() = 'authenticated');

-- Votos: usuário vê e insere apenas os próprios
DROP POLICY IF EXISTS "votos_select_own" ON public.votos;
DROP POLICY IF EXISTS "votos_insert_own" ON public.votos;
CREATE POLICY "votos_select_own" ON public.votos FOR SELECT USING (auth.uid() = votante_id);
CREATE POLICY "votos_insert_own" ON public.votos FOR INSERT WITH CHECK (auth.uid() = votante_id);

-- Votos diários: usuário gerencia apenas os próprios
DROP POLICY IF EXISTS "votos_diarios_own" ON public.votos_diarios;
CREATE POLICY "votos_diarios_own" ON public.votos_diarios FOR ALL USING (auth.uid() = votante_id);

-- Campeões: público para leitura
DROP POLICY IF EXISTS "campeoes_select_all" ON public.campeoes_semana;
CREATE POLICY "campeoes_select_all" ON public.campeoes_semana FOR SELECT USING (TRUE);

-- Jogos: todos veem; autenticados criam
DROP POLICY IF EXISTS "jogos_select_all" ON public.jogos;
DROP POLICY IF EXISTS "jogos_insert_auth" ON public.jogos;
DROP POLICY IF EXISTS "jogos_update_auth" ON public.jogos;
CREATE POLICY "jogos_select_all" ON public.jogos FOR SELECT USING (TRUE);
CREATE POLICY "jogos_insert_auth" ON public.jogos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "jogos_update_auth" ON public.jogos FOR UPDATE USING (auth.role() = 'authenticated');

-- Estatísticas: todos veem; autenticados inserem
DROP POLICY IF EXISTS "stats_select_all" ON public.estatisticas_partida;
DROP POLICY IF EXISTS "stats_insert_auth" ON public.estatisticas_partida;
CREATE POLICY "stats_select_all" ON public.estatisticas_partida FOR SELECT USING (TRUE);
CREATE POLICY "stats_insert_auth" ON public.estatisticas_partida FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Avaliações: todos veem; usuários criam/atualizam a própria
DROP POLICY IF EXISTS "avaliacoes_select_all" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_insert_own" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_update_own" ON public.avaliacoes;
CREATE POLICY "avaliacoes_select_all" ON public.avaliacoes FOR SELECT USING (TRUE);
CREATE POLICY "avaliacoes_insert_own" ON public.avaliacoes FOR INSERT WITH CHECK (auth.uid() = avaliador_id);
CREATE POLICY "avaliacoes_update_own" ON public.avaliacoes FOR UPDATE USING (auth.uid() = avaliador_id);

-- Auditoria: leitura pública
DROP POLICY IF EXISTS "auditoria_select_all" ON public.auditoria_votos;
CREATE POLICY "auditoria_select_all" ON public.auditoria_votos FOR SELECT USING (TRUE);

-- ============================================================
-- FUNÇÕES DE NEGÓCIO
-- ============================================================

-- ============================================================
-- TRIGGER: atualizar médias dos jogadores após avaliações
-- ============================================================
CREATE OR REPLACE FUNCTION public.atualizar_media_jogador()
RETURNS TRIGGER AS $$
DECLARE
  v_jogador_id UUID;
  v_total_votos INTEGER;
  v_peso_total NUMERIC;
  v_arremesso NUMERIC(3,2);
  v_defesa NUMERIC(3,2);
  v_controle_de_bola NUMERIC(3,2);
  v_explosao_fisica NUMERIC(3,2);
  v_visao_de_jogo NUMERIC(3,2);
  v_media_estrelas NUMERIC(3,2);
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
      total_votos = 0, media_estrelas = 0.00,
      media_arremesso = 0.00, media_defesa = 0.00,
      media_controle_de_bola = 0.00, media_explosao_fisica = 0.00,
      media_visao_de_jogo = 0.00, updated_at = NOW()
    WHERE id = v_jogador_id;
  ELSE
    SELECT SUM(peso_voto) INTO v_peso_total
    FROM public.avaliacoes WHERE jogador_id = v_jogador_id;

    IF v_peso_total IS NULL OR v_peso_total = 0 THEN
      v_peso_total := 1.0;
    END IF;

    SELECT
      ROUND(SUM(arremesso * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(defesa * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(controle_de_bola * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(explosao_fisica * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(visao_de_jogo * peso_voto)::NUMERIC / v_peso_total, 2)
    INTO v_arremesso, v_defesa, v_controle_de_bola, v_explosao_fisica, v_visao_de_jogo
    FROM public.avaliacoes WHERE jogador_id = v_jogador_id;

    v_media_estrelas := ROUND((v_arremesso + v_defesa + v_controle_de_bola + v_explosao_fisica + v_visao_de_jogo) / 5.0, 2);

    UPDATE public.jogadores SET
      total_votos = v_total_votos, media_estrelas = v_media_estrelas,
      media_arremesso = v_arremesso, media_defesa = v_defesa,
      media_controle_de_bola = v_controle_de_bola, media_explosao_fisica = v_explosao_fisica,
      media_visao_de_jogo = v_visao_de_jogo, updated_at = NOW()
    WHERE id = v_jogador_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_atualizar_media_jogador ON public.avaliacoes;
CREATE TRIGGER trg_atualizar_media_jogador
  AFTER INSERT OR UPDATE OR DELETE ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_media_jogador();

-- Nova Função: registrar avaliação de 5 aspectos
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

-- Trigger para sincronizar a cidade do jogador quando a cidade_atual do profile mudar
CREATE OR REPLACE FUNCTION public.sincronizar_dados_jogador()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.player_id IS NOT NULL THEN
      UPDATE public.jogadores
      SET 
        nome = NEW.nome_completo,
        apelido = NEW.apelido,
        foto_url = NEW.foto_perfil,
        cidade = NEW.cidade_atual, 
        uf = NEW.uf,
        posicao = NEW.posicao
      WHERE id = NEW.player_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sincronizar_cidade_jogador ON public.profiles;
DROP TRIGGER IF EXISTS trg_sincronizar_dados_jogador ON public.profiles;
CREATE TRIGGER trg_sincronizar_dados_jogador
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_dados_jogador();

CREATE OR REPLACE FUNCTION public.criar_jogador_ao_completar_perfil()
RETURNS TRIGGER AS $$
DECLARE
  v_jogador_id UUID;
BEGIN
  -- Cria o registro do atleta na tabela jogadores se o cadastro_completo for TRUE e ainda não tiver player_id
  IF NEW.cadastro_completo = TRUE AND NEW.player_id IS NULL THEN
    INSERT INTO public.jogadores (
      nome,
      apelido,
      foto_url,
      criado_por,
      cidade,
      uf,
      posicao,
      total_votos,
      media_estrelas
    ) VALUES (
      NEW.nome_completo,
      NEW.apelido,
      NEW.foto_perfil,
      NEW.id,
      NEW.cidade_atual,
      NEW.uf,
      NEW.posicao,
      0,
      0.00
    ) RETURNING id INTO v_jogador_id;

    NEW.player_id := v_jogador_id;
    NEW.is_player := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_criar_jogador_ao_completar_perfil ON public.profiles;
CREATE TRIGGER trg_criar_jogador_ao_completar_perfil
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.criar_jogador_ao_completar_perfil();


DROP FUNCTION IF EXISTS public.get_ranking(INTEGER);
DROP FUNCTION IF EXISTS public.get_ranking(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_ranking(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_ranking();

-- Função: buscar ranking por município/estado (mínimo 1 avaliação para aparecer)
CREATE OR REPLACE FUNCTION public.get_ranking(
  p_cidade TEXT DEFAULT NULL,
  p_uf TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
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
  posicao_ranking INTEGER
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
      ORDER BY j.media_estrelas DESC, j.total_votos DESC
    )::INTEGER AS posicao_ranking
  FROM public.jogadores j
  WHERE j.ativo = TRUE
    AND j.total_votos >= 1
    AND (p_cidade IS NULL OR j.cidade = p_cidade)
    AND (p_uf IS NULL OR j.uf = p_uf)
  ORDER BY j.media_estrelas DESC, j.total_votos DESC
  LIMIT p_limit;
END;
$$;

-- Função: sortear jogadores aleatórios para votação do mesmo estado (excluindo o próprio usuário e já avaliados)
CREATE OR REPLACE FUNCTION public.sortear_jogadores_para_voto()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  apelido TEXT,
  foto_url TEXT,
  media_estrelas NUMERIC,
  total_votos INTEGER,
  ja_votou_hoje BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH meu_player AS (
    SELECT player_id, uf FROM public.profiles WHERE id = auth.uid()
  ),
  avaliacoes_existentes AS (
    SELECT jogador_id FROM public.avaliacoes
    WHERE avaliador_id = auth.uid()
  )
  SELECT
    j.id,
    j.nome,
    j.apelido,
    j.foto_url,
    j.media_estrelas,
    j.total_votos,
    (j.id IN (SELECT jogador_id FROM avaliacoes_existentes)) AS ja_votou_hoje
  FROM public.jogadores j
  WHERE j.ativo = TRUE
    AND (SELECT player_id FROM meu_player) IS DISTINCT FROM j.id
    AND j.uf = (SELECT COALESCE(uf, 'PA') FROM public.profiles WHERE id = auth.uid())
  ORDER BY RANDOM()
  LIMIT 5;
END;
$$;


-- Função: verificar status de voto do usuário hoje
CREATE OR REPLACE FUNCTION public.get_status_voto_hoje()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'votos_hoje', COALESCE(vd.total_votos, 0),
    'limite_diario', 20,
    'restantes', GREATEST(0, 20 - COALESCE(vd.total_votos, 0))
  )
  FROM (SELECT 1) t
  LEFT JOIN public.votos_diarios vd
    ON vd.votante_id = auth.uid() AND vd.data = CURRENT_DATE;
$$;

-- ============================================================
-- ROTINA SEMANAL (CRON JOB) - Todo domingo às 23:59
-- ============================================================
CREATE OR REPLACE FUNCTION public.rotina_semanal_domingo()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campeao RECORD;
  v_semana_inicio DATE;
  v_semana_fim DATE;
BEGIN
  v_semana_fim := CURRENT_DATE;
  v_semana_inicio := CURRENT_DATE - INTERVAL '6 days';

  -- A. Identificar o campeão (1º lugar no ranking - mínimo 5 votos)
  SELECT id, nome, media_estrelas, total_votos
  INTO v_campeao
  FROM public.jogadores
  WHERE ativo = TRUE AND total_votos >= 5
  ORDER BY media_estrelas DESC, total_votos DESC
  LIMIT 1;

  IF v_campeao IS NOT NULL THEN
    -- A. Registrar na tabela de histórico
    INSERT INTO public.campeoes_semana (jogador_id, nome_jogador, media_estrelas, total_votos, semana_inicio, semana_fim)
    VALUES (v_campeao.id, v_campeao.nome, v_campeao.media_estrelas, v_campeao.total_votos, v_semana_inicio, v_semana_fim);

    -- B. Remover atual_campeao de todos e ativar apenas no novo campeão
    UPDATE public.jogadores SET atual_campeao = FALSE WHERE atual_campeao = TRUE;
    UPDATE public.jogadores SET atual_campeao = TRUE WHERE id = v_campeao.id;
  END IF;

  -- C. Reset técnico: reduzir 10% na média de estrelas de todos os jogadores
  UPDATE public.jogadores
  SET
    media_estrelas = ROUND(media_estrelas * 0.9, 2),
    soma_estrelas = ROUND(soma_estrelas * 0.9)::INTEGER,
    updated_at = NOW()
  WHERE ativo = TRUE;

  -- D. Zerar votos_semana (manter total_votos histórico intacto)
  UPDATE public.jogadores
  SET votos_semana = 0, updated_at = NOW()
  WHERE ativo = TRUE;

  RAISE LOG 'Rotina semanal executada com sucesso em %', NOW();
END;
$$;

-- Agendar cron job todo domingo às 23:59 (requer pg_cron habilitado no Supabase)
-- Execute este comando no SQL Editor do Supabase após habilitar pg_cron:
-- SELECT cron.schedule(
--   'rotina-semanal-domingo',
--   '59 23 * * 0', -- Toda domingo às 23:59
--   $$SELECT public.rotina_semanal_domingo()$$
-- );

-- ============================================================
-- TRIGGER: auto-criar profile ao registrar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, email, foto_perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABELAS PARA JOGOS DA NOITE (PARTIDAS E PARTICIPANTES)
-- ============================================================

-- Partidas
CREATE TABLE IF NOT EXISTS public.partidas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cidade TEXT DEFAULT 'Altamira',
  uf TEXT DEFAULT 'PA',
  time_a TEXT NOT NULL,
  time_b TEXT NOT NULL,
  placar_time_a INTEGER DEFAULT 0,
  placar_time_b INTEGER DEFAULT 0,
  tempo_total TEXT DEFAULT '00:00',
  periodos INTEGER DEFAULT 1,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'finalizado')),
  mvp_id UUID REFERENCES public.jogadores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participantes da partida
CREATE TABLE IF NOT EXISTS public.partida_jogadores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  partida_id UUID REFERENCES public.partidas(id) ON DELETE CASCADE NOT NULL,
  jogador_id UUID REFERENCES public.jogadores(id) ON DELETE CASCADE NOT NULL,
  time CHAR(1) CHECK (time IN ('A', 'B')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para Partidas e Participantes
ALTER TABLE public.partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partida_jogadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partidas_select_all" ON public.partidas;
DROP POLICY IF EXISTS "partidas_insert_auth" ON public.partidas;
DROP POLICY IF EXISTS "partidas_update_auth" ON public.partidas;
CREATE POLICY "partidas_select_all" ON public.partidas FOR SELECT USING (TRUE);
CREATE POLICY "partidas_insert_auth" ON public.partidas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "partidas_update_auth" ON public.partidas FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "partida_jogadores_select_all" ON public.partida_jogadores;
DROP POLICY IF EXISTS "partida_jogadores_insert_auth" ON public.partida_jogadores;
CREATE POLICY "partida_jogadores_select_all" ON public.partida_jogadores FOR SELECT USING (TRUE);
CREATE POLICY "partida_jogadores_insert_auth" ON public.partida_jogadores FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- DADOS DE EXEMPLO (opcional - remover em produção)
-- ============================================================
-- INSERT INTO public.jogadores (nome, apelido, posicao) VALUES
--   ('Felipe Santos', 'dd', 'Armador'),
--   ('Lucas Viel', 'viel', 'Ala'),
--   ('Eduardo Costa', 'boca de burro', 'Pivô');

-- ============================================================
-- AUDITORIA DE PRÉ-LANÇAMENTO: RESTRIÇÕES E TABELAS ADICIONAIS
-- ============================================================

-- 1. Restrição de integridade: arremessos convertidos <= tentados
ALTER TABLE public.estatisticas_partida DROP CONSTRAINT IF EXISTS chk_arremessos;
ALTER TABLE public.estatisticas_partida ADD CONSTRAINT chk_arremessos CHECK (arremessos_convertidos <= arremessos_tentados);

-- 2. Garantir apelidos únicos ativos por cidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_apelido ON public.profiles(apelido) WHERE apelido IS NOT NULL;

-- 3. Tabela de Denúncias (Pessoas, Avaliações, Condutas)
CREATE TABLE IF NOT EXISTS public.denuncias (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  denunciante_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  jogador_id UUID REFERENCES public.jogadores(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('perfil_falso', 'avaliacao_suspeita', 'comportamento_inadequado')),
  descricao TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'revisado', 'arquivado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para Denúncias
ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "denuncias_insert_auth" ON public.denuncias;
DROP POLICY IF EXISTS "denuncias_select_own" ON public.denuncias;
CREATE POLICY "denuncias_insert_auth" ON public.denuncias FOR INSERT WITH CHECK (auth.uid() = denunciante_id);
CREATE POLICY "denuncias_select_own" ON public.denuncias FOR SELECT USING (auth.uid() = denunciante_id);

-- 4. Tabela de Estatísticas Pessoais (Privadas e não integradas ao ranking)
CREATE TABLE IF NOT EXISTS public.estatisticas_pessoais (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data_partida DATE DEFAULT CURRENT_DATE NOT NULL,
  nome_jogador TEXT,
  
  pontos INTEGER DEFAULT 0,
  rebotes INTEGER DEFAULT 0,
  assistencias INTEGER DEFAULT 0,
  roubos_bola INTEGER DEFAULT 0,
  tocos INTEGER DEFAULT 0,
  perdas_bola INTEGER DEFAULT 0,
  
  arremessos_tentados INTEGER DEFAULT 0,
  arremessos_convertidos INTEGER DEFAULT 0,
  
  -- Opcionais avançados
  lance_livre_tentados INTEGER DEFAULT 0,
  lance_livre_convertidos INTEGER DEFAULT 0,
  dois_pontos_tentados INTEGER DEFAULT 0,
  dois_pontos_convertidos INTEGER DEFAULT 0,
  tres_pontos_tentados INTEGER DEFAULT 0,
  tres_pontos_convertidos INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir coluna para bancos de dados já existentes
ALTER TABLE public.estatisticas_pessoais ADD COLUMN IF NOT EXISTS nome_jogador TEXT;

-- RLS para Estatísticas Pessoais
ALTER TABLE public.estatisticas_pessoais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estatisticas_pessoais_select_own" ON public.estatisticas_pessoais;
DROP POLICY IF EXISTS "estatisticas_pessoais_insert_own" ON public.estatisticas_pessoais;
DROP POLICY IF EXISTS "estatisticas_pessoais_update_own" ON public.estatisticas_pessoais;
DROP POLICY IF EXISTS "estatisticas_pessoais_delete_own" ON public.estatisticas_pessoais;

CREATE POLICY "estatisticas_pessoais_select_own" ON public.estatisticas_pessoais FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "estatisticas_pessoais_insert_own" ON public.estatisticas_pessoais FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "estatisticas_pessoais_update_own" ON public.estatisticas_pessoais FOR UPDATE USING (auth.uid() = usuario_id);
CREATE POLICY "estatisticas_pessoais_delete_own" ON public.estatisticas_pessoais FOR DELETE USING (auth.uid() = usuario_id);

-- Habilitar Supabase Realtime para as tabelas relevantes de forma segura
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    JOIN pg_class c ON pr.prrelid = c.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'jogadores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jogadores;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    JOIN pg_class c ON pr.prrelid = c.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'avaliacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.avaliacoes;
  END IF;
END $$;

-- Fim do arquivo de schema de produção

-- ============================================================
-- ÍNDICES PARA PERFORMANCE E PRODUÇÃO
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_cidade_atual ON public.profiles(cidade_atual);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_jogador_id ON public.avaliacoes(jogador_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_avaliador_id ON public.avaliacoes(avaliador_id);
CREATE INDEX IF NOT EXISTS idx_partida_jogadores_partida_id ON public.partida_jogadores(partida_id);
CREATE INDEX IF NOT EXISTS idx_partida_jogadores_jogador_id ON public.partida_jogadores(jogador_id);
CREATE INDEX IF NOT EXISTS idx_votos_jogador_id ON public.votos(jogador_id);

-- ============================================================
-- SISTEMA DE NOTIFICAÇÕES
-- ============================================================

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "notificacoes_select_owner" ON public.notificacoes;
CREATE POLICY "notificacoes_select_owner" ON public.notificacoes
  FOR SELECT USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "notificacoes_update_owner" ON public.notificacoes;
CREATE POLICY "notificacoes_update_owner" ON public.notificacoes
  FOR UPDATE USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "notificacoes_delete_owner" ON public.notificacoes;
CREATE POLICY "notificacoes_delete_owner" ON public.notificacoes
  FOR DELETE USING (auth.uid() = usuario_id);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_id ON public.notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes(lida);

-- Função de trigger para criar notificação no recebimento de avaliação
CREATE OR REPLACE FUNCTION public.criar_notificacao_voto()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  -- Obter o id do usuário que é dono do jogador avaliado
  SELECT id INTO v_usuario_id
  FROM public.profiles
  WHERE player_id = NEW.jogador_id;

  -- Se houver um usuário associado e não for o próprio avaliador avaliando a si mesmo
  IF v_usuario_id IS NOT NULL AND v_usuario_id <> NEW.avaliador_id THEN
    INSERT INTO public.notificacoes (usuario_id, titulo, mensagem, lida)
    VALUES (
      v_usuario_id,
      'Nova avaliação recebida',
      'Você foi avaliado por outro jogador no Ranks Hoops.',
      FALSE
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar o trigger
DROP TRIGGER IF EXISTS trg_criar_notificacao_voto ON public.avaliacoes;
CREATE TRIGGER trg_criar_notificacao_voto
AFTER INSERT ON public.avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.criar_notificacao_voto();

-- Adicionar notificacoes ao canal de realtime
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    JOIN pg_class c ON pr.prrelid = c.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'notificacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
  END IF;
END $$;
