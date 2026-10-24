-- Corrige RLS + adiciona colunas faltantes em time_membros (veio do rascunho).
-- Rode no SQL Editor do Supabase.

-- 1) Garante coluna usuario_id em time_membros
ALTER TABLE public.time_membros
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Se existir jogador_id e usuario_id estiver vazio, tenta preencher via profiles.player_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='time_membros' AND column_name='jogador_id'
  ) THEN
    UPDATE public.time_membros tm
       SET usuario_id = p.id
      FROM public.profiles p
     WHERE tm.usuario_id IS NULL
       AND p.player_id = tm.jogador_id;
  END IF;
END $$;

-- 2) Políticas de times (remove antigas e recria)
DROP POLICY IF EXISTS times_select ON public.times;
DROP POLICY IF EXISTS times_insert ON public.times;
DROP POLICY IF EXISTS times_update ON public.times;
DROP POLICY IF EXISTS times_delete ON public.times;
DROP POLICY IF EXISTS times_insert_own ON public.times;
DROP POLICY IF EXISTS times_select_auth ON public.times;

ALTER TABLE public.times ENABLE ROW LEVEL SECURITY;

CREATE POLICY times_select ON public.times
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY times_insert ON public.times
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = capitao_id);

CREATE POLICY times_update ON public.times
  FOR UPDATE TO authenticated
  USING (auth.uid() = capitao_id);

CREATE POLICY times_delete ON public.times
  FOR DELETE TO authenticated
  USING (auth.uid() = capitao_id);

-- 3) Políticas de membros (usa usuario_id)
DROP POLICY IF EXISTS tm_select ON public.time_membros;
DROP POLICY IF EXISTS tm_insert ON public.time_membros;
DROP POLICY IF EXISTS tm_update ON public.time_membros;

ALTER TABLE public.time_membros ENABLE ROW LEVEL SECURITY;

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

-- Conferência
SELECT
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='time_membros' AND column_name='usuario_id') AS tem_usuario_id,
  (SELECT count(*) FROM pg_policies WHERE tablename='times') AS policies_times;
