-- Times da cidade (fechados) + convites + amistosos
-- Cole no SQL Editor do Supabase (arquivo / Raw GitHub).

CREATE TABLE IF NOT EXISTS public.times (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  uf TEXT DEFAULT 'PA',
  capitao_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_times_cidade ON public.times (lower(trim(cidade)));
CREATE INDEX IF NOT EXISTS idx_times_capitao ON public.times (capitao_id);

CREATE TABLE IF NOT EXISTS public.time_membros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'saiu')),
  entrou_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (time_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_time_membros_user ON public.time_membros (usuario_id);

CREATE TABLE IF NOT EXISTS public.time_convites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  convidado_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  convidado_por UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_convites_convidado ON public.time_convites (convidado_id, status);

CREATE TABLE IF NOT EXISTS public.amistosos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_a_id UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  time_b_id UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  cidade TEXT NOT NULL,
  local_quadra TEXT,
  data_hora TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aceito', 'recusado', 'cancelado', 'finalizado')),
  desafiado_por UUID NOT NULL REFERENCES public.profiles(id),
  mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (time_a_id <> time_b_id)
);

CREATE INDEX IF NOT EXISTS idx_amistosos_times ON public.amistosos (time_a_id, time_b_id);
CREATE INDEX IF NOT EXISTS idx_amistosos_status ON public.amistosos (status);

ALTER TABLE public.times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amistosos ENABLE ROW LEVEL SECURITY;

-- Leitura: autenticados (app ja filtra por cidade)
DROP POLICY IF EXISTS times_select ON public.times;
CREATE POLICY times_select ON public.times FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS times_insert ON public.times;
CREATE POLICY times_insert ON public.times FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = capitao_id);

DROP POLICY IF EXISTS times_update ON public.times;
CREATE POLICY times_update ON public.times FOR UPDATE TO authenticated
  USING (auth.uid() = capitao_id);

DROP POLICY IF EXISTS times_delete ON public.times;
CREATE POLICY times_delete ON public.times FOR DELETE TO authenticated
  USING (auth.uid() = capitao_id);

DROP POLICY IF EXISTS tm_select ON public.time_membros;
CREATE POLICY tm_select ON public.time_membros FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS tm_insert ON public.time_membros;
CREATE POLICY tm_insert ON public.time_membros FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = usuario_id
    OR EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid())
  );

DROP POLICY IF EXISTS tm_update ON public.time_membros;
CREATE POLICY tm_update ON public.time_membros FOR UPDATE TO authenticated
  USING (
    auth.uid() = usuario_id
    OR EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid())
  );

DROP POLICY IF EXISTS tc_select ON public.time_convites;
CREATE POLICY tc_select ON public.time_convites FOR SELECT TO authenticated
  USING (auth.uid() = convidado_id OR auth.uid() = convidado_por
    OR EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid()));

DROP POLICY IF EXISTS tc_insert ON public.time_convites;
CREATE POLICY tc_insert ON public.time_convites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid())
  );

DROP POLICY IF EXISTS tc_update ON public.time_convites;
CREATE POLICY tc_update ON public.time_convites FOR UPDATE TO authenticated
  USING (auth.uid() = convidado_id OR auth.uid() = convidado_por
    OR EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_id AND t.capitao_id = auth.uid()));

DROP POLICY IF EXISTS am_select ON public.amistosos;
CREATE POLICY am_select ON public.amistosos FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS am_insert ON public.amistosos;
CREATE POLICY am_insert ON public.amistosos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = desafiado_por);

DROP POLICY IF EXISTS am_update ON public.amistosos;
CREATE POLICY am_update ON public.amistosos FOR UPDATE TO authenticated
  USING (
    auth.uid() = desafiado_por
    OR EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_b_id AND t.capitao_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.times t WHERE t.id = time_a_id AND t.capitao_id = auth.uid())
  );

-- Capitao entra como membro ao criar time
CREATE OR REPLACE FUNCTION public.trg_time_capitao_membro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.time_membros (time_id, usuario_id, status)
  VALUES (NEW.id, NEW.capitao_id, 'ativo')
  ON CONFLICT (time_id, usuario_id) DO UPDATE SET status = 'ativo';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_time_capitao_membro ON public.times;
CREATE TRIGGER trg_time_capitao_membro
  AFTER INSERT ON public.times
  FOR EACH ROW EXECUTE FUNCTION public.trg_time_capitao_membro();

SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='times') AS times_ok,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='time_membros') AS membros_ok,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='time_convites') AS convites_ok,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='amistosos') AS amistosos_ok;
