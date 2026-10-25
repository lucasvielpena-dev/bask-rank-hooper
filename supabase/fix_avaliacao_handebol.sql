-- Adiciona coluna flexível para habilidades de handebol (e futuros esportes).
-- Rode no SQL Editor do Supabase.

ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS habilidades JSONB;

CREATE INDEX IF NOT EXISTS idx_avaliacoes_habilidades ON public.avaliacoes USING gin (habilidades);

NOTIFY pgrst, 'reload schema';

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='avaliacoes' AND column_name='habilidades';
