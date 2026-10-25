-- Permite o criador excluir rachão.
-- Rode no SQL Editor do Supabase.

DROP POLICY IF EXISTS racoes_delete_own ON public.racoes;
CREATE POLICY racoes_delete_own ON public.racoes
  FOR DELETE TO authenticated
  USING (auth.uid() = criado_por);

DROP POLICY IF EXISTS rp_delete_own ON public.racao_participantes;
CREATE POLICY rp_delete_own ON public.racao_participantes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.racoes r
      WHERE r.id = racao_id AND r.criado_por = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'racoes' ORDER BY policyname;
