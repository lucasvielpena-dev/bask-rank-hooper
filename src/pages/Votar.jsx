import { useState, useEffect } from 'react';
import { supabase, votacaoAPI } from '../lib/supabase';

const fundamentos = [
  { key: 'arremesso', label: 'Arremesso' },
  { key: 'defesa', label: 'Defesa' },
  { key: 'passe', label: 'Passe' },
  { key: 'fisicalidade', label: 'Fisicalidade' },
  { key: 'mentalidade', label: 'Mentalidade' }
];

const labelsNota = ['', 'Muito Fraco', 'Fraco', 'Regular', 'Bom', 'Excelente'];

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
          <svg width="32" height="32" viewBox="0 0 24 24" fill={(hover || value) >= i ? 'var(--accent-gold)' : 'none'} stroke={(hover || value) >= i ? 'var(--accent-gold)' : 'var(--text-muted)'} strokeWidth="2">
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
  const [estrelas, setEstrelas] = useState({}); // { [jogadorId]: { arremesso: 0, ... } }
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState(null);
  const [statusHoje, setStatusHoje] = useState(null);
  const [expandido, setExpandido] = useState(null);

  useEffect(() => { loadDados(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('votar-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jogadores' },
        () => {
          loadDados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


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
    const avaliacao = estrelas[jogadorId] || {};
    const incompleto = fundamentos.some(f => !avaliacao[f.key]);
    if (incompleto) {
      showToast('Selecione uma nota para todos os 5 fundamentos', 'error');
      return;
    }
    setEnviando(true);
    const { data, error } = await votacaoAPI.votar(jogadorId, avaliacao);
    if (error || !data?.sucesso) {
      showToast(data?.erro || error?.message || 'Erro ao registrar avaliação', 'error');
    } else {
      showToast(`✓ ${data.mensagem} Média: ★ ${Number(data.media_estrelas).toFixed(1)}`, 'success');
      // Recarregar lista e limpar nota
      setEstrelas(p => ({ ...p, [jogadorId]: null }));
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
          <div style={{ width: 40, height: 40, background: 'var(--accent-gold-dim)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20 }}>Avaliar Jogadores</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>5 fundamentos · nota de 1 a 5 estrelas</p>
          </div>
        </div>

        {/* Status do dia */}
        {statusHoje && (
          <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue-light)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Avaliações hoje: </span>
              <span style={{ color: 'var(--accent-blue-light)', fontWeight: 700 }}>{statusHoje.votos_hoje}/20</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>({statusHoje.restantes} restantes)</span>
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
            {jogadores.map(j => {
              const avaliacaoJogador = estrelas[j.id] || {};
              const formCompleto = fundamentos.every(f => (avaliacaoJogador[f.key] || 0) > 0);

              return (
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
                        <div style={{ fontSize: 12, color: 'var(--accent-gold)' }}>✓ Já avaliado</div>
                      )}
                      {!j.ja_votou_hoje && (
                        <div style={{ fontSize: 12, color: 'var(--accent-blue-light)' }}>Toque para avaliar →</div>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ transform: expandido === j.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>

                  {/* Expandido - avaliação */}
                  {expandido === j.id && !j.ja_votou_hoje && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                        Dê uma nota de 1 a 5 estrelas para cada fundamento de <strong style={{ color: 'var(--text-primary)' }}>{j.nome}</strong>:
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                        {fundamentos.map(f => {
                          const val = avaliacaoJogador[f.key] || 0;
                          return (
                            <div key={f.key} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{f.label}</span>
                                <span style={{ fontSize: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                                  {labelsNota[val]}
                                </span>
                              </div>
                              <StarPicker
                                value={val}
                                onChange={v => setEstrelas(p => ({
                                  ...p,
                                  [j.id]: {
                                    ...(p[j.id] || {}),
                                    [f.key]: v
                                  }
                                }))}
                                disabled={enviando}
                              />
                            </div>
                          );
                        })}
                      </div>

                      <button
                        className="btn btn-primary"
                        onClick={() => handleVotar(j.id)}
                        disabled={enviando || !formCompleto}
                        style={{ marginTop: 8 }}
                      >
                        {enviando ? <><div className="spinner" /> Enviando...</> : <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          Confirmar Avaliação
                        </>}
                      </button>
                    </div>
                  )}

                  {expandido === j.id && j.ja_votou_hoje && (
                    <div style={{ marginTop: 12, padding: '12px', background: 'var(--accent-gold-dim)', borderRadius: 10, textAlign: 'center', fontSize: 13, color: 'var(--accent-gold)' }}>
                      ✓ Você já avaliou este jogador.
                    </div>
                  )}
                </div>
              );
            })}

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
