-- Adiciona colunas que faltam na tabela times (veio do rascunho antigo).
-- Rode no SQL Editor do Supabase.

ALTER TABLE public.times
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Garante capitao_id se ainda não existir
ALTER TABLE public.times
  ADD COLUMN IF NOT EXISTS capitao_id UUID;

-- Preenche capitao_id a partir de criado_por se existir e estiver vazio
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='times' AND column_name='criado_por'
  ) THEN
    UPDATE public.times
       SET capitao_id = criado_por
     WHERE capitao_id IS NULL AND criado_por IS NOT NULL;
  END IF;
END $$;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

SELECT
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='times' AND column_name='ativo') AS tem_ativo,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='times' AND column_name='capitao_id') AS tem_capitao;
