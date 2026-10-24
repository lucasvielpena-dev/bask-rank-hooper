-- Torna jogador_id opcional em time_membros (tabela veio do rascunho).
-- Rode no SQL Editor do Supabase.

ALTER TABLE public.time_membros
  ALTER COLUMN jogador_id DROP NOT NULL;

-- Garante que usuario_id exista (já deve existir do fix anterior)
ALTER TABLE public.time_membros
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Recarrega cache
NOTIFY pgrst, 'reload schema';

-- Conferência
SELECT
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'time_membros'
  AND column_name IN ('jogador_id', 'usuario_id')
ORDER BY column_name;
