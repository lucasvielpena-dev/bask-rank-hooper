import { useEffect, useState } from 'react';
import { supabase, partidasAPI } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ============================================================
// PEDIDO PARA OPERAR O PLACAR — aviso global
// ============================================================
// Antes o pedido só aparecia dentro da tela da partida (ou na notificação, que
// não tinha botão). Quem criou a partida e estava em outra tela não conseguia
// aceitar. Agora a faixa aparece em QUALQUER tela do app, com Aceitar/Recusar.
//
// Custo: só quem tem partida em andamento (criada por ele) confere de 5 em 5
// segundos. Sem partida em andamento, confere de 20 em 20 segundos. Com o app
// fechado/minimizado, não confere nada.
// ============================================================

export default function AvisosPlacar() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [respondendo, setRespondendo] = useState(null);
  const [recado, setRecado] = useState(null);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    let timer = null;

    // Devolve true quando EU tenho partida em andamento (só aí um pedido pode chegar).
    async function carregar() {
      if (document.visibilityState === 'hidden') return true;
      try {
        const { data: minhas } = await supabase
          .from('partidas')
          .select('id, time_a, time_b')
          .eq('status', 'ativo')
          .eq('criado_por', user.id);
        if (!vivo) return false;
        const mapa = new Map((minhas || []).map((p) => [p.id, p]));
        if (mapa.size === 0) {
          setPedidos([]);
          return false;
        }
        const { data } = await partidasAPI.listarPedidosPendentes();
        if (!vivo) return true;
        setPedidos(
          (data || [])
            .filter((p) => p.usuario_id !== user.id && mapa.has(p.partida_id))
            .map((p) => ({ ...p, partida: mapa.get(p.partida_id) }))
        );
        return true;
      } catch (e) {
        return false;
      }
    }

    async function loop() {
      const temAtiva = await carregar();
      if (!vivo) return;
      timer = setTimeout(loop, temAtiva ? 5000 : 20000);
    }

    loop();
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      vivo = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [user]);

  async function responder(pedido, aceitar) {
    const chave = `${pedido.partida_id}:${pedido.usuario_id}`;
    setRespondendo(chave);
    const { error } = await partidasAPI.responderPedidoOperador(
      pedido.partida_id,
      pedido.usuario_id,
      aceitar
    );
    setRespondendo(null);
    setPedidos((prev) => prev.filter((p) => `${p.partida_id}:${p.usuario_id}` !== chave));
    setRecado(
      error
        ? 'Não foi possível responder agora. Tente de novo.'
        : aceitar
          ? `Pronto! ${pedido.nome || 'Essa pessoa'} já pode marcar ponto.`
          : 'Pedido recusado.'
    );
    setTimeout(() => setRecado(null), 2000);
  }

  if (pedidos.length === 0 && !recado) return null;

  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--accent-soft)',
      borderTop: '1px solid var(--accent-line)',
      borderBottom: '1px solid var(--accent-line)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flexShrink: 0
    }}>
      {pedidos.map((p) => {
        const chave = `${p.partida_id}:${p.usuario_id}`;
        const ocupado = respondendo === chave;
        return (
          <div key={chave} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1, minWidth: 160 }}>
              🏀 {p.nome || 'Alguém'} quer operar o placar
              {p.partida ? ` (${p.partida.time_a} × ${p.partida.time_b})` : ''}
            </span>
            <button
              type="button"
              className="batch-btn"
              disabled={ocupado}
              onClick={() => responder(p, true)}
              style={{ background: 'var(--accent)', color: '#0C0C14', fontWeight: 800, padding: '7px 14px', borderRadius: 10, border: 'none', fontSize: 13 }}
            >
              {ocupado ? '...' : 'Aceitar'}
            </button>
            <button
              type="button"
              className="batch-btn"
              disabled={ocupado}
              onClick={() => responder(p, false)}
              style={{ background: 'transparent', color: 'var(--text-secondary)', fontWeight: 700, padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
            >
              Recusar
            </button>
          </div>
        );
      })}
      {recado && (
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>{recado}</span>
      )}
    </div>
  );
}
