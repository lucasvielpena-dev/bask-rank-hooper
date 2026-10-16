# Gerar APK Rank Hooper (com atualizações automáticas)

## Como funciona

O app Android abre o site da **Vercel** dentro de um WebView nativo.

- Cada `git push` → Vercel atualiza o site
- Abrir o APK → já vê a versão nova
- **Não precisa** gerar APK de novo a cada mudança de layout/código web

Só precisa de APK novo se mudar: nome do app, ícone, permissões nativas, `appId`.

---

## Pré-requisitos no PC

1. [Node.js 18+](https://nodejs.org/)
2. [Android Studio](https://developer.android.com/studio) (com SDK 34+)
3. Java 17 (o Android Studio costuma instalar)

---

## Passo a passo

### 1. Clonar e instalar

```bash
git clone https://github.com/lucasvielpena-dev/bask-rank-hooper.git
cd bask-rank-hooper
npm install
```

### 2. Conferir a URL da Vercel

Em `capacitor.config.ts`, a linha `LIVE_URL` deve ser o endereço real do site, por exemplo:

```ts
const LIVE_URL = 'https://SEU-PROJETO.vercel.app';
```

Abra o site no celular (Chrome) e confirme que carrega.

### 3. Build web + sync Capacitor

```bash
npm run build
npx cap sync android
```

Ou:

```bash
npm run cap:sync
```

### 4. Gerar o APK no Android Studio

```bash
npx cap open android
```

No Android Studio:

1. Aguarde o Gradle sincronizar
2. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Quando terminar, clique em **locate**
4. Arquivo típico:

`android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Instalar no celular

1. Passe o `.apk` pro celular (WhatsApp, Drive, cabo)
2. No Android: **Permitir instalar apps desta fonte**
3. Abra o APK e instale

---

## APK de release (opcional)

1. Android Studio → **Build → Generate Signed Bundle / APK**
2. Crie um keystore (guarde a senha!)
3. Gere **APK release**

---

## Alternativa sem APK: PWA

No Chrome do celular:

1. Abra o site da Vercel
2. Menu **⋮ → Adicionar à tela inicial**
3. Também recebe atualizações sozinho

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| Tela branca | URL errada no `capacitor.config.ts` ou site fora do ar |
| Login Google | Teste no site; pode precisar de ajuste depois |
| App não instala | Ative fontes desconhecidas |
| Mudança não aparece | Force fechar o app e abra de novo |

