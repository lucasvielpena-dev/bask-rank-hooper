-- Notificacoes: tipo + referencia_id + avisos por cidade
-- Abra este arquivo (ou Raw no GitHub) e cole no SQL Editor do Supabase.
-- NAO copie de chat (simbolos quebram).

ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS referencia_id UUID;

CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON public.notificacoes(tipo);

CREATE TABLE IF NOT EXISTS public.realtime_pings (
  topico TEXT PRIMARY KEY,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.notificar_realtime(
  p_topico TEXT,
  p_intervalo INTERVAL DEFAULT '8 seconds'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $function$
DECLARE
  v_ultimo TIMESTAMPTZ;
BEGIN
  IF p_topico IS NULL OR length(trim(p_topico)) = 0 THEN
    RETURN;
  END IF;

  SELECT enviado_em INTO v_ultimo
  FROM public.realtime_pings
  WHERE topico = p_topico;

  IF v_ultimo IS NOT NULL AND v_ultimo > NOW() - p_intervalo THEN
    RETURN;
  END IF;

  INSERT INTO public.realtime_pings AS rp (topico, enviado_em)
  VALUES (p_topico, NOW())
  ON CONFLICT (topico) DO UPDATE SET enviado_em = NOW();

  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('topico', p_topico, 'em', NOW()),
      'atualizacao',
      p_topico,
      TRUE
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.notificar_realtime(TEXT, INTERVAL) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notificar_realtime(TEXT, INTERVAL) TO authenticated, service_role;

-- Drop old signature if exists (4 args) then create 6-arg version
DROP FUNCTION IF EXISTS public.notificar_usuarios_cidade(TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.notificar_usuarios_cidade(
  p_cidade TEXT,
  p_titulo TEXT,
  p_mensagem TEXT,
  p_exceto_usuario UUID DEFAULT NULL,
  p_tipo TEXT DEFAULT NULL,
  p_referencia_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cidade TEXT;
  v_n INTEGER := 0;
BEGIN
  v_cidade := lower(trim(coalesce(p_cidade, '')));
  IF v_cidade = '' OR p_titulo IS NULL OR p_mensagem IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notificacoes (usuario_id, titulo, mensagem, lida, tipo, referencia_id)
  SELECT p.id, p_titulo, p_mensagem, FALSE, p_tipo, p_referencia_id
  FROM public.profiles p
  WHERE
    (
      lower(trim(coalesce(p.cidade_atual, ''))) = v_cidade
      OR lower(trim(coalesce(p.cidade, ''))) = v_cidade
    )
    AND (p_exceto_usuario IS NULL OR p.id IS DISTINCT FROM p_exceto_usuario)
    AND coalesce(p.ativo, TRUE) = TRUE
    AND coalesce(p.cadastro_completo, TRUE) = TRUE;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

REVOKE ALL ON FUNCTION public.notificar_usuarios_cidade(TEXT, TEXT, TEXT, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notificar_usuarios_cidade(TEXT, TEXT, TEXT, UUID, TEXT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_notif_nova_partida()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_exceto UUID;
  v_titulo TEXT;
  v_msg TEXT;
BEGIN
  v_exceto := auth.uid();
  v_titulo := 'Nova partida na sua cidade';
  v_msg := format(
    'Partida criada: %s x %s%s. Abra Competicoes para acompanhar.',
    coalesce(NEW.time_a, 'Time A'),
    coalesce(NEW.time_b, 'Time B'),
    CASE WHEN NEW.cidade IS NOT NULL AND NEW.cidade <> '' THEN ' em ' || NEW.cidade ELSE '' END
  );
  PERFORM public.notificar_usuarios_cidade(NEW.cidade, v_titulo, v_msg, v_exceto, 'partida', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notif_nova_partida ON public.partidas;
CREATE TRIGGER trg_notif_nova_partida
  AFTER INSERT ON public.partidas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notif_nova_partida();

CREATE OR REPLACE FUNCTION public.trg_notif_novo_racha()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_exceto UUID;
  v_titulo TEXT;
  v_msg TEXT;
  v_quando TEXT;
BEGIN
  v_exceto := COALESCE(NEW.criado_por, auth.uid());
  BEGIN
    v_quando := to_char(NEW.data_hora AT TIME ZONE 'America/Belem', 'DD/MM HH24:MI');
  EXCEPTION WHEN OTHERS THEN
    v_quando := NULL;
  END;
  v_titulo := 'Novo rachao na sua cidade';
  v_msg := format(
    'Rachao "%s"%s%s. Abra Rachoes para entrar.',
    coalesce(NEW.titulo, 'Pickup'),
    CASE WHEN NEW.local IS NOT NULL AND NEW.local <> '' THEN ' em ' || NEW.local ELSE '' END,
    CASE WHEN v_quando IS NOT NULL THEN ' - ' || v_quando ELSE '' END
  );
  PERFORM public.notificar_usuarios_cidade(NEW.cidade, v_titulo, v_msg, v_exceto, 'racha', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notif_novo_racha ON public.racoes;
CREATE TRIGGER trg_notif_novo_racha
  AFTER INSERT ON public.racoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notif_novo_racha();

CREATE OR REPLACE FUNCTION public.trg_notif_novo_torneio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_exceto UUID;
  v_titulo TEXT;
  v_msg TEXT;
BEGIN
  v_exceto := COALESCE(NEW.organizador_id, auth.uid());
  v_titulo := 'Novo torneio na sua cidade';
  v_msg := format(
    'Torneio "%s"%s. Inscricoes abertas - abra Competicoes.',
    coalesce(NEW.nome, 'Torneio'),
    CASE
      WHEN NEW.local_quadra IS NOT NULL AND NEW.local_quadra <> '' THEN ' em ' || NEW.local_quadra
      ELSE ''
    END
  );
  PERFORM public.notificar_usuarios_cidade(NEW.cidade, v_titulo, v_msg, v_exceto, 'torneio', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notif_novo_torneio ON public.torneios;
CREATE TRIGGER trg_notif_novo_torneio
  AFTER INSERT ON public.torneios
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notif_novo_torneio();

DO $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON pr.prpubid = p.oid
    JOIN pg_class c ON pr.prrelid = c.oid
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'notificacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$function$;

SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='notificacoes' AND column_name='tipo') AS col_tipo,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='notificacoes' AND column_name='referencia_id') AS col_ref,
  (SELECT count(*) FROM pg_proc WHERE proname = 'notificar_usuarios_cidade') AS tem_fn_cidade,
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_notif_nova_partida') AS trg_partida,
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_notif_novo_racha') AS trg_racha,
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_notif_novo_torneio') AS trg_torneio;
