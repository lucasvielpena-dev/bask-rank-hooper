# E-mail de cadastro / recuperação não chega no Gmail

O app **não envia** o e-mail sozinho: quem envia é o **Supabase Auth**.
O e-mail padrão do Supabase tem limite baixo e cai fácil no spam.

## 1) Ajustes rápidos no Supabase (obrigatório)

1. Abra [https://supabase.com/dashboard](https://supabase.com/dashboard) → seu projeto  
2. **Authentication → URL Configuration**
   - **Site URL:** `https://bask-rank-hooper.vercel.app` (ou seu domínio real)
   - **Redirect URLs:** adicione:
     - `https://bask-rank-hooper.vercel.app/**`
     - `https://bask-rank-hooper.vercel.app/`
3. **Authentication → Providers → Email**
   - Confirme que **Email** está habilitado
4. **Authentication → Settings** (ou Email templates)
   - Se quiser **entrar sem confirmar e-mail** (mais fácil enquanto testa):
     - Desative **“Confirm email”**
   - Se quiser manter confirmação: deixe ligado e configure SMTP (passo 2)

## 2) SMTP próprio (recomendado para Gmail receber de verdade)

Com o e-mail interno do Supabase, muitos Gmails **não recebem**.

Opções fáceis:
- [Resend](https://resend.com) (gratuito para começar)
- SendGrid, Amazon SES, etc.

No Supabase:

1. **Project Settings → Authentication → SMTP Settings** (ou Auth → SMTP)
2. Ative **Custom SMTP**
3. Preencha host, porta, usuário, senha e e-mail remetente (domínio verificado no Resend)

Exemplo Resend:
- Host: `smtp.resend.com`
- Port: `465` ou `587`
- User: `resend`
- Pass: API key do Resend
- Sender: `noreply@seudominio.com` (domínio verificado)

## 3) Conferir se o usuário foi criado

**Authentication → Users**

- Se o usuário aparece como *Waiting for verification*: o cadastro chegou no Supabase; o problema é só o e-mail
- Se **não** aparece: o cadastro falhou (erro no app)

## 4) Spam do Gmail

Peça para olhar:
- Spam
- Promoções
- Remetente tipo `noreply@mail.app.supabase.io` (padrão Supabase)

## 5) Depois de configurar

Teste de novo **Criar conta** com um Gmail real.  
No app há botão **Reenviar e-mail de confirmação**.
