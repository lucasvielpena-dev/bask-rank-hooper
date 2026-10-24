-- Garante tabela time_convites e políticas de RLS.
-- Rode no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.time_convites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  convidado_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  convidado_por UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.time_convites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tc_select ON public.time_convites;
DROP POLICY IF EXISTS tc_insert ON public.time_convites;
DROP POLICY IF EXISTS tc_update ON public.time_convites;

CREATE POLICY tc_select ON public.time_convites
  FOR SELECT TO authenticated
  USING (
    auth.uid() = convidado_id
    OR auth.uid() = convidado_por
    OR EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid())
  );

CREATE POLICY tc_insert ON public.time_convites
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid())
  );

CREATE POLICY tc_update ON public.time_convites
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = convidado_id
    OR auth.uid() = convidado_por
    OR EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';

SELECT count(*) AS policies_convites
FROM pg_policies
WHERE tablename = 'time_convites';
