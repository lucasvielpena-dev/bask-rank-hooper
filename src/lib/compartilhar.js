// ============================================================
// COMPARTILHAR O APP
// ============================================================
// Um link só, num lugar só: quando o app sair da teste fechado na Play Store,
// troca-se aqui e o botão do Perfil passa a divulgar a loja.
//
// No navegador / PWA / iPhone o celular abre a folha nativa de compartilhar
// (WhatsApp, Instagram, copiar...). No WebView do app (Capacitor) o Web Share
// API não existe, então o link é copiado e a pessoa cola onde quiser.

export const LINK_DO_APP = 'https://bask-rank-hooper.vercel.app';

const MENSAGEM = 'Rank Hooper — o ranking e os rachões do basquete.';

async function copiar(texto) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch (_) {
    /* sem permissão de área de transferência: tenta o plano B */
  }

  try {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.top = '-1000px';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    campo.setSelectionRange(0, campo.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(campo);
    return ok;
  } catch (_) {
    return false;
  }
}

/**
 * Abre o compartilhamento nativo quando existe; senão copia o link.
 * @returns {Promise<'compartilhado'|'copiado'|'cancelado'|'erro'>}
 */
export async function compartilharApp() {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Rank Hooper', text: MENSAGEM, url: LINK_DO_APP });
      return 'compartilhado';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelado';
      /* falhou o nativo: cai no copiar */
    }
  }

  return (await copiar(LINK_DO_APP)) ? 'copiado' : 'erro';
}
