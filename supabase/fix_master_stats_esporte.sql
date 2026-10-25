-- Atualiza get_master_stats para filtrar por esporte.
-- Rode no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION public.get_master_stats(p_esporte TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users INTEGER;
  v_total_players INTEGER;
  v_total_matches INTEGER;
  v_total_tournaments INTEGER;
  v_total_ratings INTEGER;
  v_total_cities INTEGER;
  v_online_now INTEGER;
  v_new_30d INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('master', 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE cadastro_completo = TRUE;
  SELECT COUNT(*) INTO v_total_players FROM public.jogadores
    WHERE ativo = TRUE AND (p_esporte IS NULL OR esporte = p_esporte);
  SELECT COUNT(*) INTO v_total_matches FROM public.partidas
    WHERE p_esporte IS NULL OR esporte = p_esporte;
  SELECT COUNT(*) INTO v_total_tournaments FROM public.torneios
    WHERE p_esporte IS NULL OR esporte = p_esporte;
  SELECT COUNT(*) INTO v_total_ratings FROM public.avaliacoes;
  SELECT COUNT(DISTINCT cidade) INTO v_total_cities FROM public.profiles
    WHERE cidade IS NOT NULL AND cidade != '';
  SELECT COUNT(*) INTO v_online_now FROM public.profiles
    WHERE last_seen > NOW() - INTERVAL '5 minutes';
  SELECT COUNT(*) INTO v_new_30d FROM public.profiles
    WHERE created_at > NOW() - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'total_players', v_total_players,
    'total_matches', v_total_matches,
    'total_tournaments', v_total_tournaments,
    'total_ratings', v_total_ratings,
    'total_cities', v_total_cities,
    'online_now', v_online_now,
    'new_30d', v_new_30d
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
