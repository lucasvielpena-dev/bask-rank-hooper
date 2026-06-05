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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  -- Status
  atual_campeao BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- ============================================================
-- FUNÇÕES DE NEGÓCIO
-- ============================================================

-- Função principal: registrar voto com todas as validações antifraude
CREATE OR REPLACE FUNCTION public.registrar_voto(
  p_jogador_id UUID,
  p_estrelas INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_votante_id UUID := auth.uid();
  v_hoje DATE := CURRENT_DATE;
  v_votos_hoje INTEGER;
  v_jogador_criado_por UUID;
  v_jogador_player_id UUID;
  v_voto_existente INTEGER;
  v_novo_total INTEGER;
  v_nova_soma INTEGER;
  v_nova_media NUMERIC(3,2);
BEGIN
  -- Verificar autenticação
  IF v_votante_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você precisa estar logado para votar.');
  END IF;

  -- Verificar se estrelas é válido
  IF p_estrelas < 1 OR p_estrelas > 5 THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Nota inválida. Use de 1 a 5 estrelas.');
  END IF;

  -- Buscar dados do jogador
  SELECT criado_por INTO v_jogador_criado_por FROM public.jogadores WHERE id = p_jogador_id AND ativo = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Jogador não encontrado.');
  END IF;

  -- Verificar se o jogador é o próprio usuário (ANTIFRAUDE: sem autofavoritismo)
  SELECT p.player_id INTO v_jogador_player_id
  FROM public.profiles p
  WHERE p.id = v_votante_id;

  IF v_jogador_player_id = p_jogador_id THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você não pode votar em si mesmo.');
  END IF;

  -- Verificar voto duplo no mesmo dia (ANTIFRAUDE: 1 voto por jogador por dia)
  SELECT COUNT(*) INTO v_voto_existente
  FROM public.votos
  WHERE votante_id = v_votante_id
    AND jogador_id = p_jogador_id
    AND data_voto = v_hoje;

  IF v_voto_existente > 0 THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você já votou neste jogador hoje. Volte amanhã!');
  END IF;

  -- Verificar limite diário de 20 votos (ANTIFRAUDE)
  SELECT total_votos INTO v_votos_hoje
  FROM public.votos_diarios
  WHERE votante_id = v_votante_id AND data = v_hoje;

  IF v_votos_hoje >= 20 THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você atingiu o limite de 20 votos por dia.');
  END IF;

  -- Inserir voto
  INSERT INTO public.votos (votante_id, jogador_id, estrelas)
  VALUES (v_votante_id, p_jogador_id, p_estrelas);

  -- Atualizar contador diário
  INSERT INTO public.votos_diarios (votante_id, data, total_votos)
  VALUES (v_votante_id, v_hoje, 1)
  ON CONFLICT (votante_id, data)
  DO UPDATE SET total_votos = votos_diarios.total_votos + 1;

  -- Recalcular média e atualizar jogador (atualização instantânea)
  UPDATE public.jogadores
  SET
    total_votos = total_votos + 1,
    votos_semana = votos_semana + 1,
    soma_estrelas = soma_estrelas + p_estrelas,
    media_estrelas = ROUND((soma_estrelas + p_estrelas)::NUMERIC / (total_votos + 1), 2),
    updated_at = NOW()
  WHERE id = p_jogador_id
  RETURNING total_votos, media_estrelas INTO v_novo_total, v_nova_media;

  RETURN jsonb_build_object(
    'sucesso', TRUE,
    'total_votos', v_novo_total,
    'media_estrelas', v_nova_media,
    'mensagem', 'Voto registrado com sucesso!'
  );
END;
$$;

-- Função: buscar ranking (mínimo 5 votos para aparecer)
CREATE OR REPLACE FUNCTION public.get_ranking(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  apelido TEXT,
  foto_url TEXT,
  media_estrelas NUMERIC,
  total_votos INTEGER,
  votos_semana INTEGER,
  atual_campeao BOOLEAN,
  posicao INTEGER
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    j.id,
    j.nome,
    j.apelido,
    j.foto_url,
    j.media_estrelas,
    j.total_votos,
    j.votos_semana,
    j.atual_campeao,
    ROW_NUMBER() OVER (ORDER BY j.media_estrelas DESC, j.total_votos DESC)::INTEGER AS posicao
  FROM public.jogadores j
  WHERE j.ativo = TRUE
    AND j.total_votos >= 5  -- Filtro de relevância estatística
  ORDER BY j.media_estrelas DESC, j.total_votos DESC
  LIMIT p_limit;
$$;

-- Função: sortear 2 jogadores aleatórios para votação (excluindo o próprio usuário)
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
LANGUAGE sql
STABLE
AS $$
  WITH meu_player AS (
    SELECT player_id FROM public.profiles WHERE id = auth.uid()
  ),
  votos_hoje AS (
    SELECT jogador_id FROM public.votos
    WHERE votante_id = auth.uid() AND data_voto = CURRENT_DATE
  )
  SELECT
    j.id,
    j.nome,
    j.apelido,
    j.foto_url,
    j.media_estrelas,
    j.total_votos,
    (j.id IN (SELECT jogador_id FROM votos_hoje)) AS ja_votou_hoje
  FROM public.jogadores j
  WHERE j.ativo = TRUE
    AND (SELECT player_id FROM meu_player) IS DISTINCT FROM j.id
  ORDER BY RANDOM()
  LIMIT 2; -- retorna exatamente 2 jogadores para o sorteio da aba Votar
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
-- DADOS DE EXEMPLO (opcional - remover em produção)
-- ============================================================
-- INSERT INTO public.jogadores (nome, apelido, posicao) VALUES
--   ('Felipe Santos', 'dd', 'Armador'),
--   ('Lucas Viel', 'viel', 'Ala'),
--   ('Eduardo Costa', 'boca de burro', 'Pivô');
