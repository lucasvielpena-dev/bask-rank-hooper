# Publicar o Rank Hooper na Google Play

Guia completo, do zero até o app no ar. O que **você** precisa fazer está marcado com
👉; o resto já está pronto no repositório.

---

## 0. Resumo: o que a Play exige hoje (2026)

| Exigência | Status no projeto |
|---|---|
| Conta de desenvolvedor (US$ 25, pagamento único) | 👉 **você cria** |
| Verificação de identidade (documento + endereço) | 👉 **você faz** |
| Se for conta **pessoal**: 12 testadores por 14 dias antes de liberar produção | 👉 **você faz** |
| `targetSdk` Android 16 (API 36) — exigido desde 31/08/2026 | ✅ já é 36 (`android/variables.gradle`) |
| Suporte a páginas de 16 KB (obrigatório desde 11/2025) | ✅ Capacitor 8 + AGP 8.13 já suportam |
| App Bundle (.aab) assinado, não APK | ✅ **feito** — keystore criado e AAB v1.0 gerado (14,8 MB) |
| Política de privacidade com URL pública | ✅ `/privacidade.html` |
| Exclusão de conta (no app **e** na web) | ✅ criada (menu do perfil + política) |
| Formulário de Segurança dos dados | 👉 preencher (respostas prontas na §5) |
| Classificação de conteúdo (IARC) | 👉 preencher (respostas prontas na §5) |
| Acesso ao app para o revisor (o app exige login) | 👉 **obrigatório** criar conta demo (§5.4) |
| Ícone 512×512 e gráfico de destaque 1024×500 | ✅ em `docs/play-store/` |
| Capturas de tela (mín. 2, máx. 8) | 👉 tirar (§5.6) |

---

## 1. Ajustes que já foram feitos no código

Nesta rodada o projeto ganhou tudo que faltava para publicar:

1. **Permissão de localização** (`android/app/src/main/AndroidManifest.xml`).
   Sem `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` o WebView **negava** o
   pedido de GPS e o usuário do APK nunca conseguia registrar a cidade — ou seja,
   não entrava no ranking municipal. Esse era um **bug real** que só aparecia no
   app instalado, não no site.
2. **Assinatura de release** (`android/app/build.gradle` + `android/keystore.properties.example`).
   O `release` não tinha `signingConfig`, então `bundleRelease` gerava um AAB
   **sem assinatura** — a Play recusaria.
3. **Exclusão de conta** (exigência da política "Account Deletion"):
   - SQL: `supabase/migration_exclusao_conta.sql` → RPC `excluir_minha_conta()`
   - App: `src/lib/supabase.js` (função `authAPI.excluirConta`) e
     `src/components/Layout.jsx` (botão **"Excluir minha conta"** no menu do perfil,
     com confirmação digitando `EXCLUIR`)
   - Web: seção **Excluir sua conta** em `/privacidade.html`
4. **Política de privacidade** (`public/privacidade.html`), no ar em
   `https://bask-rank-hooper.vercel.app/privacidade.html`
5. **Arte da loja** (`docs/play-store/`): `icon-512.png` e `feature-graphic.png` (1024×500).
   Regeradas pelo mesmo gerador de ícones: `tools/gerar-branding.ps1`.
6. `.gitignore` do Android protegendo `*.jks`, `*.keystore` e `keystore.properties`.

### ⚠️ Rodar este SQL (uma vez, no Supabase → SQL Editor)

Cole e execute **`supabase/migration_exclusao_conta.sql`**.
Sem ele o botão "Excluir minha conta" mostra erro.

---

## 2. Fase 1 — Conta de desenvolvedor

1. Acesse <https://play.google.com/console> e crie a conta.
2. Pague a taxa única de **US$ 25**.
3. Escolha o tipo de conta:
   - **Pessoal (CPF)** — mais simples, mas cai na regra dos **12 testadores por 14 dias**
     antes de liberar para produção (contas criadas depois de nov/2023).
   - **Organização (CNPJ)** — exige documento da empresa (DUNS em alguns casos);
     **não** tem a regra dos 12 testadores.
4. Verificação de identidade: documento com foto + comprovante de endereço.
   Leva de 1 a 3 dias.

> 💡 Se for conta pessoal, já comece a recrutar os 12 testadores (amigos, time,
> grupo do rachão). Eles precisam **instalar e manter instalado** por 14 dias seguidos.

---

## 3. Fase 2 — Gerar o AAB assinado ✅ FEITO (17/10/2026)

Nesta máquina **não foi preciso Android Studio**: instalamos Java 21 e o Android SDK
em modo portátil (sem pedir senha de administrador):

| Ferramenta | Onde | Por quê |
|---|---|---|
| Java 21 (Temurin) | `%LOCALAPPDATA%\android-build\jdk-21` | o Capacitor 8 **exige Java 21** (com o 17: `invalid source release: 21`) |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk` | `platforms;android-36`, `build-tools;36.0.0`, `platform-tools` |

### 3.1 Keystore (feito — guarde o backup!)

O keystore existe em **dois lugares** (ambos ignorados pelo Git):

- `bask-rank-hooper-main\android\upload-keystore.jks` (cópia de trabalho, no OneDrive)
- na pasta do clone usado no build

`android\keystore.properties` está preenchido com a senha. **Alias:** `upload`.

> 🔒 **Backup obrigatório:** copie o `.jks` **e anote a senha** fora do PC
> (Google Drive, pendrive, gerenciador de senhas). Os dois arquivos não vão para o
> Git de propósito. Se perder, só recupera pedindo reset da *upload key* à Google
> (é possível porque o **Play App Signing** guarda a chave de distribuição de
> verdade — ative-o no primeiro envio).

Só se precisar refazer (não é o caso):

```powershell
$env:PATH = "$env:LOCALAPPDATA\android-build\jdk-21\bin;" + $env:PATH
cd android
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload `
  -keyalg RSA -keysize 2048 -validity 10000
```

### 3.2 Build (feito — agora é um comando)

```powershell
powershell -ExecutionPolicy Bypass -File tools\build-aab.ps1
```

O script confere Java 21 + SDK + keystore, builda o site, roda `cap sync`, roda o
Gradle e copia o resultado para **`..\play-store\ranks-hoops-v1.0-1.aab`**
(= `C:\Users\lucas\OneDrive\Documentos\Projeto Padrão\play-store\`).

> ⚠️ No Windows **não** use `npm run build`: o script do `package.json` está em
> sintaxe de Linux (`CI=false ... react-scripts build`) e o `cmd.exe` quebra.
> O `build-aab.ps1` já contorna isso.
>
> 🐛 Corrigido de passagem: o `android/app/build.gradle` procurava o keystore em
> `android/app/` (`file()`), mas o guia manda gerar em `android/`. Agora usa
> `rootProject.file()`.

APK de release (para instalar direto e testar no celular, fora da Play):

```powershell
cd android && .\gradlew.bat assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```

### 3.3 Sobre atualizações futuras

O app abre o site da Vercel dentro do WebView. Então:

- Mudou layout, texto, regra do ranking → **`git push`** e pronto, **sem novo AAB**.
- Mudou ícone, splash, permissão, nome ou `appId` → **precisa de AAB novo**.
- Versão nova na Play → suba `versionCode` (2, 3, 4…) e `versionName` no
  `android/app/build.gradle` e rode o `tools\build-aab.ps1`.

---

## 4. Fase 3 — Criar o app no Console

**Todos os apps → Criar app**

| Campo | Valor |
|---|---|
| Nome do app | `Ranks Hoops` (ou `Rank Hooper`) |
| Idioma padrão | Português (Brasil) |
| Nome do pacote | `com.rankhooper.app` (⚠️ definitivo, não muda nunca) |
| App ou jogo | App |
| Gratuito ou pago | Gratuito |
| Declarações | marcar as duas caixas de política |

Depois, em **Testar e lançar → Teste interno → Criar nova versão**, suba o `.aab`.

---

## 5. Fase 4 — Fichas e formulários (textos prontos)

### 5.1 Ficha da loja

**Nome do app:** `Ranks Hoops`

**Descrição curta** (máx. 80 caracteres — 55):

```
Rankings de rachões, competições e torneios de basquete
```

**Descrição completa** (máx. 4000 caracteres):

```
Ranks Hoops é o app para organizar e acompanhar o basquete da sua cidade.

RACHÕES
Crie o rachão da semana, monte os times, registre o placar e veja quem foi
o destaque da noite. Cada participante pode dar sua nota para o jogo —
de forma anônima — e o grupo vê o resultado geral da partida.

COMPETIÇÕES E TORNEIOS
Organize campeonatos completos: equipes, tabela de jogos, resultados e
classificação. Ideal para ligas de bairro, campeonatos de empresa, festivais
e torneios de fim de semana.

RANKING DE ATLETAS
Cada partida alimenta o ranking dos jogadores. Pontos, assistências, rebotes,
aproveitamento e a avaliação dos próprios companheiros geram uma posição
justa para cada atleta.

PERFIL DO ATLETA
Foto, apelido, posição, altura e idade. Uma linha de evolução mostra como o
seu rendimento vem mudando mês a mês, com base nas partidas e nas votações.

FEITO PARA A SUA TURMA
- Ranking por cidade: veja quem são os melhores da sua região
- Notas de jogo de A+ até D-F, sempre anônimas
- Convites e avisos direto no app
- Perfil de administrador para quem organiza os grupos
- Funciona como app instalado ou como atalho no celular

Baixe, crie seu perfil, entre em um rachão e mostre seu basquete.
```

**Categoria:** Esportes
**Tags:** Basquete, Esportes, Ranking
**E-mail de contato:** (o mesmo e-mail real que você colocar na política de privacidade)
**Site:** `https://bask-rank-hooper.vercel.app`
**Política de privacidade:** `https://bask-rank-hooper.vercel.app/privacidade.html`

### 5.2 Gráficos

| Item | Arquivo | Onde vai |
|---|---|---|
| Ícone do app | `docs/play-store/icon-512.png` | Ficha principal → Ícone |
| Gráfico de destaque | `docs/play-store/feature-graphic.png` | Ficha principal → Gráfico de destaque |

### 5.3 Segurança dos dados (respostas)

| Pergunta | Resposta |
|---|---|
| O app coleta ou compartilha dados do usuário? | **Sim** |
| Dados coletados | Nome, E-mail, IDs de usuário, Fotos, Localização aproximada e precisa, Atividade no app |
| Localização — finalidade | Funcionalidade do app (definir ranking por cidade) |
| Coleta opcional? | Localização e foto são **opcionais** |
| Dados compartilhados com terceiros | **Não** (Supabase/Vercel/Google atuam como operadores, não como terceiros para fins de venda) |
| Dados criptografados em trânsito | **Sim** (HTTPS obrigatório, `usesCleartextTraffic=false`) |
| Usuário pode pedir exclusão dos dados? | **Sim** |
| URL de exclusão de dados | `https://bask-rank-hooper.vercel.app/privacidade.html#excluir` |

### 5.4 Acesso ao app (⚠️ não esqueça!)

O app **exige login**, então o revisor não consegue entrar. Em
**Política e programas → Acesso ao app**:

- Marque **"Todas ou algumas funcionalidades exigem login"**
- **Nome do usuário:** `revisor@rankhooper.app` (ou a conta demo que você criar)
- **Senha:** a senha dela
- **Instruções:** "Entre com o e-mail e senha acima. É uma conta de demonstração
  já com perfil completo e histórico de partidas."

> 👉 **Crie a conta demo no app antes de enviar**, com perfil completo e pelo menos
> uma partida, para o revisor conseguir navegar.

### 5.5 Classificação de conteúdo

Responda o questionário IARC com sinceridade. Para este app:

- Violência, sexo, drogas, apostas: **não**
- Interação entre usuários / conteúdo gerado por usuário: **sim**
  (o app tem denúncias de conteúdo: `denunciasAPI` — isso cobre a exigência
  de mecanismo de denúncia da política de UGC)
- Compartilhamento de localização: **sim**
- Resultado esperado: **Livre / 12+**

### 5.6 Capturas de tela

Mínimo 2, máximo 8. Recomendado **1080×1920** (retrato), sem molduras de aparelho.

👉 Tire prints das telas: **Início (ranking)**, **Avaliação da partida**,
**Perfil do atleta (linha de evolução)**, **Rachões**, **Torneios**.

Dica: use o Chrome no PC → `F12` → ícone do celular → escolha "Pixel 7" →
screenshot em tela cheia (`Ctrl+Shift+P` → "Capture full size screenshot").

---

## 6. Fase 5 — Publicação

1. **Teste interno** — suba o AAB, adicione seu e-mail, instale pelo link, teste tudo
   (login, localização, criar rachão, votar, excluir conta).
2. **Teste fechado** — abra os 12 testadores (se a conta for pessoal).
   Mantenha por **14 dias seguidos**.
3. **Produção** — só aparece depois que a Play liberar (contas pessoais: após os
   14 dias + análise). O formulário de liberação aparecerá no painel.
4. Envio para revisão. Análise típica: **1 a 7 dias** para o primeiro app.

---

## 7. Riscos e recomendações

### 7.1 O app é um WebView do site (atenção)

O maior risco de reprovação é a política de **"Funcionalidade mínima"**: a
Google às vezes recusa apps que são "apenas um site dentro de um WebView".

**Argumentos a favor do app:**
- Não é o invólucro de um site que já existe na web aberta: é um serviço próprio,
  com login, banco de dados e conteúdo gerado pelos usuários;
- Tem identidade nativa (ícone, splash, tema, cor de fundo);
- A localização usa recurso nativo do Android.

**Se for reprovado por isso**, a solução é adicionar recursos nativos de verdade
(notificações push com FCM, câmera nativa, compartilhamento nativo). Vale saber que
isso pode acontecer.

### 7.2 Não venda dados, não coloque anúncios

A política declara "não vendemos dados e não exibimos anúncios". Se um dia entrar
AdMob no app, atualize **os três**: a política de privacidade, o formulário de
Segurança dos dados e a declaração de anúncios.

### 7.3 Mantenha o app sempre no ar

Como o conteúdo vem da Vercel, se o site cair o app fica em branco — e a Play
penaliza app quebrado. O `sw.js` já cuida do cache quando o usuário reabre.

### 7.4 LGPD

A política já cobre os pontos básicos (base legal, direitos, exclusão, retenção).
👉 **Troque `contato@rankhooper.app` por um e-mail real que você lê** — a Google
usa esse contato e a ANPD pode, também.

---

## 8. Checklist final

**No projeto (feito):**
- [x] Permissão de localização
- [x] Config de assinatura de release (+ caminho do keystore corrigido)
- [x] Exclusão de conta (app + SQL + web) — **SQL aplicado e confirmado no banco**
- [x] Política de privacidade publicada
- [x] Ícone 512 e gráfico de destaque 1024×500
- [x] `targetSdk` 36 / `minSdk` 24
- [x] Build do site passando
- [x] Segurança do banco revisada (`migration_seguranca_v3.sql` aplicada)
- [x] Nota do jogo contando na média (`migration_nota_jogo_na_media.sql` aplicada)
- [x] Java 21 + Android SDK instalados na máquina (sem Android Studio)
- [x] **Keystore criado** e **AAB v1.0 assinado e verificado** (14,8 MB)
- [x] Gerador do AAB: `tools/build-aab.ps1`

**Você precisa fazer:**
- [ ] Trocar `contato@rankhooper.app` pelo e-mail real (em `public/privacidade.html`)
      — você decidiu deixar como está por enquanto; a Google usa esse contato
- [ ] `git push` (publica a política de privacidade na Vercel)
- [ ] Criar a conta de desenvolvedor e pagar os US$ 25
- [ ] Criar a conta demo do revisor (perfil completo + pelo menos uma partida)
- [ ] Tirar as capturas de tela
- [ ] Preencher a ficha, Segurança dos dados, classificação e acesso ao app
- [ ] Ativar o **Play App Signing** no primeiro envio (fica com a chave real; o
      nosso keystore passa a ser só a *upload key*)
- [ ] Teste interno → teste fechado (12 testadores/14 dias) → produção

---

## 9. Problemas comuns

| Problema | Causa / solução |
|---|---|
| "App Bundle não assinado" | Falta `android/keystore.properties` — gere o keystore (§3.1) |
| "A permissão de localização não é concedida" no APK | Era o bug corrigido: confirme as permissões no `AndroidManifest.xml` e gere AAB novo |
| Revisor diz "não consegui entrar" | Faltou preencher **Acesso ao app** (§5.4) |
| "Funcionalidade mínima" | Veja §7.1 |
| Reclamação de taxa de tela de fundo / API 16 KB | Só aparece em app nativo; Capacitor 8 já está OK. Se a Play acusar, atualize `@capacitor/android` |
| Recusa por falta de política de privacidade | Confirmei que a URL abre (teste no celular, sem estar logado) |
| "Version code 1 já foi usado" | Suba `versionCode` para 2 no `android/app/build.gradle` |
