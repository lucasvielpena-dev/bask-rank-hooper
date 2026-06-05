import { useState, useEffect } from 'react';
import { votacaoAPI } from '../lib/supabase';

function StarPicker({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <button
          key={i}
          onClick={() => !disabled && onChange(i)}
          onMouseEnter={() => !disabled && setHover(i)}
          onMouseLeave={() => !disabled && setHover(0)}
          disabled={disabled}
          style={{
            background: 'none',
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            padding: '4px',
            transition: 'transform 0.1s',
            transform: (hover || value) >= i ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill={(hover || value) >= i ? '#f59e0b' : 'none'} stroke={(hover || value) >= i ? '#f59e0b' : '#475569'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function Votar() {
  const [jogadores, setJogadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estrelas, setEstrelas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState(null);
  const [statusHoje, setStatusHoje] = useState(null);
  const [expandido, setExpandido] = useState(null);

  useEffect(() => { loadDados(); }, []);

  async function loadDados() {
    setLoading(true);
    const [{ data: jogs }, { data: status }] = await Promise.all([
      votacaoAPI.sortearJogadores(),
      votacaoAPI.getStatusHoje(),
    ]);
    setJogadores(jogs || []);
    setStatusHoje(status);
    setLoading(false);
  }

  async function handleVotar(jogadorId) {
    const nota = estrelas[jogadorId];
    if (!nota) {
      showToast('Selecione uma nota de 1 a 5 estrelas', 'error');
      return;
    }
    setEnviando(true);
    const { data, error } = await votacaoAPI.votar(jogadorId, nota);
    if (error || !data?.sucesso) {
      showToast(data?.erro || error?.message || 'Erro ao registrar voto', 'error');
    } else {
      showToast(`✓ ${data.mensagem} Média: ★ ${Number(data.media_estrelas).toFixed(1)}`, 'success');
      // Recarregar lista e limpar nota
      setEstrelas(p => ({ ...p, [jogadorId]: 0 }));
      setExpandido(null);
      setTimeout(loadDados, 1500);
    }
    setEnviando(false);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const getInitial = (nome) => nome ? nome.charAt(0).toUpperCase() : '?';

  if (loading) return (
    <div className="page-content">
      <div className="loading"><div className="spinner" />Sorteando jogadores...</div>
    </div>
  );

  return (
    <div className="page-content">
      <div style={{ padding: '20px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(245,158,11,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20 }}>Avaliar Jogadores</h2>
            <p style={{ color: '#64748b', fontSize: 13 }}>6 categorias · nota de 1 a 5 estrelas</p>
          </div>
        </div>

        {/* Status do dia */}
        {statusHoje && (
          <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Votos hoje: </span>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>{statusHoje.votos_hoje}/20</span>
              <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>({statusHoje.restantes} restantes)</span>
            </div>
          </div>
        )}

        {/* Jogadores para avaliar */}
        {jogadores.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <h3>Nenhum jogador disponível</h3>
            <p>Cadastre jogadores primeiro na aba Jogadores</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 20 }}>
            {jogadores.map(j => (
              <div key={j.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Row */}
                <div
                  onClick={() => setExpandido(expandido === j.id ? null : j.id)}
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div className="avatar" style={{ marginRight: 12 }}>{getInitial(j.nome)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{j.nome}</div>
                    {j.ja_votou_hoje && (
                      <div style={{ fontSize: 12, color: '#f59e0b' }}>✓ Já votou hoje</div>
                    )}
                    {!j.ja_votou_hoje && (
                      <div style={{ fontSize: 12, color: '#60a5fa' }}>Toque para avaliar →</div>
                    )}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ transform: expandido === j.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>

                {/* Expandido - avaliação */}
                {expandido === j.id && !j.ja_votou_hoje && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
                      Qual nota você dá para <strong style={{ color: '#f1f5f9' }}>{j.nome}</strong>?
                    </p>
                    <StarPicker
                      value={estrelas[j.id] || 0}
                      onChange={v => setEstrelas(p => ({ ...p, [j.id]: v }))}
                      disabled={enviando}
                    />
                    {estrelas[j.id] > 0 && (
                      <div style={{ marginTop: 4, textAlign: 'center', color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>
                        {['', 'Fraco', 'Regular', 'Bom', 'Muito Bom', 'Excelente'][estrelas[j.id]]}
                      </div>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={() => handleVotar(j.id)}
                      disabled={enviando || !estrelas[j.id]}
                      style={{ marginTop: 14 }}
                    >
                      {enviando ? <><div className="spinner" /> Enviando...</> : <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        Confirmar Avaliação
                      </>}
                    </button>
                  </div>
                )}

                {expandido === j.id && j.ja_votou_hoje && (
                  <div style={{ marginTop: 12, padding: '12px', background: 'rgba(245,158,11,0.08)', borderRadius: 10, textAlign: 'center', fontSize: 13, color: '#f59e0b' }}>
                    ✓ Você já avaliou este jogador hoje. Volte amanhã!
                  </div>
                )}
              </div>
            ))}

            {/* Sortear novos */}
            <button className="btn btn-secondary" onClick={loadDados} style={{ marginTop: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
              Sortear Outros Jogadores
            </button>
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
