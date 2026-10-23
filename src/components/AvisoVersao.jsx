import { useEffect, useState } from 'react';

// Compara o bundle que o aparelho está rodando com o index.html do servidor.
// Se for diferente, aparece a faixa "Nova versão disponível". Ao tocar,
// limpa cache/SW e recarrega.

export default function AvisoVersao() {
  const [temNova, setTemNova] = useState(false);

  useEffect(() => {
    let vivo = true;

    function hashDoDocumento() {
      const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
      const main = scripts.find((s) => /\/static\/js\/main\./.test(s));
      if (main) return main.split('/').pop();
      // fallback: qualquer chunk com hash
      const chunk = scripts.find((s) => /\/static\/js\/.+?\.[a-f0-9]{6,}\.js/.test(s));
      return chunk ? chunk.split('/').pop() : null;
    }

    const hashAtual = hashDoDocumento();
    if (!hashAtual) return () => { vivo = false; };

    async function conferir() {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const r = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const html = await r.text();
        const m =
          html.match(/\/static\/js\/main\.[a-f0-9]+\.js/) ||
          html.match(/\/static\/js\/[^"' ]+\.[a-f0-9]{6,}\.js/);
        if (!m) return;
        const hashServidor = m[0].split('/').pop();
        if (hashServidor && hashAtual && hashServidor !== hashAtual) {
          if (vivo) setTemNova(true);
        } else if (vivo) {
          setTemNova(false);
        }
      } catch (e) {
        /* sem rede: tenta na próxima */
      }
    }

    conferir();
    const intervalo = setInterval(() => { if (!document.hidden) conferir(); }, 45000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') conferir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, []);

  async function atualizar() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (typeof caches !== 'undefined') {
        const chaves = await caches.keys();
        await Promise.all(chaves.map((k) => caches.delete(k)));
      }
    } catch (e) {
      /* reload resolve */
    }
    window.location.reload(true);
  }

  if (!temNova) return null;

  return (
    <button
      type="button"
      onClick={atualizar}
      aria-label="Nova versão disponível. Toque para atualizar."
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        zIndex: 500,
        padding: '14px 16px',
        background: 'var(--accent)',
        color: 'var(--accent-on)',
        border: '2px solid var(--accent-line)',
        borderRadius: 14,
        fontSize: 14,
        fontWeight: 800,
        fontFamily: 'inherit',
        cursor: 'pointer',
        boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
        letterSpacing: '0.01em',
      }}
    >
      Nova versão disponível — toque para atualizar
    </button>
  );
}
