ALTER TABLE public.partida_jogadores
  ADD COLUMN IF NOT EXISTS pontos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assistencias INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rebotes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turnovers INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faltas INTEGER NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "partida_jogadores_update_auth" ON public.partida_jogadores;
CREATE POLICY "partida_jogadores_update_auth"
  ON public.partida_jogadores
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP FUNCTION IF EXISTS public.ajustar_stat_partida(UUID, UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.ajustar_stat_partida(
  p_partida_id UUID,
  p_jogador_id UUID,
  p_campo TEXT,
  p_delta INTEGER
)
RETURNS TABLE (
  out_jogador_id UUID,
  pontos INTEGER,
  assistencias INTEGER,
  rebotes INTEGER,
  turnovers INTEGER,
  faltas INTEGER,
  lado_time CHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_time CHAR(1);
BEGIN
  IF p_campo NOT IN ('pontos', 'assistencias', 'rebotes', 'turnovers', 'faltas') THEN
    RAISE EXCEPTION 'campo invalido';
  END IF;

  IF p_campo = 'pontos' THEN
    UPDATE partida_jogadores pj
    SET pontos = GREATEST(0, pj.pontos + p_delta)
    WHERE pj.partida_id = p_partida_id AND pj.jogador_id = p_jogador_id
    RETURNING pj.time INTO v_time;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'jogador nao esta na partida';
    END IF;

    IF p_delta <> 0 THEN
      IF v_time = 'A' THEN
        UPDATE partidas
        SET placar_time_a = GREATEST(0, COALESCE(placar_time_a, 0) + p_delta),
            updated_at = NOW()
        WHERE id = p_partida_id;
      ELSE
        UPDATE partidas
        SET placar_time_b = GREATEST(0, COALESCE(placar_time_b, 0) + p_delta),
            updated_at = NOW()
        WHERE id = p_partida_id;
      END IF;
    END IF;
  ELSIF p_campo = 'assistencias' THEN
    UPDATE partida_jogadores
    SET assistencias = GREATEST(0, assistencias + p_delta)
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;
  ELSIF p_campo = 'rebotes' THEN
    UPDATE partida_jogadores
    SET rebotes = GREATEST(0, rebotes + p_delta)
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;
  ELSIF p_campo = 'turnovers' THEN
    UPDATE partida_jogadores
    SET turnovers = GREATEST(0, turnovers + p_delta)
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;
  ELSIF p_campo = 'faltas' THEN
    UPDATE partida_jogadores
    SET faltas = GREATEST(0, faltas + p_delta)
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;
  END IF;

  RETURN QUERY
  SELECT
    pj.jogador_id,
    pj.pontos,
    pj.assistencias,
    pj.rebotes,
    pj.turnovers,
    pj.faltas,
    pj.time
  FROM partida_jogadores pj
  WHERE pj.partida_id = p_partida_id AND pj.jogador_id = p_jogador_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.ajustar_stat_partida(UUID, UUID, TEXT, INTEGER) TO authenticated;

SELECT 'migration_modo_mesa_stats aplicada' AS status;
