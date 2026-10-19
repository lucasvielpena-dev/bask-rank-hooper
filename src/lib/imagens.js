// ============================================================
// COMPRESSÃO DE IMAGEM NO APARELHO (antes do upload)
// ============================================================
// A foto de perfil aceita até 5 MB como está. Acima disso, em vez de recusar,
// ela é reduzida aqui mesmo, no celular: nada de mandar o arquivo original
// para o servidor, nada de depender de configuração no Supabase.
//
// Só é usada quando a foto passa do limite — foto que já está dentro do
// tamanho vai para o servidor intacta (sem perder qualidade à toa).
//
// Cuidados:
//   - respeita a orientação EXIF (foto tirada "deitada" não sai deitada);
//   - reduz o lado maior para 1200 px (o avatar aparece pequeno, isso sobra
//     até em tela retina) e baixa a qualidade do JPEG até caber;
//   - JPEG não guarda transparência, então o fundo é preenchido de branco;
//   - se o navegador não conseguir ler a imagem, quem chamou recebe erro e
//     pode mostrar uma mensagem amigável.

export const LIMITE_FOTO_PERFIL = 5 * 1024 * 1024; // 5 MB

const LADO_MAXIMO = 1200;
const QUALIDADES = [0.9, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5, 0.4];
const MAX_REDUCOES = 4;

function nomeJpg(nome) {
  const base = String(nome || 'foto')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w-]+/g, '-')
    .slice(0, 40) || 'foto';
  return `${base}.jpg`;
}

function abrirImagem(file) {
  // createImageBitmap já entrega a imagem na orientação certa (EXIF).
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' })
      .catch(() => createImageBitmap(file));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('não foi possível abrir a imagem'));
    };
    img.src = url;
  });
}

function paraJpeg(canvas, qualidade) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', qualidade);
  });
}

function montarArquivo(blob, nomeOriginal) {
  return new File([blob], nomeJpg(nomeOriginal), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

/**
 * Reduz a imagem até caber em `maxBytes` (padrão: 5 MB).
 * Devolve um `File` JPEG/pronto para upload.
 * Lança erro só se não der para ler/processar a imagem.
 */
export async function comprimirImagem(file, { maxBytes = LIMITE_FOTO_PERFIL, ladoMaximo = LADO_MAXIMO } = {}) {
  const fonte = await abrirImagem(file);
  const larguraOriginal = fonte.width || fonte.naturalWidth || 0;
  const alturaOriginal = fonte.height || fonte.naturalHeight || 0;

  if (!larguraOriginal || !alturaOriginal) {
    if (typeof fonte.close === 'function') fonte.close();
    throw new Error('imagem sem tamanho reconhecido');
  }

  const menorBlob = { blob: null };
  let lado = Math.min(ladoMaximo, Math.max(larguraOriginal, alturaOriginal));
  const maiorLado = Math.max(larguraOriginal, alturaOriginal);

  for (let reducao = 0; reducao < MAX_REDUCOES; reducao++) {
    const escala = lado / maiorLado;
    const largura = Math.max(1, Math.round(larguraOriginal * escala));
    const altura = Math.max(1, Math.round(alturaOriginal * escala));

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('navegador não conseguiu preparar a imagem');

    // JPEG não tem transparência: fundo branco evita área preta.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(fonte, 0, 0, largura, altura);

    for (const qualidade of QUALIDADES) {
      const blob = await paraJpeg(canvas, qualidade);
      if (!blob) continue;
      if (!menorBlob.blob || blob.size < menorBlob.blob.size) menorBlob.blob = blob;
      if (blob.size <= maxBytes) {
        if (typeof fonte.close === 'function') fonte.close();
        return montarArquivo(blob, file.name);
      }
    }

    lado = Math.round(lado * 0.75);
  }

  if (typeof fonte.close === 'function') fonte.close();
  if (menorBlob.blob) return montarArquivo(menorBlob.blob, file.name);
  throw new Error('navegador não conseguiu comprimir a imagem');
}
