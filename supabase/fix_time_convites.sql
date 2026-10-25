-- Cria a tabela time_convites (e amistosos) se ainda não existirem.
-- Rode no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.time_convites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  convidado_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  convidado_por UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_convites_convidado ON public.time_convites (convidado_id, status);

CREATE TABLE IF NOT EXISTS public.amistosos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_a_id UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  time_b_id UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  cidade TEXT NOT NULL,
  local_quadra TEXT,
  data_hora TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aceito', 'recusado', 'cancelado', 'finalizado')),
  desafiado_por UUID NOT NULL REFERENCES public.profiles(id),
  mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (time_a_id <> time_b_id)
);

CREATE INDEX IF NOT EXISTS idx_amistosos_times ON public.amistosos (time_a_id, time_b_id);
CREATE INDEX IF NOT EXISTS idx_amistosos_status ON public.amistosos (status);

-- RLS
ALTER TABLE public.time_convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amistosos ENABLE ROW LEVEL SECURITY;

-- Políticas de convites
DROP POLICY IF EXISTS tc_select ON public.time_convites;
CREATE POLICY tc_select ON public.time_convites FOR SELECT TO authenticated
  USING (auth.uid() = convidado_id OR auth.uid() = convidado_por
    OR EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid()));

DROP POLICY IF EXISTS tc_insert ON public.time_convites;
CREATE POLICY tc_insert ON public.time_convites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid())
  );

DROP POLICY IF EXISTS tc_update ON public.time_convites;
CREATE POLICY tc_update ON public.time_convites FOR UPDATE TO authenticated
  USING (auth.uid() = convidado_id OR auth.uid() = convidado_por
    OR EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid()));

-- Políticas de amistosos
DROP POLICY IF EXISTS am_select ON public.amistosos;
CREATE POLICY am_select ON public.amistosos FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS am_insert ON public.amistosos;
CREATE POLICY am_insert ON public.amistosos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = desafiado_por);

DROP POLICY IF EXISTS am_update ON public.amistosos;
CREATE POLICY am_update ON public.amistosos FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_b_id AND t.capitao_id = auth.uid())
    OR auth.uid() = desafiado_por
  );

NOTIFY pgrst, 'reload schema';

SELECT
  (SELECT count(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_name='time_convites') AS tem_convites,
  (SELECT count(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_name='amistosos') AS tem_amistosos;
