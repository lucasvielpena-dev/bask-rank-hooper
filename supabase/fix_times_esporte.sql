-- Adiciona coluna esporte em times (basquete ou handebol).
-- Rode no SQL Editor do Supabase.

ALTER TABLE public.times
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete';

CREATE INDEX IF NOT EXISTS idx_times_esporte ON public.times (esporte);

-- Marca times existentes como basquete (já eram)
UPDATE public.times SET esporte = 'basquete' WHERE esporte IS NULL OR esporte = '';

NOTIFY pgrst, 'reload schema';

SELECT esporte, count(*) FROM public.times GROUP BY esporte;
