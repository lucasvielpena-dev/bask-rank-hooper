-- ============================================================
-- SISTEMA MASTER - Rank Hooper
-- Migration SQL completa
-- ============================================================

-- =============================================
-- 1. ADICIONAR COLUNAS NA TABELA PROFILES
-- =============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'master'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- =============================================
-- 2. ATRIBUIR ROLE MASTER AO DONO
-- =============================================

UPDATE public.profiles SET role = 'master' WHERE email = 'lucasvielpena@gmail.com';

-- =============================================
-- 3. FUNÇÃO: ATUALIZAR LAST_SEEN
-- =============================================

CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET last_seen = NOW() WHERE id = auth.uid();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar last_seen no login
DROP TRIGGER IF EXISTS trg_update_last_seen ON auth.sessions;
-- Nota: o trigger deve ser chamado do frontend via RPC

-- =============================================
-- 4. TABELA: ADMIN_LOGS
-- =============================================

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  target_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_logs_master_only ON public.admin_logs;
CREATE POLICY admin_logs_master_only ON public.admin_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master')
  );

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_logs(action);

-- =============================================
-- 5. RPC: ATUALIZAR LAST_SEEN
-- =============================================

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles SET last_seen = NOW() WHERE id = auth.uid();
END;
$$;

-- =============================================
-- 6. RPC: OBTER ESTATÍSTICAS MASTER
-- =============================================

CREATE OR REPLACE FUNCTION public.get_master_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE cadastro_completo = TRUE;
  SELECT COUNT(*) INTO v_total_players FROM public.jogadores WHERE ativo = TRUE;
  SELECT COUNT(*) INTO v_total_matches FROM public.partidas;
  SELECT COUNT(*) INTO v_total_tournaments FROM public.torneios;
  SELECT COUNT(*) INTO v_total_ratings FROM public.avaliacoes;
  SELECT COUNT(DISTINCT cidade) INTO v_total_cities FROM public.profiles WHERE cidade IS NOT NULL AND cidade != '';
  SELECT COUNT(*) INTO v_online_now FROM public.profiles WHERE last_seen > NOW() - INTERVAL '5 minutes';
  SELECT COUNT(*) INTO v_new_30d FROM public.profiles WHERE created_at > NOW() - INTERVAL '30 days';

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

-- =============================================
-- 7. RPC: OBTER ESTATÍSTICAS POR CIDADE
-- =============================================

CREATE OR REPLACE FUNCTION public.get_city_stats()
RETURNS TABLE (
  cidade TEXT,
  user_count BIGINT,
  player_count BIGINT,
  tournament_count BIGINT,
  match_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.cidade,
    COUNT(DISTINCT p.id) AS user_count,
    COUNT(DISTINCT j.id) AS player_count,
    COUNT(DISTINCT t.id) AS tournament_count,
    COUNT(DISTINCT m.id) AS match_count
  FROM public.profiles p
  LEFT JOIN public.jogadores j ON j.cidade = p.cidade AND j.ativo = TRUE
  LEFT JOIN public.torneios t ON t.cidade = p.cidade
  LEFT JOIN public.partidas m ON m.cidade = p.cidade
  WHERE p.cadastro_completo = TRUE AND p.cidade IS NOT NULL AND p.cidade != ''
  GROUP BY p.cidade
  ORDER BY user_count DESC;
END;
$$;

-- =============================================
-- 8. RPC: OBTER USUÁRIOS (para admin)
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_get_users(
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nome_completo TEXT,
  apelido TEXT,
  email TEXT,
  cidade TEXT,
  uf TEXT,
  role TEXT,
  is_active BOOLEAN,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  player_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master', 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.nome_completo, p.apelido, p.email, p.cidade, p.uf,
    COALESCE(p.role, 'user') AS role,
    COALESCE(p.is_active, TRUE) AS is_active,
    p.last_seen, p.created_at,
    (SELECT COUNT(*) FROM public.jogadores j WHERE j.criado_por = p.id) AS player_count
  FROM public.profiles p
  WHERE p.cadastro_completo = TRUE
    AND (p_search IS NULL OR p_search = '' OR
         p.nome_completo ILIKE '%' || p_search || '%' OR
         p.email ILIKE '%' || p_search || '%')
  ORDER BY p.created_at DESC;
END;
$$;

-- =============================================
-- 9. RPC: ATUALIZAR ROLE DO USUÁRIO
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role != 'master' THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Apenas o master pode alterar roles.');
  END IF;

  IF p_new_role NOT IN ('user', 'admin', 'master') THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Role inválida.');
  END IF;

  UPDATE public.profiles SET role = p_new_role WHERE id = p_user_id;

  INSERT INTO public.admin_logs (admin_id, admin_email, action, target_type, target_id, details)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
          'set_role', 'user', p_user_id, jsonb_build_object('new_role', p_new_role));

  RETURN jsonb_build_object('sucesso', TRUE);
END;
$$;

-- =============================================
-- 10. RPC: ATIVAR/DESATIVAR USUÁRIO
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
  p_user_id UUID,
  p_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role != 'master' THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Apenas o master pode alterar status de usuários.');
  END IF;

  UPDATE public.profiles SET is_active = p_active WHERE id = p_user_id;

  INSERT INTO public.admin_logs (admin_id, admin_email, action, target_type, target_id, details)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
          CASE WHEN p_active THEN 'activate_user' ELSE 'suspend_user' END,
          'user', p_user_id, NULL);

  RETURN jsonb_build_object('sucesso', TRUE);
END;
$$;

-- =============================================
-- 11. RPC: EXCLUIR USUÁRIO
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
  v_target_name TEXT;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role != 'master' THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Apenas o master pode excluir usuários.');
  END IF;

  IF p_user_id = auth.uid() THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você não pode excluir sua própria conta.');
  END IF;

  SELECT nome_completo INTO v_target_name FROM public.profiles WHERE id = p_user_id;

  DELETE FROM public.profiles WHERE id = p_user_id;

  INSERT INTO public.admin_logs (admin_id, admin_email, action, target_type, target_id, target_name)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
          'delete_user', 'user', p_user_id, v_target_name);

  RETURN jsonb_build_object('sucesso', TRUE);
END;
$$;

-- =============================================
-- 12. RPC: ENVIAR NOTIFICAÇÃO GLOBAL
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_send_global_notification(
  p_titulo TEXT,
  p_mensagem TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
  v_count INTEGER;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role != 'master' THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Apenas o master pode enviar notificações globais.');
  END IF;

  INSERT INTO public.notificacoes (usuario_id, titulo, mensagem)
  SELECT id, p_titulo, p_mensagem FROM public.profiles WHERE cadastro_completo = TRUE;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.admin_logs (admin_id, admin_email, action, target_type, details)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
          'global_notification', 'all_users', jsonb_build_object('titulo', p_titulo, 'mensagem', p_mensagem, ' recipients', v_count));

  RETURN jsonb_build_object('sucesso', TRUE, 'enviados', v_count);
END;
$$;

-- =============================================
-- 13. RPC: EXCLUIR TORNEIO (master)
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_delete_tournament(p_torneio_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
  v_nome TEXT;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role != 'master' THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Apenas o master pode excluir torneios.');
  END IF;

  SELECT nome INTO v_nome FROM public.torneios WHERE id = p_torneio_id;
  DELETE FROM public.torneios WHERE id = p_torneio_id;

  INSERT INTO public.admin_logs (admin_id, admin_email, action, target_type, target_id, target_name)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
          'delete_tournament', 'tournament', p_torneio_id, v_nome);

  RETURN jsonb_build_object('sucesso', TRUE);
END;
$$;

-- =============================================
-- 14. RPC: ENCERRAR TORNEIO
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_close_tournament(p_torneio_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role NOT IN ('master', 'admin') THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Sem permissão.');
  END IF;

  UPDATE public.torneios SET status = 'finalizado', updated_at = NOW() WHERE id = p_torneio_id;

  INSERT INTO public.admin_logs (admin_id, admin_email, action, target_type, target_id)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
          'close_tournament', 'tournament', p_torneio_id);

  RETURN jsonb_build_object('sucesso', TRUE);
END;
$$;

-- =============================================
-- 15. RPC: OBTER RELATÓRIOS
-- =============================================

CREATE OR REPLACE FUNCTION public.get_master_reports()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'users_by_month', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
        FROM public.profiles WHERE cadastro_completo = TRUE
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC LIMIT 12
      ) t
    ),
    'players_by_city', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT cidade, COUNT(*) AS count FROM public.jogadores
        WHERE ativo = TRUE AND cidade IS NOT NULL
        GROUP BY cidade ORDER BY count DESC LIMIT 10
      ) t
    ),
    'matches_by_month', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
        FROM public.partidas
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC LIMIT 12
      ) t
    ),
    'ratings_by_month', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
        FROM public.avaliacoes
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC LIMIT 12
      ) t
    ),
    'tournaments_by_month', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
        FROM public.torneios
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC LIMIT 12
      ) t
    ),
    'top_active_players', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT j.nome, j.apelido, j.total_votos, j.media_estrelas, j.cidade
        FROM public.jogadores j
        WHERE j.ativo = TRUE
        ORDER BY j.total_votos DESC LIMIT 10
      ) t
    ),
    'top_tournaments', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT t.nome, t.cidade, t.status, t.data_inicio,
               (SELECT COUNT(*) FROM public.equipes e WHERE e.torneio_id = t.id) AS team_count
        FROM public.torneios t
        ORDER BY t.created_at DESC LIMIT 10
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =============================================
-- 16. RPC: LOGS ADMINISTRATIVOS
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_get_logs(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  admin_email TEXT,
  action TEXT,
  target_type TEXT,
  target_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT l.id, l.admin_email, l.action, l.target_type, l.target_name, l.details, l.created_at
  FROM public.admin_logs l
  ORDER BY l.created_at DESC
  LIMIT p_limit;
END;
$$;

-- =============================================
-- 17. RPC: OBTER JOGADORES (admin)
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_get_players()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  apelido TEXT,
  cidade TEXT,
  uf TEXT,
  posicao TEXT,
  media_estrelas NUMERIC,
  total_votos INTEGER,
  ativo BOOLEAN,
  match_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master', 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT j.id, j.nome, j.apelido, j.cidade, j.uf, j.posicao,
         j.media_estrelas, j.total_votos, j.ativo,
         (SELECT COUNT(*) FROM public.partida_jogadores pj WHERE pj.jogador_id = j.id) AS match_count
  FROM public.jogadores j
  ORDER BY j.total_votos DESC;
END;
$$;

-- =============================================
-- 18. RPC: SUSPENDER/EXCLUIR JOGADOR
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_toggle_player(p_player_id UUID, p_active BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role NOT IN ('master', 'admin') THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Sem permissão.');
  END IF;

  UPDATE public.jogadores SET ativo = p_active WHERE id = p_player_id;

  INSERT INTO public.admin_logs (admin_id, admin_email, action, target_type, target_id, details)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
          CASE WHEN p_active THEN 'activate_player' ELSE 'suspend_player' END,
          'player', p_player_id, jsonb_build_object('active', p_active));

  RETURN jsonb_build_object('sucesso', TRUE);
END;
$$;

-- =============================================
-- 19. RLS: profiles - master pode ver tudo
-- =============================================

DROP POLICY IF EXISTS profiles_master_all ON public.profiles;
CREATE POLICY profiles_master_all ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master')
  );

-- Admin pode ver todos os profiles (read)
DROP POLICY IF EXISTS profiles_admin_select ON public.profiles;
CREATE POLICY profiles_admin_select ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master', 'admin'))
  );

-- =============================================
-- 20. HABILITAR REALTIME PARA admin_logs
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.admin_logs;

-- =============================================
-- RESUMO
-- =============================================
-- Colunas adicionadas: role, last_seen, is_active em profiles
-- Tabelas criadas: admin_logs
-- RPCs criadas: 14 (stats, CRUD users, players, tournaments, notifications, reports, logs)
-- Índices: 3 em admin_logs
-- RLS: 3 policies para master/admin
-- Triggers: 0 (last_seen atualizado via RPC do frontend)
