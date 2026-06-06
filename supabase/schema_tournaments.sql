-- ============================================================
-- RANKS HOOPS - Sistema de Torneios
-- Tabelas, políticas de RLS e publicação em tempo real
-- ============================================================

-- 1. Tabela de Torneios
CREATE TABLE IF NOT EXISTS public.torneios (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  local_quadra TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  data_fim DATE,
  descricao TEXT,
  
  -- Configurações
  max_equipes INTEGER NOT NULL DEFAULT 8,
  max_jogadores_por_equipe INTEGER NOT NULL DEFAULT 10,
  taxa_inscricao NUMERIC DEFAULT 0,
  premiacao TEXT,
  formato TEXT NOT NULL CHECK (formato IN ('eliminatoria_simples', 'eliminatoria_dupla', 'fase_grupos', 'todos_contra_todos')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'inscricoes_abertas' CHECK (status IN ('inscricoes_abertas', 'inscricoes_encerradas', 'em_andamento', 'finalizado')),
  
  organizador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Equipes Inscritas
CREATE TABLE IF NOT EXISTS public.equipes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  logo_url TEXT,
  capitao_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  torneio_id UUID REFERENCES public.torneios(id) ON DELETE CASCADE NOT NULL,
  aprovado BOOLEAN DEFAULT FALSE, -- organizador aprova entrada
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (torneio_id, nome)
);

-- 3. Roster das Equipes (Mapeamento de jogadores cadastrados)
CREATE TABLE IF NOT EXISTS public.equipe_jogadores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  equipe_id UUID REFERENCES public.equipes(id) ON DELETE CASCADE NOT NULL,
  jogador_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  aprovado BOOLEAN DEFAULT FALSE, -- aprovado pelo capitão
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (equipe_id, jogador_id)
);
-- Nota: se der erro de coluna duplicada ou unique, alteramos para:
ALTER TABLE public.equipe_jogadores DROP CONSTRAINT IF EXISTS equipe_jogadores_equipe_id_jogador_id_key;
ALTER TABLE public.equipe_jogadores ADD CONSTRAINT equipe_jogadores_equipe_id_jogador_id_key UNIQUE (equipe_id, jogador_id);

-- 4. Partidas do Torneio
CREATE TABLE IF NOT EXISTS public.torneio_jogos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  torneio_id UUID REFERENCES public.torneios(id) ON DELETE CASCADE NOT NULL,
  equipe_a_id UUID REFERENCES public.equipes(id) ON DELETE SET NULL,
  equipe_b_id UUID REFERENCES public.equipes(id) ON DELETE SET NULL,
  
  placar_a INTEGER DEFAULT 0,
  placar_b INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'em_andamento', 'finalizado')),
  
  fase TEXT NOT NULL, -- ex: 'Fase de Grupos', 'Quartas de Final', 'Semifinal', 'Final'
  grupo TEXT, -- opcional (ex: 'Grupo A')
  posicao_chave INTEGER, -- para posicionar na árvore mata-mata
  proximo_jogo_id UUID REFERENCES public.torneio_jogos(id), -- avança vencedor para este jogo
  
  -- Info de jogo
  data_jogo DATE,
  horario_jogo TIME,
  tempo_total TEXT DEFAULT '00:00',
  periodos INTEGER DEFAULT 1,
  mvp_id UUID REFERENCES public.profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Estatísticas de Jogadores por Jogo de Torneio
CREATE TABLE IF NOT EXISTS public.torneio_estatisticas_jogadores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  jogo_id UUID REFERENCES public.torneio_jogos(id) ON DELETE CASCADE NOT NULL,
  jogador_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  equipe_id UUID REFERENCES public.equipes(id) ON DELETE CASCADE NOT NULL,
  
  pontos INTEGER DEFAULT 0,
  rebotes INTEGER DEFAULT 0,
  assistencias INTEGER DEFAULT 0,
  tocos INTEGER DEFAULT 0,
  roubos_bola INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (jogo_id, jogador_id)
);

-- Habilitar RLS
ALTER TABLE public.torneios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_jogadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torneio_jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torneio_estatisticas_jogadores ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "torneios_select_all" ON public.torneios;
DROP POLICY IF EXISTS "torneios_insert_auth" ON public.torneios;
DROP POLICY IF EXISTS "torneios_manage_own" ON public.torneios;
CREATE POLICY "torneios_select_all" ON public.torneios FOR SELECT USING (TRUE);
CREATE POLICY "torneios_insert_auth" ON public.torneios FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "torneios_manage_own" ON public.torneios FOR ALL USING (auth.uid() = organizador_id);

DROP POLICY IF EXISTS "equipes_select_all" ON public.equipes;
DROP POLICY IF EXISTS "equipes_insert_auth" ON public.equipes;
DROP POLICY IF EXISTS "equipes_manage_own" ON public.equipes;
CREATE POLICY "equipes_select_all" ON public.equipes FOR SELECT USING (TRUE);
CREATE POLICY "equipes_insert_auth" ON public.equipes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "equipes_manage_own" ON public.equipes FOR ALL USING (
  auth.uid() = capitao_id OR EXISTS (
    SELECT 1 FROM public.torneios WHERE id = torneio_id AND organizador_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "equipe_jogadores_select_all" ON public.equipe_jogadores;
DROP POLICY IF EXISTS "equipe_jogadores_insert_auth" ON public.equipe_jogadores;
DROP POLICY IF EXISTS "equipe_jogadores_manage_own" ON public.equipe_jogadores;
CREATE POLICY "equipe_jogadores_select_all" ON public.equipe_jogadores FOR SELECT USING (TRUE);
CREATE POLICY "equipe_jogadores_insert_auth" ON public.equipe_jogadores FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "equipe_jogadores_manage_own" ON public.equipe_jogadores FOR ALL USING (
  jogador_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.equipes WHERE id = equipe_id AND (capitao_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.torneios WHERE id = torneio_id AND organizador_id = auth.uid()
    ))
  )
);

DROP POLICY IF EXISTS "torneio_jogos_select_all" ON public.torneio_jogos;
DROP POLICY IF EXISTS "torneio_jogos_all" ON public.torneio_jogos;
CREATE POLICY "torneio_jogos_select_all" ON public.torneio_jogos FOR SELECT USING (TRUE);
CREATE POLICY "torneio_jogos_all" ON public.torneio_jogos FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.torneios WHERE id = torneio_id AND organizador_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "torneio_estatisticas_jogadores_select_all" ON public.torneio_estatisticas_jogadores;
DROP POLICY IF EXISTS "torneio_estatisticas_jogadores_all" ON public.torneio_estatisticas_jogadores;
CREATE POLICY "torneio_estatisticas_jogadores_select_all" ON public.torneio_estatisticas_jogadores FOR SELECT USING (TRUE);
CREATE POLICY "torneio_estatisticas_jogadores_all" ON public.torneio_estatisticas_jogadores FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.torneio_jogos j 
    JOIN public.torneios t ON j.torneio_id = t.id 
    WHERE j.id = jogo_id AND t.organizador_id = auth.uid()
  )
);

-- Adicionar tabelas à publicação realtime do Supabase
-- Executa de forma segura verificando se já são membros
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    JOIN pg_class c ON pr.prrelid = c.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'torneios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.torneios;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    JOIN pg_class c ON pr.prrelid = c.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'equipes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    JOIN pg_class c ON pr.prrelid = c.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'equipe_jogadores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipe_jogadores;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    JOIN pg_class c ON pr.prrelid = c.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'torneio_jogos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.torneio_jogos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    JOIN pg_class c ON pr.prrelid = c.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'torneio_estatisticas_jogadores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.torneio_estatisticas_jogadores;
  END IF;
END $$;

-- ============================================================
-- ÍNDICES PARA PERFORMANCE E PRODUÇÃO (TORNEIOS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_equipes_torneio_id ON public.equipes(torneio_id);
CREATE INDEX IF NOT EXISTS idx_equipe_jogadores_equipe_id ON public.equipe_jogadores(equipe_id);
CREATE INDEX IF NOT EXISTS idx_equipe_jogadores_jogador_id ON public.equipe_jogadores(jogador_id);
CREATE INDEX IF NOT EXISTS idx_torneio_jogos_torneio_id ON public.torneio_jogos(torneio_id);
CREATE INDEX IF NOT EXISTS idx_torneio_estatisticas_jogadores_jogo_id ON public.torneio_estatisticas_jogadores(jogo_id);
CREATE INDEX IF NOT EXISTS idx_torneio_estatisticas_jogadores_jogador_id ON public.torneio_estatisticas_jogadores(jogador_id);
