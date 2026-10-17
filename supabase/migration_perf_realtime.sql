-- ============================================================
-- PERFORMANCE / REALTIME — fim do "efeito manada"
-- ============================================================
-- O QUE ESTAVA ACONTECENDO
--   1. Você abre/atualiza o app (F5, pull-to-refresh, reabrir o PWA).
--   2. Isso chama public.touch_last_seen(), que faz
--      `UPDATE public.profiles SET last_seen = NOW()`.
--   3. O trigger trg_sincronizar_dados_jogador era `AFTER UPDATE ON profiles`
--      SEM cláusula WHEN — ou seja, disparava em QUALQUER update do perfil,
--      inclusive só o heartbeat de "último acesso". Ele então reescrevia a
--      linha do atleta em public.jogadores.
--   4. `jogadores` está no Realtime. Cada cliente logado assina
--      `postgres_changes` nessa tabela (Início, Atletas, modal do atleta),
--      então TODOS recebiam o evento e refaziam as consultas pesadas de ranking.
--
--   Resultado: 1 F5 de 1 pessoa = 1 evento para N clientes = N consultas de
--   ranking. Com 100 atletas conectados isso satura o banco, estoura a cota de
--   mensagens do Realtime e ninguém consegue usar o app.
--
-- O QUE ESTE SCRIPT FAZ
--   1) O trigger de sincronização passa a rodar SÓ quando um campo de verdade
--      mudou (nome, apelido, foto, cidade, uf, posição). Heartbeat de last_seen
--      não toca mais em jogadores.
--   2) A própria função também ignorar update irrelevante e evita reescrever a
--      linha do atleta com os mesmos valores (não gera registro no Realtime).
--   3) touch_last_seen() só escreve se o registro anterior tiver mais de 2 min
--      (a contagem de "online agora" no admin usa janela de 5 min).
--
-- Seguro e idempotente. Rode no SQL Editor do Supabase.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Função de sincronização: sai cedo se nada relevante mudou
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sincronizar_dados_jogador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Só o heartbeat (last_seen) mudou? Não mexe no atleta.
  IF NEW.nome_completo IS NOT DISTINCT FROM OLD.nome_completo
     AND NEW.apelido      IS NOT DISTINCT FROM OLD.apelido
     AND NEW.foto_perfil  IS NOT DISTINCT FROM OLD.foto_perfil
     AND NEW.cidade_atual IS NOT DISTINCT FROM OLD.cidade_atual
     AND NEW.uf           IS NOT DISTINCT FROM OLD.uf
     AND NEW.posicao      IS NOT DISTINCT FROM OLD.posicao THEN
    RETURN NEW;
  END IF;

  IF NEW.player_id IS NOT NULL THEN
    UPDATE public.jogadores
       SET nome     = NEW.nome_completo,
           apelido  = NEW.apelido,
           foto_url = NEW.foto_perfil,
           cidade   = NEW.cidade_atual,
           uf       = NEW.uf,
           posicao  = NEW.posicao
     WHERE id = NEW.player_id
       -- Se os valores são os mesmos, não escreve (não gera evento no Realtime)
       AND (nome, apelido, foto_url, cidade, uf, posicao)
           IS DISTINCT FROM
           (NEW.nome_completo, NEW.apelido, NEW.foto_perfil,
            NEW.cidade_atual, NEW.uf, NEW.posicao);
  END IF;

  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------
-- 2) Trigger com WHEN: nem chega a chamar a função se nada mudou
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sincronizar_dados_jogador ON public.profiles;
CREATE TRIGGER trg_sincronizar_dados_jogador
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.nome_completo IS DISTINCT FROM NEW.nome_completo
    OR OLD.apelido      IS DISTINCT FROM NEW.apelido
    OR OLD.foto_perfil  IS DISTINCT FROM NEW.foto_perfil
    OR OLD.cidade_atual IS DISTINCT FROM NEW.cidade_atual
    OR OLD.uf           IS DISTINCT FROM NEW.uf
    OR OLD.posicao      IS DISTINCT FROM NEW.posicao
  )
  EXECUTE FUNCTION public.sincronizar_dados_jogador();


-- ------------------------------------------------------------
-- 3) Heartbeat: no máximo 1 escrita a cada 2 minutos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET last_seen = NOW()
   WHERE id = auth.uid()
     AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL '2 minutes');
END;
$$;

-- Ajuda a checagem do heartbeat e a contagem de "online agora" do admin
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles (last_seen DESC);


-- ------------------------------------------------------------
-- 4) VERIFICAÇÃO
-- ------------------------------------------------------------
-- O trigger deve aparecer com a cláusula WHEN na definição:
SELECT tgname AS trigger, pg_get_triggerdef(oid) AS definicao
FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass
  AND NOT tgisinternal;

-- Teste manual (rode estando logado): deve atualizar no máximo 1x a cada 2 min
-- e NÃO deve gerar alteração em public.jogadores.
-- SELECT public.touch_last_seen();
