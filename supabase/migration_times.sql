-- ============================================================
-- migration_times.sql  (FASE 1 — RASCUNHO, NÃO RODAR AINDA)
-- Times fechados/abertos, membros, capitães e limite de 12.
-- A regra de "dia bloqueado" e os amistosos entram nas fases seguintes.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.times (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  cidade      TEXT NOT NULL,
  uf          TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'fechado' CHECK (tipo IN ('fechado','aberto')),
  criado_por  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_membros (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_id     UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  jogador_id  UUID NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  papel       TEXT NOT NULL DEFAULT 'membro' CHECK (papel IN ('criador','capitao','membro')),
  status      TEXT NOT NULL DEFAULT 'convidado' CHECK (status IN ('convidado','pedido','ativo','saiu')),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (time_id, jogador_id)
);

-- Limite de 12 membros ativos ou pendentes por time.
CREATE OR REPLACE FUNCTION public.time_validar_limite()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE n INTEGER;
BEGIN
  IF NEW.status IN ('ativo','convidado','pedido') THEN
    SELECT COUNT(*) INTO n FROM public.time_membros
     WHERE time_id = NEW.time_id AND status IN ('ativo','convidado','pedido')
       AND id IS DISTINCT FROM NEW.id;
    IF n >= 12 THEN
      RAISE EXCEPTION 'Este time já tem 12 jogadores.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- No máximo 2 capitães (contando o criador como capitão).
CREATE OR REPLACE FUNCTION public.time_validar_capitaes()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE n INTEGER;
BEGIN
  IF NEW.papel IN ('criador','capitao') AND NEW.status = 'ativo' THEN
    SELECT COUNT(*) INTO n FROM public.time_membros
     WHERE time_id = NEW.time_id AND papel IN ('criador','capitao')
       AND status = 'ativo' AND id IS DISTINCT FROM NEW.id;
    IF n >= 2 THEN
      RAISE EXCEPTION 'Um time pode ter no máximo 2 capitães.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_time_limite ON public.time_membros;
CREATE TRIGGER trg_time_limite BEFORE INSERT OR UPDATE ON public.time_membros
  FOR EACH ROW EXECUTE FUNCTION public.time_validar_limite();

DROP TRIGGER IF EXISTS trg_time_capitaes ON public.time_membros;
CREATE TRIGGER trg_time_capitaes BEFORE INSERT OR UPDATE ON public.time_membros
  FOR EACH ROW EXECUTE FUNCTION public.time_validar_capitaes();

ALTER TABLE public.times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_membros ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário logado (times são públicos na cidade).
DROP POLICY IF EXISTS times_select_auth ON public.times;
CREATE POLICY times_select_auth ON public.times FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS time_membros_select_auth ON public.time_membros;
CREATE POLICY time_membros_select_auth ON public.time_membros FOR SELECT TO authenticated USING (true);

-- Escrita: só pelo próprio fluxo (criar time pelo usuário que o cria).
DROP POLICY IF EXISTS times_insert_own ON public.times;
CREATE POLICY times_insert_own ON public.times FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

COMMIT;
