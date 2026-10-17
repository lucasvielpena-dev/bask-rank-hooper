# ============================================================
#  Gera o AAB assinado para a Google Play  (Windows)
# ============================================================
#  Uso:
#     powershell -ExecutionPolicy Bypass -File tools\build-aab.ps1
#
#  O que ele faz:
#     1. confere Java 21 e o Android SDK
#     2. npm install (so se faltar node_modules)
#     3. build do site (react-scripts)
#     4. npx cap sync android
#     5. gradlew bundleRelease
#     6. copia o AAB para  ..\play-store\ranks-hoops-vX.Y-CODIGO.aab
#
#  Requisitos (ja instalados nesta maquina):
#     Java 21 : %LOCALAPPDATA%\android-build\jdk-21      (Capacitor 8 exige 21)
#     SDK     : %LOCALAPPDATA%\Android\Sdk               (platforms;android-36,
#                                                        build-tools;36.0.0)
#     keystore: android\upload-keystore.jks + android\keystore.properties
#
#  NOTA: nao usa "npm run build" de proposito -- o script do package.json
#  esta em sintaxe de Linux (CI=false DISABLE_ESLINT_PLUGIN=true react-scripts)
#  e no Windows isso da "'CI' nao e reconhecido como um comando".
#
#  IMPORTANTE: o AAB NAO vai para o Git (android/.gitignore protege *.aab).
#  O AAB so precisa ser regerado quando mudar algo DENTRO do android/
#  (icone, splash, nome, appId, permissoes). Mudanca de site/tela nao precisa:
#  o app carrega o site da Vercel (server.url no capacitor.config.ts).
# ============================================================

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

$jdk = "$env:LOCALAPPDATA\android-build\jdk-21"
$sdk = "$env:LOCALAPPDATA\Android\Sdk"

Write-Host "==> Confere as ferramentas"
if (-not (Test-Path "$jdk\bin\java.exe")) {
  Write-Host "ERRO: Java 21 nao encontrado em $jdk"
  Write-Host "      Baixe o Temurin 21 (ZIP) e extraia nessa pasta."
  exit 1
}
if (-not (Test-Path "$sdk\platforms\android-36")) {
  Write-Host "ERRO: Android SDK (platforms;android-36) nao encontrado em $sdk"
  exit 1
}
if (-not (Test-Path (Join-Path $raiz 'android\keystore.properties'))) {
  Write-Host "ERRO: falta android\keystore.properties"
  Write-Host "      Copie o android\keystore.properties.example e preencha."
  exit 1
}
if (-not (Test-Path (Join-Path $raiz 'android\upload-keystore.jks'))) {
  Write-Host "ERRO: falta android\upload-keystore.jks (o keystore da Play)"
  exit 1
}

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:PATH = "$jdk\bin;" + $env:PATH
$env:CI = 'false'
$env:DISABLE_ESLINT_PLUGIN = 'true'

$nodeDir = 'C:\Program Files\nodejs'
if (Test-Path "$nodeDir\npm.cmd") { $env:PATH = "$nodeDir;" + $env:PATH }

# versao lida do build.gradle, so para nomear o arquivo de saida
$gradle = Get-Content (Join-Path $raiz 'android\app\build.gradle') -Raw
$versionCode = [regex]::Match($gradle, 'versionCode\s+(\d+)').Groups[1].Value
$versionName = [regex]::Match($gradle, 'versionName\s+"([^"]+)"').Groups[1].Value
Write-Host "    versao: $versionName (versionCode $versionCode)"

if (-not (Test-Path (Join-Path $raiz 'node_modules'))) {
  Write-Host "==> npm install"
  & npm.cmd install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Write-Host "ERRO no npm install"; exit 1 }
}

Write-Host "==> Build do site"
& (Join-Path $raiz 'node_modules\.bin\react-scripts.cmd') build
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO no build do site"; exit 1 }

Write-Host "==> cap sync android"
& (Join-Path $raiz 'node_modules\.bin\cap.cmd') sync android
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO no cap sync"; exit 1 }

Write-Host "==> gradlew bundleRelease (a primeira vez baixa o Gradle; demora)"
Push-Location (Join-Path $raiz 'android')
& .\gradlew.bat bundleRelease
$codigo = $LASTEXITCODE
Pop-Location
if ($codigo -ne 0) { Write-Host "ERRO no gradle"; exit 1 }

$aab = Join-Path $raiz 'android\app\build\outputs\bundle\release\app-release.aab'
$pasta = Join-Path (Split-Path -Parent $raiz) 'play-store'
New-Item -ItemType Directory -Force $pasta | Out-Null
$destino = Join-Path $pasta "ranks-hoops-v$versionName-$versionCode.aab"
Copy-Item $aab $destino -Force

Write-Host ""
Write-Host "OK! AAB assinado em:"
Write-Host "    $destino"
Write-Host ""
Write-Host "Suba esse arquivo em Google Play Console -> Testar e lancar ->"
Write-Host "Teste interno -> Criar nova versao."
