-- Corrige o relacionamento times <-> profiles e recarrega o cache do PostgREST.
-- Rode no SQL Editor do Supabase.

-- Garante a coluna (se a tabela veio do rascunho antigo)
ALTER TABLE public.times
  ADD COLUMN IF NOT EXISTS capitao_id UUID;

-- Remove FK antiga se existir com nome diferente e recria
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'times'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name ILIKE '%capitao%'
  ) THEN
    ALTER TABLE public.times
      ADD CONSTRAINT times_capitao_id_fkey
      FOREIGN KEY (capitao_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Recarrega o schema cache do Supabase (PostgREST)
NOTIFY pgrst, 'reload schema';

SELECT
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='times' AND column_name='capitao_id') AS tem_capitao_id,
  (SELECT count(*) FROM information_schema.table_constraints
   WHERE table_schema='public' AND table_name='times' AND constraint_type='FOREIGN KEY') AS fks;
