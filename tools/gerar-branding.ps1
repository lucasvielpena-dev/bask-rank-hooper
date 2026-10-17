# =============================================================
#  Ranks Hoops - gerador de icones e splash (cores do app)
# =============================================================
#  Gera, a partir de um design unico:
#    - public/icon-192.png         (PWA)
#    - public/icon-512.png         (PWA)
#    - public/apple-touch-icon.png (iOS)
#    - android mipmap-*/ic_launcher.png | ic_launcher_round.png
#                                      | ic_launcher_foreground.png
#    - android drawable*/splash.png (a "tela de entrada" do APK)
#    - docs/play-store/feature-graphic.png   (Play Store: 1024x500)
#    - docs/play-store/icon-512.png          (Play Store: icone 512x512)
#
#  Paleta: verde-limao #C8F135 ... #D4FF4A / #A8D020  |  fundo #0C0C14
#  Uso:    powershell -ExecutionPolicy Bypass -File tools\gerar-branding.ps1
# =============================================================

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root   = Split-Path -Parent $PSScriptRoot
$resDir = Join-Path $root 'android\app\src\main\res'
$pubDir = Join-Path $root 'public'
$storeDir = Join-Path $root 'docs\play-store'

# --------------------------- paleta ---------------------------
$LIME1 = [System.Drawing.ColorTranslator]::FromHtml('#D4FF4A')  # claro
$LIME2 = [System.Drawing.ColorTranslator]::FromHtml('#A8D020')  # escuro
$LIME  = [System.Drawing.ColorTranslator]::FromHtml('#C8F135')  # accent
$BG    = [System.Drawing.ColorTranslator]::FromHtml('#0C0C14')  # fundo escuro
$INK   = [System.Drawing.ColorTranslator]::FromHtml('#0B1208')  # bola
$WHITE = [System.Drawing.Color]::White

# ------------------------- utilitarios ------------------------
function Set-HQ($g) {
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
}

# Retangulo arredondado
function Draw-RoundRect($g, [double]$x, [double]$y, [double]$w, [double]$h, [double]$rad, $brush) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $rad
  $p.AddArc([float]$x, [float]$y, [float]$d, [float]$d, 180, 90)
  $p.AddArc([float]($x + $w - $d), [float]$y, [float]$d, [float]$d, 270, 90)
  $p.AddArc([float]($x + $w - $d), [float]($y + $h - $d), [float]$d, [float]$d, 0, 90)
  $p.AddArc([float]$x, [float]($y + $h - $d), [float]$d, [float]$d, 90, 90)
  $p.CloseFigure()
  $g.FillPath($brush, $p)
  $p.Dispose()
}

# Bola de basquete: vertical + horizontal + 2 arcos rentes a borda
function Draw-Ball($g, [double]$cx, [double]$cy, [double]$r, $fillColor, $seamColor) {
  $brush = New-Object System.Drawing.SolidBrush($fillColor)
  $g.FillEllipse($brush, [float]($cx - $r), [float]($cy - $r), [float](2 * $r), [float](2 * $r))

  $pen = New-Object System.Drawing.Pen($seamColor, [float]($r * 0.105))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round

  # costura vertical e horizontal
  $g.DrawLine($pen, [float]$cx, [float]($cy - $r), [float]$cx, [float]($cy + $r))
  $g.DrawLine($pen, [float]($cx - $r), [float]$cy, [float]($cx + $r), [float]$cy)

  # arcos laterais (rentes a borda, como numa bola de verdade)
  $k = 0.251 * $r
  $A = 1.031 * $r
  $rectR = New-Object System.Drawing.RectangleF([float]($cx + $k - $A), [float]($cy - $A), [float](2 * $A), [float](2 * $A))
  $g.DrawArc($pen, $rectR, 104.0, 152.0)   # arco da esquerda
  $rectL = New-Object System.Drawing.RectangleF([float]($cx - $k - $A), [float]($cy - $A), [float](2 * $A), [float](2 * $A))
  $g.DrawArc($pen, $rectL, 284.0, 152.0)   # arco da direita

  $brush.Dispose(); $pen.Dispose()
}

# Fundo do icone: full (quadrado cheio), circle (circulo) ou none (so a bola)
function New-Icon([int]$size, [string]$shape, [double]$ballScale = 0.52) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  Set-HQ $g
  $g.Clear([System.Drawing.Color]::Transparent)

  if ($shape -eq 'full' -or $shape -eq 'rounded') {
    $rect = New-Object System.Drawing.RectangleF(0, 0, [float]$size, [float]$size)
    $lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $LIME1, $LIME2, 45.0)
    if ($shape -eq 'full') { $g.FillRectangle($lg, $rect) }
    else { Draw-RoundRect $g 0 0 $size $size ([double]($size * 0.24)) $lg }
    $lg.Dispose()
  } elseif ($shape -eq 'circle') {
    $b = New-Object System.Drawing.SolidBrush($LIME)
    $g.FillEllipse($b, 0, 0, $size, $size)
    $b.Dispose()
  }

  $r = ($size * $ballScale) / 2.0
  Draw-Ball $g ($size / 2.0) ($size / 2.0) $r $INK $LIME

  $g.Dispose()
  return $bmp
}

function Save-Png($bmp, [string]$path) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host ("  ok  " + $path.Replace($root + '\', ''))
}

# Texto com espacamento entre letras (parecido com o letter-spacing do app)
function Measure-Spaced($g, [string]$text, $font, [double]$spacing) {
  $w = 0.0
  foreach ($ch in $text.ToCharArray()) { $w += $g.MeasureString([string]$ch, $font).Width + $spacing }
  return [double]($w - $spacing)
}
function Draw-Spaced($g, [string]$text, [double]$x, [double]$y, $font, $brush, [double]$spacing) {
  $cx = $x
  foreach ($ch in $text.ToCharArray()) {
    $g.DrawString([string]$ch, $font, $brush, [float]$cx, [float]$y)
    $cx += $g.MeasureString([string]$ch, $font).Width + $spacing
  }
}

# -------------------- tela de entrada (splash) --------------------
function New-Splash([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  Set-HQ $g
  $g.Clear($BG)

  $m  = [Math]::Min($w, $h)
  $ms = [int]($m * 0.26)                 # tamanho do selo
  $cx = $w / 2.0
  $cy = $h / 2.0 - $h * 0.05

  # brilho suave atras do selo (radial: verde -> transparente)
  $gr  = $ms * 1.9
  $gp  = New-Object System.Drawing.Drawing2D.GraphicsPath
  $gp.AddEllipse([float]($cx - $gr), [float]($cy - $gr), [float](2 * $gr), [float](2 * $gr))
  $pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush($gp)
  $pgb.CenterColor = [System.Drawing.Color]::FromArgb(46, 200, 241, 53)
  $pgb.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(0, 200, 241, 53))
  $g.FillPath($pgb, $gp)
  $pgb.Dispose(); $gp.Dispose()

  # selo verde com a bola
  $rect = New-Object System.Drawing.RectangleF([float]($cx - $ms / 2.0), [float]($cy - $ms / 2.0), [float]$ms, [float]$ms)
  $lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $LIME1, $LIME2, 45.0)
  Draw-RoundRect $g ($cx - $ms / 2.0) ($cy - $ms / 2.0) $ms $ms ([double]($ms * 0.24)) $lg
  $lg.Dispose()
  Draw-Ball $g $cx $cy ($ms * 0.30) $INK $LIME

  # marca "RANK HOOPER"
  $fs = [double]($ms * 0.30)
  $font = New-Object System.Drawing.Font('Bahnschrift Condensed', [float]$fs, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sp   = $fs * 0.10
  $bW   = New-Object System.Drawing.SolidBrush($WHITE)
  $bL   = New-Object System.Drawing.SolidBrush($LIME)
  $gap  = $fs * 0.22
  $wA   = Measure-Spaced $g 'RANK' $font $sp
  $wB   = Measure-Spaced $g 'HOOPER' $font $sp
  $ty   = $cy + $ms / 2.0 + $ms * 0.22
  $tx   = $cx - ($wA + $gap + $wB) / 2.0
  Draw-Spaced $g 'RANK' $tx $ty $font $bW $sp
  Draw-Spaced $g 'HOOPER' ($tx + $wA + $gap) $ty $font $bL $sp

  # risco fino de destaque
  $pen = New-Object System.Drawing.Pen($LIME, [float]([Math]::Max(1, $ms * 0.012)))
  $ly = $ty + $g.MeasureString('H', $font).Height + $ms * 0.10
  $g.DrawLine($pen, [float]($cx - $wA * 0.9), [float]$ly, [float]($cx + $wA * 0.9), [float]$ly)

  $pen.Dispose(); $bW.Dispose(); $bL.Dispose(); $font.Dispose()
  $g.Dispose()
  return $bmp
}

# ------------------- arte da Google Play -------------------
# Grafico de destaque da loja (1024 x 500). Regras da Play:
#   - PNG sem transparencia, 1024x500
#   - sem texto/logo nas bordas (fica "cortado" em alguns lugares)
function New-FeatureGraphic([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  Set-HQ $g
  $g.Clear($BG)

  $cx = $w * 0.235
  $cy = $h / 2.0
  $ms = [double]($h * 0.42)

  # brilho radial verde atras do selo
  $gr = $ms * 1.75
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $gp.AddEllipse([float]($cx - $gr), [float]($cy - $gr), [float](2 * $gr), [float](2 * $gr))
  $pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush($gp)
  $pgb.CenterColor = [System.Drawing.Color]::FromArgb(56, 200, 241, 53)
  $pgb.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(0, 200, 241, 53))
  $g.FillPath($pgb, $gp)
  $pgb.Dispose(); $gp.Dispose()

  # selo verde com a bola
  $sx = $cx - $ms / 2.0
  $sy = $cy - $ms / 2.0
  $rect = New-Object System.Drawing.RectangleF([float]$sx, [float]$sy, [float]$ms, [float]$ms)
  $lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $LIME1, $LIME2, 45.0)
  Draw-RoundRect $g $sx $sy $ms $ms ([double]($ms * 0.24)) $lg
  $lg.Dispose()
  Draw-Ball $g $cx $cy ($ms * 0.30) $INK $LIME

  # marca "RANK HOOPER" (o tamanho se ajusta para nunca vazar a borda)
  $fs   = [double]($h * 0.185)
  $font = New-Object System.Drawing.Font('Bahnschrift Condensed', [float]$fs, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sp   = $fs * 0.085
  $gap  = $fs * 0.20
  $wA   = Measure-Spaced $g 'RANK' $font $sp
  $wB   = Measure-Spaced $g 'HOOPER' $font $sp

  $tx   = $w * 0.455
  $maxW = ($w - $tx) - ($w * 0.06)
  if (($wA + $gap + $wB) -gt $maxW) {
    $fs = $fs * ($maxW / ($wA + $gap + $wB))
    $font.Dispose()
    $font = New-Object System.Drawing.Font('Bahnschrift Condensed', [float]$fs, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sp  = $fs * 0.085
    $gap = $fs * 0.20
    $wA  = Measure-Spaced $g 'RANK' $font $sp
    $wB  = Measure-Spaced $g 'HOOPER' $font $sp
  }

  $bW   = New-Object System.Drawing.SolidBrush($WHITE)
  $bL   = New-Object System.Drawing.SolidBrush($LIME)

  $ty = $cy - $fs * 0.80
  Draw-Spaced $g 'RANK' $tx $ty $font $bW $sp
  Draw-Spaced $g 'HOOPER' ($tx + $wA + $gap) $ty $font $bL $sp

  # filete verde
  $thick = [Math]::Max(2, $h * 0.009)
  $pen = New-Object System.Drawing.Pen($LIME, [float]$thick)
  $ruleY = $ty + $g.MeasureString('H', $font).Height + $fs * 0.10
  $ruleW = $wA + $gap + $wB
  $g.DrawLine($pen, [float]$tx, [float]$ruleY, [float]($tx + $ruleW), [float]$ruleY)

  # frase de apoio (sem acentos: PS 5.1 grava o .ps1 sem BOM)
  $fsT = [double]($h * 0.058)
  $fontT = New-Object System.Drawing.Font('Bahnschrift Condensed', [float]$fsT, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $bT = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#9A9AAE'))
  $tyT = $ruleY + $h * 0.050
  Draw-Spaced $g 'RANKING DE BASQUETE' $tx $tyT $fontT $bT ($fsT * 0.14)

  $pen.Dispose(); $bW.Dispose(); $bL.Dispose(); $bT.Dispose(); $font.Dispose(); $fontT.Dispose()
  $g.Dispose()
  return $bmp
}

# ============================ execucao ============================Write-Host ''
Write-Host 'Ranks Hoops - gerando icones e splash...'
Write-Host ''

Write-Host 'PWA / web:'
Save-Png (New-Icon 192 'full')   (Join-Path $pubDir 'icon-192.png')
Save-Png (New-Icon 512 'full')   (Join-Path $pubDir 'icon-512.png')
Save-Png (New-Icon 180 'full')   (Join-Path $pubDir 'apple-touch-icon.png')

Write-Host 'Icone do launcher (Android):'
$mipmaps = [ordered]@{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($d in $mipmaps.Keys) {
  $s = $mipmaps[$d]
  Save-Png (New-Icon $s 'full')                 (Join-Path $resDir "mipmap-$d\ic_launcher.png")
  Save-Png (New-Icon $s 'circle')               (Join-Path $resDir "mipmap-$d\ic_launcher_round.png")
  Save-Png (New-Icon ([int]($s * 2.25)) 'none' 0.50) (Join-Path $resDir "mipmap-$d\ic_launcher_foreground.png")
}

Write-Host 'Tela de entrada (splash):'
$splashes = @(
  @{ f = 'drawable\splash.png';                 w = 480;  h = 320  },
  @{ f = 'drawable-land-mdpi\splash.png';       w = 480;  h = 320  },
  @{ f = 'drawable-land-hdpi\splash.png';       w = 800;  h = 480  },
  @{ f = 'drawable-land-xhdpi\splash.png';      w = 1280; h = 720  },
  @{ f = 'drawable-land-xxhdpi\splash.png';     w = 1600; h = 960  },
  @{ f = 'drawable-land-xxxhdpi\splash.png';    w = 1920; h = 1280 },
  @{ f = 'drawable-port-mdpi\splash.png';       w = 320;  h = 480  },
  @{ f = 'drawable-port-hdpi\splash.png';       w = 480;  h = 800  },
  @{ f = 'drawable-port-xhdpi\splash.png';      w = 720;  h = 1280 },
  @{ f = 'drawable-port-xxhdpi\splash.png';     w = 960;  h = 1600 },
  @{ f = 'drawable-port-xxxhdpi\splash.png';    w = 1280; h = 1920 }
)
foreach ($sp in $splashes) {
  Save-Png (New-Splash $sp.w $sp.h) (Join-Path $resDir $sp.f)
}

Write-Host 'Arte da Google Play (docs\play-store):'
Save-Png (New-Icon 512 'full')          (Join-Path $storeDir 'icon-512.png')
Save-Png (New-FeatureGraphic 1024 500)  (Join-Path $storeDir 'feature-graphic.png')

Write-Host ''
Write-Host 'Pronto!'
