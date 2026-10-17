-- ------------------------------------------------------------
-- CRONÔMETRO COMPARTILHADO
-- ------------------------------------------------------------
-- O cronômetro era salvo apenas em localStorage, então o segundo celular
-- (que pediu para operar o placar) não sabia que o timer estava rodando.
-- Agora o estado do cronômetro é salvo no banco e os dois celulares sincronizam.

-- 1) Coluna para guardar quando o cronômetro chega a 0 (NULL = pausado)
ALTER TABLE public.partidas
  ADD COLUMN IF NOT EXISTS timer_end_at TIMESTAMPTZ;

-- 2) Política de leitura: todos logados podem ver
-- (já existe partidas_select_all, não precisa criar)

-- 3) Política de escrita: só quem pode operar a partida pode atualizar o timer
-- (a policy de UPDATE já existe e cobre criador + operadores autorizados)

-- 4) Verificação
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'partidas'
   AND column_name = 'timer_end_at';
