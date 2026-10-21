import { useEffect, useState } from 'react';

// ============================================================
// AVISO DE VERSÃO NOVA
// ============================================================
// O site publicado muda a cada deploy, mas o celular pode continuar rodando o
// pacote antigo (service worker / cache do app instalado). Foi exatamente isso
// que fez um conserto já publicado "não fazer efeito" no aparelho.
//
// Aqui o app compara o JS que está rodando com o que o site está servindo
// agora. Se for diferente, aparece a faixa "Nova versão disponível". Ao tocar,
// o app limpa o cache, desregistra o service worker e recarrega — aí sim a
// versão nova entra de verdade.
//
// Detalhe importante: o pedido usa "/index.html?v=..." de propósito. O service
// worker guarda o "/index.html" puro (precache), e uma URL com query string
// não bate nessa regra — então a resposta vem mesmo do servidor.
// ============================================================

export default function AvisoVersao() {
  const [temNova, setTemNova] = useState(false);

  useEffect(() => {
    let vivo = true;
    const atual = [...document.scripts]
      .map((s) => s.src)
      .find((s) => s.includes('/static/js/main.'));

    if (!atual) return () => { vivo = false; };
    const hashAtual = atual.split('/').pop();

    async function conferir() {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const r = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
        const html = await r.text();
        const m = html.match(/\/static\/js\/main\.[a-f0-9]+\.js/);
        if (!m) return;
        if (!hashAtual || !m[0].endsWith(hashAtual)) {
          if (vivo) setTemNova(true);
        } else if (vivo) {
          setTemNova(false);
        }
      } catch (e) {
        /* sem rede agora: tenta na próxima */
      }
    }

    conferir();
    const intervalo = setInterval(() => { if (!document.hidden) conferir(); }, 60000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') conferir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltar);
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
      /* mesmo com erro aqui, o reload abaixo resolve */
    }
    window.location.reload();
  }

  if (!temNova) return null;

  return (
    <button
      type="button"
      onClick={atualizar}
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 84,
        zIndex: 70,
        padding: '12px 12px',
        background: 'var(--accent)',
        color: 'var(--accent-on)',
        border: 'none',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 800,
        fontFamily: 'inherit',
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
      }}
    >
      Nova versão disponível — toque para atualizar
    </button>
  );
}
