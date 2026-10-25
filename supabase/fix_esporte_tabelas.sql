-- Adiciona coluna esporte nas tabelas que ainda não têm.
-- Rode no SQL Editor do Supabase.

ALTER TABLE public.partidas
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete';

ALTER TABLE public.torneios
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete';

ALTER TABLE public.jogadores
  ADD COLUMN IF NOT EXISTS esporte TEXT NOT NULL DEFAULT 'basquete';

CREATE INDEX IF NOT EXISTS idx_partidas_esporte ON public.partidas (esporte);
CREATE INDEX IF NOT EXISTS idx_torneios_esporte ON public.torneios (esporte);
CREATE INDEX IF NOT EXISTS idx_jogadores_esporte ON public.jogadores (esporte);

-- Marca registros existentes como basquete
UPDATE public.partidas SET esporte = 'basquete' WHERE esporte IS NULL OR esporte = '';
UPDATE public.torneios SET esporte = 'basquete' WHERE esporte IS NULL OR esporte = '';
UPDATE public.jogadores SET esporte = 'basquete' WHERE esporte IS NULL OR esporte = '';

NOTIFY pgrst, 'reload schema';

SELECT 'partidas' AS tabela, esporte, count(*) FROM public.partidas GROUP BY esporte
UNION ALL
SELECT 'torneios', esporte, count(*) FROM public.torneios GROUP BY esporte
UNION ALL
SELECT 'jogadores', esporte, count(*) FROM public.jogadores GROUP BY esporte;
