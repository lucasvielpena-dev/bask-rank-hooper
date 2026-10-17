# Gerar APK / AAB do Rank Hooper

## Como funciona

O app Android abre o site da **Vercel** dentro de um WebView nativo.

- Cada `git push` → Vercel atualiza o site
- Abrir o app → já vê a versão nova
- **Não precisa** gerar AAB de novo a cada mudança de layout/código web

Só precisa de AAB novo se mudar: nome do app, ícone, splash, permissões nativas ou `appId`.

---

## Pré-requisitos no PC

Nesta máquina **já está tudo instalado** — e **não precisa de Android Studio**:

| Ferramenta | Onde | Observação |
|---|---|---|
| Node.js | `C:\Program Files\nodejs` | 24.x |
| **Java 21** | `%LOCALAPPDATA%\android-build\jdk-21` | o Capacitor 8 **exige 21**; com o 17 o build morre em `error: invalid source release: 21` |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk` | `platforms;android-36`, `build-tools;36.0.0`, `platform-tools` |
| Keystore da Play | `android\upload-keystore.jks` + `android\keystore.properties` | não versionados — ver `docs/PUBLICAR_PLAY_STORE.md` §3 |

---

## Jeito fácil: um comando

```powershell
powershell -ExecutionPolicy Bypass -File tools\build-aab.ps1
```

O script confere Java/SDK/keystore, roda `npm install` (se faltar), builda o site,
sincroniza o Capacitor, roda o Gradle e copia o resultado para:

```
..\play-store\ranks-hoops-v1.0-1.aab
```

---

## Passo a passo manual (se quiser entender/ajustar)

### 1. Instalar dependências

```powershell
npm install
```

### 2. Conferir a URL da Vercel

Em `capacitor.config.ts`, `LIVE_URL` deve apontar para o site real:

```ts
const LIVE_URL = 'https://bask-rank-hooper.vercel.app';
```

### 3. Build web + sync Capacitor

⚠️ No Windows **não use `npm run build`**: o script do `package.json` está em
sintaxe de Linux (`CI=false DISABLE_ESLINT_PLUGIN=true react-scripts build`) e o
`cmd.exe` responde `'CI' não é reconhecido como um comando interno`. Use:

```powershell
$env:CI = 'false'
$env:DISABLE_ESLINT_PLUGIN = 'true'
.\node_modules\.bin\react-scripts.cmd build
.\node_modules\.bin\cap.cmd sync android
```

### 4. Gerar o bundle assinado

```powershell
$env:JAVA_HOME = "$env:LOCALAPPDATA\android-build\jdk-21"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH

cd android
.\gradlew.bat bundleRelease
```

Saída: **`android/app/build/outputs/bundle/release/app-release.aab`**

- `bundleRelease` → AAB (é o que a Google Play aceita)
- `assembleRelease` → APK de release (útil para instalar direto no celular e testar)

A primeira execução demora (baixa o Gradle e as dependências). Sem
`android/keystore.properties` o build passa, mas o AAB sai **sem assinatura** — e a
Play recusa.

> 💡 Se o Gradle reclamar de arquivo em uso / travado, é o OneDrive sincronizando a
> pasta `android/build`. Nesse caso clone/copie o projeto para uma pasta fora do
> OneDrive (ex.: `C:\dev\bask`) e rode lá.

### 5. Instalar o APK no celular (teste)

1. Passe o `.apk` para o celular (WhatsApp, Drive, cabo)
2. No Android: **Permitir instalar apps desta fonte**
3. Abra e instale

---

## Alternativa sem APK: PWA

No Chrome do celular:

1. Abra o site da Vercel
2. Menu **⋮ → Adicionar à tela inicial**
3. Também recebe atualizações sozinho

---

## Ícone e tela de abertura (splash)

Os dois são **imagens geradas nas cores do app** (verde-limão `#C8F135` + fundo escuro
`#0C0C14`). Para refazer o desenho:

```powershell
powershell -ExecutionPolicy Bypass -File tools\gerar-branding.ps1
```

O script reescreve:

- `android/app/src/main/res/mipmap-*/ic_launcher*.png` — ícone do app
- `android/app/src/main/res/drawable*/splash.png` — tela de abertura
- `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` — ícones do site (PWA)
- `docs/play-store/icon-512.png` e `feature-graphic.png` — arte da ficha da Play

Depois rode `tools\build-aab.ps1` — o ícone/splash só mudam com AAB novo.

A cor de fundo do app fica em `android/app/src/main/res/values/colors.xml`
(`rh_dark`) e é usada no tema de entrada (`values/styles.xml`) e no
`capacitor.config.ts` — é isso que evita a "tela branca" na abertura.

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| Tela branca | URL errada no `capacitor.config.ts` ou site fora do ar |
| `invalid source release: 21` | Está usando Java 17: aponte `JAVA_HOME` para o `jdk-21` |
| `'CI' não é reconhecido...` | Não use `npm run build` no Windows: use `react-scripts.cmd build` |
| "App Bundle não assinado" | Falta `android/keystore.properties` (§3 do guia da Play) |
| Login Google | Teste no site; pode precisar de ajuste depois |
| App não instala | Ative fontes desconhecidas |
| Mudança não aparece | Force fechar o app e abra de novo |
| Ícone azul "X" / splash branca | É o APK antigo: rode `tools\gerar-branding.ps1` e gere o AAB de novo |
| Gradle "file is locked" | OneDrive travando `android/build`: buildar fora do OneDrive |
