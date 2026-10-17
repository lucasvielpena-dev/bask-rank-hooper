# 🏀 Ranks Hoops — Rank Hooper

Plataforma de basquete peer-to-peer (PWA + app Android via Capacitor) com ranking dinâmico por avaliação entre jogadores, torneios regionais, rachões (jogos pickup), estatísticas individuais e área administrativa (Master).

> Base inicial: Altamira, Pará. O esquema de dados já prevê múltiplos esportes (`esporte`), mas hoje só o basquete está configurado no frontend.

---

## 🧱 Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 (Create React App) + CSS custom properties (dark/light) |
| Backend | Supabase (PostgreSQL + Auth + RLS + Realtime + Storage) |
| PWA | `public/sw.js` + `public/manifest.json` |
| Mobile | Capacitor 8 (Android) — WebView apontando para o site na Vercel |
| Deploy | Vercel (CI/CD via GitHub) |
| Automação | `pg_cron` (reset semanal no Supabase) |

---

## 🗂️ Estrutura real do projeto

```
bask-rank-hooper-main/
├── src/
│   ├── config/esportes.js            # configuração por esporte (basquete)
│   ├── lib/
│   │   ├── supabase.js               # cliente + TODAS as APIs (jogadores, ranking, votos, torneios, rachões, master)
│   │   ├── ranking.js                # score de confiança / nível (frontend)
│   │   └── authUser.js
│   ├── contexts/
│   │   ├── AuthContext.jsx           # sessão, perfil, notificações, capa de login/onboarding
│   │   ├── ThemeContext.jsx          # dark/light
│   │   └── EsporteContext.jsx        # esporte ativo + cfg
│   ├── components/                   # Layout, Header, BottomNavigation, AuthScreen, CompleteProfileScreen,
│   │                                 # Icons, NotificationsPanel, PlayerProfileModal, AnimatedBackgrounds...
│   ├── pages/
│   │   ├── Home.jsx                  # início: stats, líder, top 5, ações rápidas
│   │   ├── Atletas.jsx               # lista, busca e cadastro de jogadores
│   │   ├── Jogos.jsx                 # abas "Jogos da Noite" e "Torneios Regionais" (nested)
│   │   ├── Torneios.jsx              # torneios: inscrição, chaveamento, console ao vivo (usado por Jogos)
│   │   ├── Racoes.jsx                # rachões / jogos pickup
│   │   ├── Stats.jsx                 # perfil + estatísticas pessoais
│   │   ├── Destaques.jsx             # destaques / tags
│   │   ├── MasterDashboard.jsx       # painel master
│   │   └── Admin*.jsx               # Users, Cities, Players, Tournaments, Notifications, Reports, Logs
│   ├── styles/global.css             # design system completo
│   ├── App.jsx                       # roteamento por estado + versionamento do service worker
│   └── index.js
├── supabase/
│   ├── schema.sql                    # ← RODAR PRIMEIRO (tabelas base, RLS, funções, cron)
│   ├── schema_tournaments.sql        # ← RODAR SEGUNDO (torneios, equipes, jogos, RLS, realtime)
│   ├── migration_master.sql          # sistema master/admin (roles, logs, notificações globais)
│   ├── migration_racoes.sql          # rachões (pickup games) + RLS endurecida
│   ├── migration_features_v2.sql     # ⚠️ OBSOLETO — não execute (ver cabeçalho)
│   ├── migration_cleanup.sql         # limpeza de tabelas legadas, FKs, índices, RLS (⚠️ ver aviso)
│   ├── migration_rls_hardening.sql   # 🔒 SEGURANÇA: bloqueia anônimos, esconde email/GPS, exige posse
│   ├── migration_avaliacoes_jogo.sql # 🎯 notas de jogo (rachão/competição) anônimas + semáforo
│   ├── migration_evolucao_jogador.sql # 📈 linha de evolução do atleta (média mensal das avaliações)
│   ├── migration_evolucao_fuso.sql   # 🕒 correção: mês da evolução no horário do Pará (roda depois da anterior)
│   ├── migration_seguranca_v3.sql    # 🛡️ fecha o que o hardening deixou passar (anon em RPCs, escalada para master, votos anônimos)
│   ├── migration_perf_realtime.sql   # ⚡ performance: acaba com o "efeito manada" do Realtime/heartbeat
│   ├── migration_realtime_broadcast.sql # 📡 Realtime escalável: Broadcast no lugar de postgres_changes
│   ├── fix_nomes_jogador.sql         # correção pontual dos nomes genéricos ("Jogador"/e-mail)
│   ├── supabase_migration_handebol.sql  # suporte a handebol — DESATIVADO (app é só basquete)
│   ├── fix_criado_por_fk.sql         # diagnóstico/ajuste da FK jogadores.criado_por
│   ├── fix_drop_criado_por_fk.sql    # remoção da FK (fix urgente)
│   └── migration_limpar_dados.sql    # 🧹 manutenção: zera jogadores/avaliações/partidas (pré-lançamento)
├── public/                           # index.html, sw.js, manifest.json, ícones e mídias
├── android/                          # projeto Android gerado pelo Capacitor
├── docs/GERAR_APK.md                 # passo a passo para gerar o APK
├── capacitor.config.ts               # appId com.rankhooper.app + URL do site na Vercel
├── vercel.json                       # build (lint desligado)
├── .env.example                      # template das variáveis do Supabase
└── package.json
```

---

## 🚀 Setup

### 1. Supabase (banco de dados)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute na ordem:
   1. `supabase/schema.sql`
   2. `supabase/schema_tournaments.sql`
   3. `supabase/migration_master.sql`
   4. `supabase/migration_racoes.sql` — cria as tabelas de rachões (RLS já endurecida)
   5. `supabase/migration_rls_hardening.sql` — 🔒 **obrigatória** (ver seção Segurança)
   6. `supabase/migration_avaliacoes_jogo.sql` — 🎯 notas de jogo **anônimas** (rachão e competição) + semáforo de rendimento
   7. `supabase/migration_evolucao_jogador.sql` — 📈 linha de evolução do atleta (média mensal das avaliações recebidas)
   8. `supabase/migration_perf_realtime.sql` — ⚡ **recomendada**: corta o efeito manada de Realtime (1 refresh não pode atualizar o app de todo mundo)
   9. `supabase/migration_realtime_broadcast.sql` — 📡 **recomendada**: ranking/torneios atualizando por Broadcast (indispensável se tiver muita gente online ao mesmo tempo)
   10. `supabase/migration_nota_jogo_na_media.sql` — ⭐ a nota do jogo passa a contar na média/ranking do atleta (ver "Nota do jogo na média", abaixo)
   11. `supabase/migration_exclusao_conta.sql` — 🗑️ RPC de exclusão de conta (exigência da Play Store)
   12. `supabase/migration_evolucao_fuso.sql` — 🕒 **recomendada**: corrige o mês da linha de evolução para o horário local (uma nota de 31/jan às 21h30 não conta mais em fevereiro)
   13. `supabase/migration_seguranca_v3.sql` — 🛡️ **obrigatória**: fecha três brechas que o `migration_rls_hardening.sql` não conseguiu fechar sozinho (o `REVOKE ... FROM PUBLIC` não tira o EXECUTE que o Supabase concede direto ao papel `anon`). Sem ela: anônimo executa RPCs (inclusive a rotina semanal, que zera o ranking), e qualquer logado pode se promover a `master` e ler o email de todos. Ver `docs/AUDITORIA.md`.
   - `supabase/fix_nomes_jogador.sql` — correção pontual: troca nomes genéricos (“Jogador”/e-mail) pelo apelido real. Rode se o ranking mostrar “Jogador”.
   - ⚠️ **Não rode `supabase_migration_handebol.sql`**: o app é **exclusivo de basquete** (`EsporteContext` fixa `basquete`) e não há mais código de handebol no frontend. O arquivo fica só como histórico, caso o esporte volte um dia.
   - ⚠️ **Não rode `migration_features_v2.sql`**: ele redefine `get_ranking` com 5 argumentos (overload ambíguo com a versão de 4 args → quebra o ranking) e reabre leitura pública/anônima nas rações. Foi substituído por `migration_racoes.sql`.
   - ⚠️ **Não rode `migration_cleanup.sql`**: ele remove a tabela `auditoria_votos` usada por `registrar_avaliacao` e quebra a votação. O `migration_rls_hardening.sql` já cobre a parte de RLS.
   - `fix_*.sql` são correções pontuais — rode apenas se encontrar o erro descrito no cabeçalho do arquivo.
    - 🧹 `supabase/migration_limpar_dados.sql` — **manutenção (opcional)**: zera todos os dados esportivos (jogadores, avaliações, notas de jogo, partidas, rachões, torneios) e apaga as contas de teste, preservando apenas os e-mails que você listar. Não faz parte do setup: só rode se quiser começar do zero. ⚠️ **não tem volta** — leia o cabeçalho do arquivo.
3. Ative **pg_cron** em Settings → Extensions (usado no reset semanal).
4. Copie `URL` e `anon public key` em Settings → API.
5. (Opcional) Ative **Google Auth** em Authentication → Providers → Google.

### 2. Variáveis de ambiente

Crie `.env.local` na raiz (use `.env.example` como base):

```
REACT_APP_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
REACT_APP_SUPABASE_ANON_KEY=SUA_ANON_KEY_AQUI
```

> ⚠️ O app **não inicia sem essas variáveis** — `src/lib/supabase.js` lança erro explícito se estiverem ausentes. Não há mais credenciais hardcoded no código.

### 3. Rodar localmente

Pré-requisito: **Node.js** (recomendado LTS 20/22; o `package.json` declara `engines.node = 24.x`).

```bash
npm install
npm start        # http://localhost:3000
```

### 4. Deploy na Vercel

1. Suba o repositório no GitHub e importe na [vercel.com](https://vercel.com).
2. Em **Settings → Environment Variables**, adicione `REACT_APP_SUPABASE_URL` e `REACT_APP_SUPABASE_ANON_KEY`.
3. Deploy. O `vercel.json` já configura build para Create React App.

### 5. App Android (AAB/APK)

Guia: **`docs/GERAR_APK.md`**. Nesta máquina já está instalado o necessário
(Node 24, **Java 21** e Android SDK em `%LOCALAPPDATA%`) — não precisa de Android Studio.
O Capacitor 8 exige Java 21.

```powershell
powershell -ExecutionPolicy Bypass -File tools\build-aab.ps1
```

O script builda o site, sincroniza o Capacitor, roda o Gradle e deixa o AAB em
`..\play-store\`. ⚠️ No Windows **não** use `npm run build`: o script do `package.json`
está em sintaxe de Linux e o `cmd.exe` quebra nele.

`capacitor.config.ts` define `server.url = LIVE_URL` (site na Vercel), ou seja, o app é um "shell" que sempre carrega a versão mais recente do site. Só é preciso gerar AAB novo se mudar ícone, splash, nome, `appId` ou permissões nativas.

### 6. Ícone e tela de entrada (Android + PWA)

O ícone e a splash do app são gerados por **um script só**, já nas cores da marca
(verde-limão `#C8F135` com fundo `#0C0C14`):

```powershell
powershell -ExecutionPolicy Bypass -File tools\gerar-branding.ps1
```

O script reescreve:

| Arquivo | Onde aparece |
| --- | --- |
| `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` | ícone do site instalado (PWA) e do navegador |
| `android/app/src/main/res/mipmap-*/ic_launcher*.png` | ícone do APK na tela inicial do celular |
| `android/app/src/main/res/drawable*/splash.png` | tela de abertura (splash) do APK |
| `docs/play-store/icon-512.png`, `docs/play-store/feature-graphic.png` | ficha da Google Play (ícone 512 e gráfico de destaque 1024×500) |

Depois de rodar o script é preciso **gerar o APK de novo** para o ícone/splash novos
aparecerem (`npm run cap:sync` + build no Android Studio). O site (PWA) atualiza sozinho
no deploy da Vercel.

A cor de fundo do app (`#0C0C14`) está em `android/app/src/main/res/values/colors.xml`,
em `values/styles.xml` (tema de entrada) e em `capacitor.config.ts` — é o que evita a
"tela branca" ao abrir.

### 7. Publicar na Google Play

Guia completo: **`docs/PUBLICAR_PLAY_STORE.md`** (conta de desenvolvedor, keystore, AAB,
fichas da loja, Segurança dos dados, capturas de tela e checklist final).

Três coisas que a Play exige e que já estão prontas no projeto:

| Item | Onde está |
| --- | --- |
| Política de privacidade (URL pública) | `public/privacidade.html` → `/privacidade.html` |
| Exclusão de conta (no app + na web) | `supabase/migration_exclusao_conta.sql` + menu do perfil |
| AAB assinado | `android/upload-keystore.jks` + `android/keystore.properties` (locais, fora do Git) |
| Gerador do AAB | `tools/build-aab.ps1` (um comando) |

Para gerar o bundle de loja:

```powershell
powershell -ExecutionPolicy Bypass -File tools\build-aab.ps1
# saída: ..\play-store\ranks-hoops-v1.0-1.aab
```

---

## 🔒 Segurança (RLS)

A chave `REACT_APP_SUPABASE_ANON_KEY` é **pública** (qualquer um lê no site), então a única proteção real dos dados é o **RLS**. O app exige login para tudo.

- `supabase/migration_rls_hardening.sql` deve estar aplicada. Ela:
  - bloqueia **anônimos** (sem login) de ler/escrever qualquer tabela;
  - **esconde `email` e as colunas de GPS** em `profiles` de qualquer leitura pelo cliente (nem usuários logados leem PII de terceiros);
  - exige **posse** (dono) para alterar `jogadores`, `jogos`, `partidas` e `rações`;
  - adiciona checagem de `role` nas RPCs `get_master_stats` / `get_city_stats` e bloqueia execução de funções por anônimos.
- **Regra de ouro no frontend:** nunca use `.select('*')` em `profiles` — use `PROFILE_SAFE_COLUMNS` (exportado por `src/lib/supabase.js`) ou uma lista explícita sem `email`/GPS.
- O bucket `avatars` deve ser criado **uma vez pelo admin** no painel do Supabase; o cliente não cria bucket.
- Detalhes e itens pendentes: `docs/AUDITORIA.md`.

---

## 🔧 Regras de negócio

### Ranking & classificação
- A nota do atleta junta **duas fontes**, com o mesmo peso por avaliação:
  1. **votos de estrela** — aba Atletas, média dos 5 fundamentos (`public.avaliacoes`);
  2. **notas de jogo** — rachão, competição e torneio, de 1 a 5 (`public.avaliacoes_jogo`, sempre anônimas).
- Fórmula: `media_estrelas = (média_estrelas × votos_estrela + média_notas_jogo × notas_jogo) ÷ total`.
  Sem nota de jogo o resultado é exatamente o de antes. Quem aplica: `supabase/migration_nota_jogo_na_media.sql`
  (`recalcular_media_jogador`, chamada pelos triggers de `avaliacoes` e `avaliacoes_jogo`).
- Ordenado por **maior média**; empate desfeito por **maior número de avaliações** (`total_votos` = votos + notas de jogo).
- Mínimo de **5 avaliações** para entrar no pódio.
- O perfil mostra a origem: "12 avaliações · 8 votos de estrela + 4 notas de jogo" (`resumoAvaliacoes`, em `src/lib/ranking.js`).
- `src/lib/ranking.js` aplica um **score de confiança** (média bayesiana com prior) e níveis: `provisorio` (<5), `em_evolucao` (<15), `consolidado` (≥15).
- A **Linha de Evolução** (`evolucao_jogador`) usa a mesma regra, mês a mês — por isso o gráfico e a nota nunca se contradizem.

### Votação & antifraude
- Nota de **1 a 5 estrelas** por critério (arremesso, controle de bola, defesa, visão de jogo, explosão física).
- ❌ Não pode votar em si mesmo.
- ❌ Máximo **1 voto por jogador por dia**.
- ❌ Máximo **20 votos por dia** por usuário.
- Registro inclui IP / device / localização para antifraude.

### Rotina semanal (domingo 23:59, via pg_cron)
1. Registra o campeão da semana (`campeoes_semana`).
2. Ativa `atual_campeao = true` no 1º lugar.
3. Reduz **10%** na média de todos.
4. Zera `votos_semana` (histórico permanece em `total_votos`).

### Torneios
- Criação por cidade (mata-mata ou pontos corridos); inscrição de equipes com aprovação do organizador.
- Roster por equipe (capitão + jogadores aprovados); geração automática de chaveamento.
- Console ao vivo: placar, cronômetro e estatísticas individuais; avanço automático no mata-mata.

### Papéis (roles)
`profiles.role` ∈ `user` | `admin` | `master`. A área **Admin/Master** no app só aparece para quem tem permissão; as RPCs administrativas (`admin_*`) validam o papel no servidor.

### Rachões (pickup)
Criação de jogo aberto, entrada/saída de participantes e finalização (`racoes` + `racao_participantes`).

---

## 📱 Telas (navegação inferior)

| Tela | Função | Rota interna |
|------|--------|--------------|
| **Início** | Stats gerais, líder do ranking, top 5, ações rápidas | `inicio` |
| **Atletas** | Lista, busca e cadastro de jogadores | `atletas` |
| **Rachões** | Jogos pickup abertos na região | `racoes` |
| **Jogos** | Jogos da noite e aba de torneios regionais | `jogos` / `torneios` |
| **Perfil** | Dados do usuário + estatísticas pessoais | `perfil` |
| **Admin** | Painel master (apenas master/admin) | `master*` |

---

## ⚠️ Observações / dívidas técnicas

- **App exclusivo de basquete**: `EsporteContext`/`esportes.js` só definem `basquete` (a troca de esporte é um no-op proposital) e o código morto de handebol foi removido do frontend em 2026-10-17. No banco restam apenas colunas ociosas (`finalizacao`, `passes`, `media_finalizacao`, `media_passes`) e a RPC `registrar_avaliacao_handebol`, como saída de emergência.
- **SQL sem versionador**: as migrations são aplicadas manualmente no SQL Editor e dependem da ordem acima.
- **Lint desligado no build** (`DISABLE_ESLINT_PLUGIN=true`, `CI=false`) e sem testes.
- **Node**: `package.json` pede `24.x`; `docs/GERAR_APK.md` cita Node 18+.
- **Service worker**: `public/sw.js` usa cache `v17` enquanto `App.jsx` usa `sw_version = 'v18'` para forçar atualização.
