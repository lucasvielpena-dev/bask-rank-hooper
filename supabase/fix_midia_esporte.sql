-- Adiciona coluna esporte em midia_jogador (fotos/vídeos por modalidade).
-- Rode no SQL Editor do Supabase.

ALTER TABLE public.midia_jogador
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete';

CREATE INDEX IF NOT EXISTS idx_midia_esporte ON public.midia_jogador (usuario_id, esporte);

-- Marca mídias existentes como basquete
UPDATE public.midia_jogador SET esporte = 'basquete' WHERE esporte IS NULL OR esporte = '';

NOTIFY pgrst, 'reload schema';

SELECT esporte, count(*) FROM public.midia_jogador GROUP BY esporte;
