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
CREATE TABLE public.profiles (
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
  media_passe NUMERIC(3,2) DEFAULT 0,
  media_fisicalidade NUMERIC(3,2) DEFAULT 0,
  media_mentalidade NUMERIC(3,2) DEFAULT 0,
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
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_passe NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_fisicalidade NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS media_mentalidade NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS cidade TEXT DEFAULT 'Altamira';
ALTER TABLE public.jogadores ADD COLUMN IF NOT EXISTS uf TEXT DEFAULT 'PA';

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
  passe INTEGER NOT NULL CHECK (passe BETWEEN 1 AND 5),
  fisicalidade INTEGER NOT NULL CHECK (fisicalidade BETWEEN 1 AND 5),
  mentalidade INTEGER NOT NULL CHECK (mentalidade BETWEEN 1 AND 5),
  peso_voto NUMERIC DEFAULT 1.0 NOT NULL,
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
  v_passe NUMERIC(3,2);
  v_fisicalidade NUMERIC(3,2);
  v_mentalidade NUMERIC(3,2);
  v_media_estrelas NUMERIC(3,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_jogador_id := OLD.jogador_id;
  ELSE
    v_jogador_id := NEW.jogador_id;
  END IF;

  -- Obter a contagem total de avaliações exclusivas
  SELECT COUNT(*) INTO v_total_votos
  FROM public.avaliacoes
  WHERE jogador_id = v_jogador_id;

  IF v_total_votos = 0 THEN
    UPDATE public.jogadores
    SET
      total_votos = 0,
      media_estrelas = 0.00,
      media_arremesso = 0.00,
      media_defesa = 0.00,
      media_passe = 0.00,
      media_fisicalidade = 0.00,
      media_mentalidade = 0.00,
      updated_at = NOW()
    WHERE id = v_jogador_id;
  ELSE
    -- Calcular a soma dos pesos
    SELECT SUM(peso_voto) INTO v_peso_total
    FROM public.avaliacoes
    WHERE jogador_id = v_jogador_id;

    IF v_peso_total IS NULL OR v_peso_total = 0 THEN
      v_peso_total := 1.0;
    END IF;

    -- Calcular médias ponderadas de cada fundamento
    SELECT
      ROUND(SUM(arremesso * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(defesa * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(passe * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(fisicalidade * peso_voto)::NUMERIC / v_peso_total, 2),
      ROUND(SUM(mentalidade * peso_voto)::NUMERIC / v_peso_total, 2)
    INTO
      v_arremesso,
      v_defesa,
      v_passe,
      v_fisicalidade,
      v_mentalidade
    FROM public.avaliacoes
    WHERE jogador_id = v_jogador_id;

    -- Calcular a média geral como a média simples das cinco médias de fundamentos
    v_media_estrelas := ROUND((v_arremesso + v_defesa + v_passe + v_fisicalidade + v_mentalidade) / 5.0, 2);

    UPDATE public.jogadores
    SET
      total_votos = v_total_votos,
      media_estrelas = v_media_estrelas,
      media_arremesso = v_arremesso,
      media_defesa = v_defesa,
      media_passe = v_passe,
      media_fisicalidade = v_fisicalidade,
      media_mentalidade = v_mentalidade,
      updated_at = NOW()
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
  p_passe INTEGER,
  p_fisicalidade INTEGER,
  p_mentalidade INTEGER,
  p_ip TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_localizacao TEXT DEFAULT NULL
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
  -- Verificar autenticação
  IF v_avaliador_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você precisa estar logado para avaliar.');
  END IF;

  -- Verificar notas
  IF p_arremesso < 1 OR p_arremesso > 5 OR
     p_defesa < 1 OR p_defesa > 5 OR
     p_passe < 1 OR p_passe > 5 OR
     p_fisicalidade < 1 OR p_fisicalidade > 5 OR
     p_mentalidade < 1 OR p_mentalidade > 5 THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Todas as notas devem ser de 1 a 5.');
  END IF;

  -- Verificar se o jogador existe
  IF NOT EXISTS (SELECT 1 FROM public.jogadores WHERE id = p_jogador_id AND ativo = TRUE) THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Jogador não encontrado.');
  END IF;

  -- Verificar se o jogador é o próprio usuário (antifraude)
  SELECT player_id INTO v_jogador_player_id
  FROM public.profiles
  WHERE id = v_avaliador_id;

  IF v_jogador_player_id = p_jogador_id THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você não pode avaliar a si mesmo.');
  END IF;

  -- Verificar limite diário de 20 votos (antifraude)
  SELECT total_votos INTO v_votos_hoje
  FROM public.votos_diarios
  WHERE votante_id = v_avaliador_id AND data = CURRENT_DATE;

  IF v_votos_hoje >= 20 THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você atingiu o limite de 20 avaliações por dia.');
  END IF;

  -- Obter reputação do avaliador
  SELECT COALESCE(reputacao, 1.0) INTO v_reputacao
  FROM public.profiles
  WHERE id = v_avaliador_id;

  -- Inserir ou atualizar avaliação
  INSERT INTO public.avaliacoes (
    avaliador_id, jogador_id, arremesso, defesa, passe, fisicalidade, mentalidade, peso_voto
  )
  VALUES (
    v_avaliador_id, p_jogador_id, p_arremesso, p_defesa, p_passe, p_fisicalidade, p_mentalidade, v_reputacao
  )
  ON CONFLICT (avaliador_id, jogador_id)
  DO UPDATE SET
    arremesso = EXCLUDED.arremesso,
    defesa = EXCLUDED.defesa,
    passe = EXCLUDED.passe,
    fisicalidade = EXCLUDED.fisicalidade,
    mentalidade = EXCLUDED.mentalidade,
    peso_voto = EXCLUDED.peso_voto,
    updated_at = NOW()
  RETURNING id INTO v_avaliacao_id;

  -- Atualizar contador diário de votos se for uma avaliação nova hoje
  IF NOT EXISTS (
    SELECT 1 FROM public.avaliacoes
    WHERE id = v_avaliacao_id AND created_at::DATE = CURRENT_DATE AND updated_at::DATE <> CURRENT_DATE
  ) THEN
    INSERT INTO public.votos_diarios (votante_id, data, total_votos)
    VALUES (v_avaliador_id, CURRENT_DATE, 1)
    ON CONFLICT (votante_id, data)
    DO UPDATE SET total_votos = votos_diarios.total_votos + 1;
  END IF;

  -- Inserir registro de auditoria
  INSERT INTO public.auditoria_votos (avaliacao_id, ip, device_id, localizacao, status)
  VALUES (v_avaliacao_id, p_ip, p_device_id, p_localizacao, 'aprovado');

  -- Obter novos valores do jogador (recalculados via trigger)
  SELECT total_votos, media_estrelas INTO v_novo_total, v_nova_media
  FROM public.jogadores
  WHERE id = p_jogador_id;

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
        uf = NEW.uf
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
  -- Cria o registro do atleta na tabela jogadores assim que o cadastro_completo do perfil muda para TRUE
  IF NEW.cadastro_completo = TRUE AND (OLD.cadastro_completo = FALSE OR OLD.cadastro_completo IS NULL) AND NEW.player_id IS NULL THEN
    INSERT INTO public.jogadores (
      nome,
      apelido,
      foto_url,
      criado_por,
      cidade,
      uf,
      total_votos,
      media_estrelas
    ) VALUES (
      NEW.nome_completo,
      NEW.apelido,
      NEW.foto_perfil,
      NEW.id,
      NEW.cidade_atual,
      NEW.uf,
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

-- Nova Função: buscar ranking municipal (mínimo 10 avaliações para aparecer)
CREATE OR REPLACE FUNCTION public.get_ranking(
  p_cidade TEXT,
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
  media_passe NUMERIC,
  media_fisicalidade NUMERIC,
  media_mentalidade NUMERIC,
  cidade TEXT,
  uf TEXT,
  pais TEXT,
  posicao INTEGER
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
    j.media_passe,
    j.media_fisicalidade,
    j.media_mentalidade,
    j.cidade,
    j.uf,
    j.pais,
    ROW_NUMBER() OVER (
      ORDER BY j.media_estrelas DESC, j.total_votos DESC
    )::INTEGER AS posicao
  FROM public.jogadores j
  WHERE j.ativo = TRUE
    AND j.total_votos >= 10  -- Filtro de relevância estatística (mínimo 10 avaliações)
    AND LOWER(j.cidade) = LOWER(p_cidade)
  ORDER BY j.media_estrelas DESC, j.total_votos DESC
  LIMIT p_limit;
END;
$$;

-- Função: sortear 2 jogadores aleatórios da mesma cidade para votação (excluindo o próprio usuário e já avaliados)
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
DECLARE
  v_cidade TEXT;
BEGIN
  -- Obter a cidade atual do usuário logado
  SELECT cidade_atual INTO v_cidade
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_cidade IS NULL THEN
    v_cidade := 'Altamira';
  END IF;

  RETURN QUERY
  WITH meu_player AS (
    SELECT player_id FROM public.profiles WHERE id = auth.uid()
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
    AND LOWER(j.cidade) = LOWER(v_cidade) -- Filtrar apenas jogadores da mesma cidade
    AND (SELECT player_id FROM meu_player) IS DISTINCT FROM j.id
  ORDER BY RANDOM()
  LIMIT 2;
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
