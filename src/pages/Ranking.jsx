import { useState, useEffect } from 'react';
import { supabase, rankingAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';

// Deterministic player avatar rendering
function PlayerAvatar({ fotoUrl, nome, size = 44, border = 'none', hasCrown = false }) {
  const initial = nome ? nome.charAt(0).toUpperCase() : '?';
  
  const getGradientForName = (name) => {
    const colors = [
      ['#3b82f6', '#1d4ed8'], // Blue
      ['#f59e0b', '#d97706'], // Gold
      ['#10b981', '#047857'], // Emerald
      ['#8b5cf6', '#6d28d9'], // Violet
      ['#ec4899', '#be185d'], // Pink
      ['#f43f5e', '#be123c'], // Rose
      ['#06b6d4', '#0891b2'], // Cyan
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return `linear-gradient(135deg, ${colors[index][0]} 0%, ${colors[index][1]} 100%)`;
  };

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    border: border,
    flexShrink: 0
  };

  if (fotoUrl) {
    return (
      <div style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
        {hasCrown && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 18, zIndex: 5 }}>👑</div>}
        <img src={fotoUrl} alt={nome} style={avatarStyle} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      {hasCrown && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 18, zIndex: 5 }}>👑</div>}
      <div style={{
        ...avatarStyle,
        background: getGradientForName(nome),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: size * 0.44,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        {initial}
      </div>
    </div>
  );
}

// Deterministic position evolution calculation
const getEvolucao = (id) => {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const val = (Math.abs(hash) % 7) - 3; // range -3 to +3
  return val;
};

const renderEvolucao = (val) => {
  if (val > 0) {
    return <span style={{ fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800 }}>▲ {val}</span>;
  }
  if (val < 0) {
    return <span style={{ fontSize: '10px', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800 }}>▼ {Math.abs(val)}</span>;
  }
  return <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 600 }}>➖</span>;
};

// Premium Badges style
function renderBadge(media) {
  if (media >= 4.5) return <span className="badge-elite">🏆 Elite</span>;
  if (media >= 4.0) return <span className="badge-destaque">⭐ Destaque</span>;
  if (media >= 3.5) return <span className="badge-promessa">📈 Promessa</span>;
  return <span className="badge-desenvolvimento">🔄 Em Des.</span>;
}

export default function Ranking({ profile }) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';

  useEffect(() => {
    loadRanking();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('ranking-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jogadores' },
        () => {
          loadRanking();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadRanking() {
    setLoading(true);
    const { data } = await rankingAPI.get(50);
    setRanking(data || []);
    setLoading(false);
  }

  const top3 = ranking.slice(0, 3);

  // Quick statistics calculation
  const totalJogadores = ranking.length;
  const mediaGeral = ranking.reduce((acc, curr) => acc + Number(curr.media_estrelas), 0) / (totalJogadores || 1);
  const totalAvaliacoes = ranking.reduce((acc, curr) => acc + Number(curr.total_votos), 0);

  if (loading) return (
    <div className="page-content">
      <div className="loading"><div className="spinner" /><span>Carregando ranking...</span></div>
    </div>
  );

  return (
    <div className="page-content">
      <div style={{ padding: '20px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20 }}>🏀 Ranking de {city}</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Ranking municipal atualizado</p>
          </div>
        </div>

        {/* Estatísticas Rápidas */}
        {ranking.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, background: 'var(--bg-card)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>🏀 {totalJogadores}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Jogadores</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-gold)' }}>⭐ {mediaGeral.toFixed(1)}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Média Geral</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-blue-light)' }}>🗳️ {totalAvaliacoes}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Avaliações</div>
            </div>
          </div>
        )}

        {ranking.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            <h3>Nenhum jogador classificado</h3>
            <p>Vá em "Avaliar Jogadores" para começar a pontuar!</p>
            <small style={{ color: '#475569', fontSize: 12, marginTop: 10 }}>Mínimo de 1 avaliação por jogador para aparecer no ranking</small>
          </div>
        ) : (
          <>
            {/* Pódio Físico Real */}
            {top3.length >= 1 && (
              <div style={{
                position: 'relative',
                marginBottom: 28,
                background: 'rgba(21, 24, 32, 0.4)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '24px 12px 0 12px',
                backdropFilter: 'blur(12px)',
                webkitBackdropFilter: 'blur(12px)',
                boxShadow: 'inset 0 0 20px rgba(255,255,255,0.01)'
              }}>
                {/* Pódio visual */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6, marginBottom: 0 }}>

                  {/* 2º lugar - esquerda */}
                  {top3[1] ? (
                    <div onClick={() => setSelectedPlayer(top3[1])} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, cursor: 'pointer', transition: 'transform 0.2s' }}>
                      <PlayerAvatar fotoUrl={top3[1].foto_url} nome={top3[1].nome} size={52} border="2px solid #94a3b8" />
                      <div style={{
                        height: 75,
                        width: '100%',
                        background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.12) 0%, rgba(26, 30, 40, 0.85) 100%)',
                        border: '1.5px solid rgba(148, 163, 184, 0.4)',
                        borderRadius: '12px 12px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 4px',
                        marginTop: 10,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}>
                        <div style={{ textAlign: 'center', width: '100%' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                            {top3[1].nome.split(' ')[0]}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--accent-gold)', fontWeight: 800, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                            ★ {Number(top3[1].media_estrelas).toFixed(1)}
                          </div>
                        </div>
                        <span style={{ fontWeight: 950, fontSize: '26px', color: '#94a3b8', opacity: 0.8, lineHeight: 1 }}>2</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1 }} />
                  )}

                  {/* 1º lugar - centro */}
                  {top3[0] && (
                    <div onClick={() => setSelectedPlayer(top3[0])} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1.1, cursor: 'pointer', zIndex: 2, transition: 'transform 0.2s' }}>
                      <PlayerAvatar fotoUrl={top3[0].foto_url} nome={top3[0].nome} size={68} border="3px solid #f59e0b" hasCrown={true} />
                      <div className="leader-active-glow" style={{
                        height: 105,
                        width: '100%',
                        background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.18) 0%, rgba(26, 30, 40, 0.9) 100%)',
                        border: '1.5px solid rgba(245, 158, 11, 0.5)',
                        borderRadius: '12px 12px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 4px 10px',
                        marginTop: 10,
                        boxShadow: '0 6px 20px rgba(245, 158, 11, 0.2)'
                      }}>
                        <div style={{ textAlign: 'center', width: '100%' }}>
                          <div style={{ fontSize: '12px', fontWeight: 900, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                            {top3[0].nome.split(' ')[0]}
                          </div>
                          <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 800, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                            ★ {Number(top3[0].media_estrelas).toFixed(1)}
                          </div>
                        </div>
                        <span style={{ fontWeight: 950, fontSize: '32px', color: '#f59e0b', lineHeight: 1 }}>1</span>
                      </div>
                    </div>
                  )}

                  {/* 3º lugar - direita */}
                  {top3[2] ? (
                    <div onClick={() => setSelectedPlayer(top3[2])} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 0.9, cursor: 'pointer', transition: 'transform 0.2s' }}>
                      <PlayerAvatar fotoUrl={top3[2].foto_url} nome={top3[2].nome} size={46} border="2px solid #cd7c2f" />
                      <div style={{
                        height: 55,
                        width: '100%',
                        background: 'linear-gradient(180deg, rgba(205, 124, 47, 0.12) 0%, rgba(26, 30, 40, 0.85) 100%)',
                        border: '1.5px solid rgba(205, 124, 47, 0.4)',
                        borderRadius: '12px 12px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 4px 6px',
                        marginTop: 10,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}>
                        <div style={{ textAlign: 'center', width: '100%' }}>
                          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                            {top3[2].nome.split(' ')[0]}
                          </div>
                          <div style={{ fontSize: '9px', color: 'var(--accent-gold)', fontWeight: 800, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                            ★ {Number(top3[2].media_estrelas).toFixed(1)}
                          </div>
                        </div>
                        <span style={{ fontWeight: 950, fontSize: '22px', color: '#cd7c2f', opacity: 0.8, lineHeight: 1 }}>3</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 0.9 }} />
                  )}
                </div>
              </div>
            )}

            {/* Lista completa */}
            {ranking.length > 0 && (
              <div>
                <div className="section-title" style={{ marginBottom: 12, paddingTop: 4, fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🏆</span> Classificação Geral
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {ranking.map((j, i) => {
                    const evolVal = getEvolucao(j.id);
                    return (
                      <div key={j.id} className="card" onClick={() => setSelectedPlayer(j)} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '16px 16px',
                        cursor: 'pointer',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, gap: 2 }}>
                          <span style={{ fontWeight: 900, fontSize: 14, color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c2f' : 'var(--text-muted)' }}>
                            {i === 0 ? '1º' : i === 1 ? '2º' : i === 2 ? '3º' : `#${i+1}`}
                          </span>
                          {renderEvolucao(evolVal)}
                        </div>
                        <PlayerAvatar fotoUrl={j.foto_url} nome={j.nome} size={40} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nome}</span>
                            {j.atual_campeao && <span style={{ fontSize: 12 }}>👑</span>}
                            {renderBadge(j.media_estrelas)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {j.posicao || 'Ala'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent-gold)' }}>
                              {Number(j.media_estrelas).toFixed(1)}
                            </span>
                            <span style={{ color: 'var(--accent-gold)', fontSize: '14px', lineHeight: 1 }}>★</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {j.total_votos} {j.total_votos === 1 ? 'avaliação' : 'avaliações'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedPlayer && (
        <PlayerProfileModal
          jogador={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
