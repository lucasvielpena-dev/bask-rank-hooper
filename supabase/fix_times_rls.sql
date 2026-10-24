-- Corrige políticas de RLS da tabela times (permite criar se for o capitão).
-- Rode no SQL Editor do Supabase.

-- Remove políticas antigas (incluindo as do rascunho)
DROP POLICY IF EXISTS times_select ON public.times;
DROP POLICY IF EXISTS times_insert ON public.times;
DROP POLICY IF EXISTS times_update ON public.times;
DROP POLICY IF EXISTS times_delete ON public.times;
DROP POLICY IF EXISTS times_insert_own ON public.times;
DROP POLICY IF EXISTS times_select_auth ON public.times;

-- Garante RLS ligada
ALTER TABLE public.times ENABLE ROW LEVEL SECURITY;

-- Leitura para autenticados
CREATE POLICY times_select ON public.times
  FOR SELECT TO authenticated
  USING (TRUE);

-- Criar: só se o usuário for o capitão
CREATE POLICY times_insert ON public.times
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = capitao_id);

-- Atualizar / apagar: só o capitão
CREATE POLICY times_update ON public.times
  FOR UPDATE TO authenticated
  USING (auth.uid() = capitao_id);

CREATE POLICY times_delete ON public.times
  FOR DELETE TO authenticated
  USING (auth.uid() = capitao_id);

-- Mesmo para membros (capitão ou o próprio usuário)
DROP POLICY IF EXISTS tm_select ON public.time_membros;
DROP POLICY IF EXISTS tm_insert ON public.time_membros;
DROP POLICY IF EXISTS tm_update ON public.time_membros;

CREATE POLICY tm_select ON public.time_membros
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY tm_insert ON public.time_membros
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = usuario_id
    OR EXISTS (
      SELECT 1 FROM public.times t
      WHERE t.id = time_id AND t.capitao_id = auth.uid()
    )
  );

CREATE POLICY tm_update ON public.time_membros
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = usuario_id
    OR EXISTS (
      SELECT 1 FROM public.times t
      WHERE t.id = time_id AND t.capitao_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'times'
ORDER BY policyname;
