import { useState, useEffect } from 'react';
import { rankingAPI } from '../lib/supabase';

export default function Ranking() {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRanking(); }, []);

  async function loadRanking() {
    setLoading(true);
    const { data } = await rankingAPI.get(50);
    setRanking(data || []);
    setLoading(false);
  }

  const getInitial = (nome) => nome ? nome.charAt(0).toUpperCase() : '?';

  const top3 = ranking.slice(0, 3);
  const resto = ranking.slice(3);

  if (loading) return (
    <div className="page-content">
      <div className="loading"><div className="spinner" /><span>Carregando ranking...</span></div>
    </div>
  );

  return (
    <div className="page-content">
      <div style={{ padding: '20px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20 }}>🏀 Ranking de Basquete</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{ranking.length} jogadores classificados</p>
          </div>
        </div>

        {ranking.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            <h3>Nenhum jogador avaliado ainda</h3>
            <p>Vá em "Avaliar Jogadores" para começar o ranking!</p>
            <small style={{ color: '#475569', fontSize: 12 }}>Mínimo de 5 votos por jogador para aparecer</small>
          </div>
        ) : (
          <>
            {/* Pódio */}
            {top3.length >= 1 && (
              <div style={{ position: 'relative', marginBottom: 24 }}>
                {/* Pódio visual */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 0 }}>

                  {/* 2º lugar - esquerda */}
                  {top3[1] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a1e28', border: '2px solid #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#94a3b8', marginBottom: 4 }}>
                        {getInitial(top3[1].nome)}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{top3[1].nome}</div>
                      <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>★ {Number(top3[1].media_estrelas).toFixed(1)}</div>
                      <div style={{ height: 56, width: '100%', background: '#1a1e28', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span style={{ fontWeight: 900, fontSize: 22, color: '#64748b' }}>2</span>
                      </div>
                    </div>
                  )}

                  {/* 1º lugar - centro */}
                  {top3[0] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ fontSize: 20, marginBottom: 2 }}>👑</div>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1a1e28', border: '3px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, color: '#f59e0b', marginBottom: 4 }}>
                        {getInitial(top3[0].nome)}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{top3[0].nome}</div>
                      <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>★ {Number(top3[0].media_estrelas).toFixed(1)}</div>
                      <div style={{ height: 80, width: '100%', background: '#1f2435', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
                        <span style={{ fontWeight: 900, fontSize: 26, color: '#92400e' }}>1</span>
                      </div>
                    </div>
                  )}

                  {/* 3º lugar - direita */}
                  {top3[2] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a1e28', border: '2px solid #cd7c2f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#cd7c2f', marginBottom: 4 }}>
                        {getInitial(top3[2].nome)}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{top3[2].nome.length > 8 ? top3[2].nome.slice(0,8)+'...' : top3[2].nome}</div>
                      <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>★ {Number(top3[2].media_estrelas).toFixed(1)}</div>
                      <div style={{ height: 40, width: '100%', background: '#1a1e28', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span style={{ fontWeight: 900, fontSize: 22, color: '#64748b' }}>3</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Meu destaque (1º lugar em resumo) */}
            {top3[0] && (
              <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🥇</div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#f59e0b', fontSize: 18 }}>{getInitial(top3[0].nome)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{top3[0].nome}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{top3[0].total_votos} votos</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>★ {Number(top3[0].media_estrelas).toFixed(1)}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>MÉDIA</div>
                </div>
              </div>
            )}

            {/* Lista completa */}
            {resto.length > 0 && (
              <div>
                <div className="section-title" style={{ marginBottom: 10, paddingTop: 4 }}>
                  Classificação Geral
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {ranking.map((j, i) => (
                    <div key={j.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                      <div style={{ width: 28, textAlign: 'center', fontWeight: 800, fontSize: 15, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c2f' : '#64748b' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                      </div>
                      <div className="avatar" style={{ width: 36, height: 36, fontSize: 15 }}>{getInitial(j.nome)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {j.nome}
                          {j.atual_campeao && <span style={{ marginLeft: 6, fontSize: 12, color: '#f59e0b' }}>👑</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{j.total_votos} votos</div>
                      </div>
                      <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 14 }}>
                        ★ {Number(j.media_estrelas).toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
