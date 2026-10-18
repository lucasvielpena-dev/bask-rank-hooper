-- ============================================================
-- LIBERAR CONTAS QUE FICARAM PRESAS SEM CONFIRMAR O E-MAIL
-- ============================================================
-- Situação: o Supabase (Authentication > Providers > Email) estava exigindo a
-- confirmação por e-mail, mas o e-mail não chega. Isso deixa a conta criada com
-- `email_confirmed_at` vazio e a pessoa não consegue entrar ("Email not
-- confirmed" / "E-mail não confirmado").
--
-- PASSO 1 (obrigatório, no painel do Supabase — só você consegue):
--   Supabase > Authentication > Sign In / Providers > Email
--     -> DESLIGUE "Confirm email" (Confirmar e-mail)
--   (Sem desligar isso, todo cadastro novo volta a ficar preso esperando e-mail.)
--
-- PASSO 2 (aqui no SQL Editor): libera quem já tinha ficado preso.
--   Rode o bloco inteiro de uma vez.
--
-- Observação: mudar essa opção no painel NÃO mexe no código do app. O app já
-- entra direto assim que a confirmação está desligada.

-- ------------------------------------------------------------
-- Prévia: quantas contas estão sem confirmação?
-- ------------------------------------------------------------
select count(*) as contas_sem_confirmacao
from auth.users
where email_confirmed_at is null;

-- ------------------------------------------------------------
-- Libera todas as contas sem confirmação
-- ------------------------------------------------------------
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at         = now()
where email_confirmed_at is null;

-- Alguns casos o Supabase também checa a identidade; deixamos marcada como
-- verificada (seguro repetir).
update auth.identities
set identity_data = jsonb_set(identity_data, '{email_verified}', 'true'::jsonb, true)
where identity_data is not null
  and (identity_data->>'email_verified') is distinct from 'true';

-- ------------------------------------------------------------
-- Conferência final (deve vir 0 em "ainda_sem_confirmacao")
-- ------------------------------------------------------------
select count(*) as ainda_sem_confirmacao
from auth.users
where email_confirmed_at is null;

-- ------------------------------------------------------------
-- Opcional: ver as últimas contas e quem estava pendente
-- ------------------------------------------------------------
select email, created_at, email_confirmed_at
from auth.users
order by created_at desc
limit 20;
