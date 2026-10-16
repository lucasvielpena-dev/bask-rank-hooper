-- ============================================================
-- RACHÕES (pickup games) — criação das tabelas + RLS endurecida
-- ============================================================
-- Corrige o erro:
--   "Could not find the table 'public.racoes' in the schema cache"
--
-- Este arquivo contém SOMENTE a parte de rachões do antigo
-- `migration_features_v2.sql`.
--
-- ⚠️ Ele NÃO redefine `get_ranking`. O `migration_features_v2.sql` criava uma
--    versão de `get_ranking` com 5 argumentos, gerando OVERLOAD ambíguo com a
--    versão de 4 argumentos do `schema.sql` (o app chama com 4 argumentos).
--    Por isso o features_v2 NÃO deve ser rodado.
--
-- COMO RODAR:
--   SQL Editor do Supabase, execute UMA vez.
--   Rode este arquivo ANTES de `migration_rls_hardening.sql`
--   (o hardening referencia estas tabelas).
--
-- É idempotente: pode rodar de novo sem erro.
-- ============================================================


-- ============================================================
-- 1) TABELAS
-- ============================================================
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
  jogador_id UUID REFERENCES public.jogadores(id) ON DELETE SET NULL,
  esporte TEXT DEFAULT 'basquete',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- `jogador_id` no rachão: o frontend (racoesAPI.criar) envia esse campo no
-- INSERT. Se a tabela já existir sem a coluna, isto a adiciona.
ALTER TABLE public.racoes
  ADD COLUMN IF NOT EXISTS jogador_id UUID REFERENCES public.jogadores(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.racao_participantes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  racao_id UUID NOT NULL REFERENCES public.racoes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jogador_id UUID REFERENCES public.jogadores(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'saiu')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (racao_id, usuario_id)
);

-- Vínculo opcional de avaliação a um rachão (anti-fraude).
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS racao_id UUID REFERENCES public.racoes(id) ON DELETE SET NULL;


-- ============================================================
-- 2) ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_racoes_status_data ON public.racoes(status, data_hora);
CREATE INDEX IF NOT EXISTS idx_racoes_cidade ON public.racoes(cidade, uf);
CREATE INDEX IF NOT EXISTS idx_racao_part_racao ON public.racao_participantes(racao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_racao ON public.avaliacoes(racao_id);


-- ============================================================
-- 3) RLS — já endurecida (só usuários logados; dono controla o próprio)
-- ============================================================
ALTER TABLE public.racoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.racao_participantes ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas logados (o RLS por padrão nega o anônimo).
DROP POLICY IF EXISTS "racoes_select_all" ON public.racoes;
DROP POLICY IF EXISTS racoes_select_auth ON public.racoes;
CREATE POLICY racoes_select_auth ON public.racoes
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "racao_part_select" ON public.racao_participantes;
DROP POLICY IF EXISTS racao_part_select_auth ON public.racao_participantes;
CREATE POLICY racao_part_select_auth ON public.racao_participantes
  FOR SELECT TO authenticated USING (TRUE);

-- Criar rachão: o dono (`criado_por`) tem de ser o próprio usuário.
DROP POLICY IF EXISTS "racoes_insert_auth" ON public.racoes;
DROP POLICY IF EXISTS racoes_insert_own ON public.racoes;
CREATE POLICY racoes_insert_own ON public.racoes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = criado_por);

-- Editar/encerrar rachão: só o dono (o antigo `OR auth.role()='authenticated'`
-- liberava qualquer logado — removido).
DROP POLICY IF EXISTS "racoes_update_auth" ON public.racoes;
DROP POLICY IF EXISTS racoes_update_own ON public.racoes;
CREATE POLICY racoes_update_own ON public.racoes
  FOR UPDATE TO authenticated
  USING (auth.uid() = criado_por)
  WITH CHECK (auth.uid() = criado_por);

-- Participantes: cada um só mexe na PRÓPRIA inscrição.
DROP POLICY IF EXISTS "racao_part_insert" ON public.racao_participantes;
DROP POLICY IF EXISTS racao_part_insert_own ON public.racao_participantes;
CREATE POLICY racao_part_insert_own ON public.racao_participantes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "racao_part_update" ON public.racao_participantes;
DROP POLICY IF EXISTS racao_part_update_own ON public.racao_participantes;
CREATE POLICY racao_part_update_own ON public.racao_participantes
  FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "racao_part_delete" ON public.racao_participantes;
DROP POLICY IF EXISTS racao_part_delete_own ON public.racao_participantes;
CREATE POLICY racao_part_delete_own ON public.racao_participantes
  FOR DELETE TO authenticated
  USING (auth.uid() = usuario_id);

-- Defesa em profundidade: o anônimo não tem privilígio de tabela algum.
REVOKE ALL ON public.racoes FROM anon;
REVOKE ALL ON public.racao_participantes FROM anon;


-- ============================================================
-- 4) REALTIME (opcional)
-- ============================================================
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
