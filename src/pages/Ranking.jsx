import { useState, useEffect } from 'react';
import { supabase, rankingAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';

function PlayerAvatar({ fotoUrl, nome, size = 40, border = 'none' }) {
  const initial = nome ? nome.charAt(0).toUpperCase() : '?';
  
  const getGradientForName = (name) => {
    const colors = [
      ['#3b82f6', '#1d4ed8'],
      ['#f59e0b', '#d97706'],
      ['#10b981', '#047857'],
      ['#8b5cf6', '#6d28d9'],
      ['#ec4899', '#be185d'],
      ['#f43f5e', '#be123c'],
      ['#06b6d4', '#0891b2'],
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
        <img src={fotoUrl} alt={nome} style={avatarStyle} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <div style={{
        ...avatarStyle,
        background: getGradientForName(nome),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: size * 0.44,
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
      }}>
        {initial}
      </div>
    </div>
  );
}


export default function Ranking({ profile }) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const categoria = 'geral';

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';
  const uf = profile?.uf || 'PA';

  useEffect(() => {
    if (profile) {
      loadRanking(city, uf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('ranking-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jogadores' },
        () => {
          loadRanking(city, uf);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function loadRanking(cityVal = city, ufVal = uf) {
    setLoading(true);
    const { data } = await rankingAPI.get(cityVal, ufVal, 100);
    setRanking(data || []);
    setLoading(false);
  }

  // Ordenação dinâmica com base na categoria
  const getSortedRanking = () => {
    const sorted = [...ranking];
    if (categoria === 'pontos') {
      return sorted.sort((a, b) => (b.media_arremesso || 0) - (a.media_arremesso || 0));
    }
    if (categoria === 'rebotes') {
      return sorted.sort((a, b) => (b.media_fisicalidade || 0) - (a.media_fisicalidade || 0));
    }
    if (categoria === 'assist') {
      return sorted.sort((a, b) => (b.media_passe || 0) - (a.media_passe || 0));
    }
    if (categoria === 'defesa') {
      return sorted.sort((a, b) => (b.media_defesa || 0) - (a.media_defesa || 0));
    }
    return sorted; // Geral (já vem ordenado por media_estrelas)
  };

  const sortedRanking = getSortedRanking();

  const getMetricValue = (player) => {
    if (categoria === 'pontos') return player.media_arremesso || 0;
    if (categoria === 'rebotes') return player.media_fisicalidade || 0;
    if (categoria === 'assist') return player.media_passe || 0;
    if (categoria === 'defesa') return player.media_defesa || 0;
    return player.media_estrelas || 0;
  };

  const getRankBadgeStyle = (index) => {
    if (index === 0) return { border: '2px solid #F97316', background: 'rgba(249, 115, 22, 0.15)', color: '#F97316' };
    if (index === 1) return { border: '2px solid #94A3B8', background: 'rgba(148, 163, 184, 0.15)', color: '#CBD5E1' };
    if (index === 2) return { border: '2px solid #CD7C2F', background: 'rgba(205, 124, 47, 0.15)', color: '#CD7C2F' };
    return { border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)' };
  };

  if (loading) return (
    <div className="page-content" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="skeleton skeleton-avatar" style={{ width: 40, height: 40 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton skeleton-bar" style={{ width: '60%', height: 16 }} />
          <div className="skeleton skeleton-bar" style={{ width: '40%', height: 12 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, height: 40 }} className="skeleton" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3, 4, 5].map(idx => (
          <div key={idx} className="skeleton" style={{ height: 64, borderRadius: '12px' }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: '20px 20px 0' }}>
        
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            RANKING
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 2 }}>
            {city} - {uf}
          </p>
        </div>

        {/* Listagem */}
        {sortedRanking.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
            <h3>Nenhum jogador classificado</h3>
            <p>Os jogadores aparecerão aqui quando forem avaliados.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {sortedRanking.map((jogador, index) => {
              const isFirst = index === 0;
              
              return (
                <div 
                  key={jogador.id} 
                  className={`card card-enter${isFirst ? ' first-place-card' : ''}`}
                  onClick={() => setSelectedPlayer({ ...jogador, rank: index + 1 })}
                  style={{
                    background: isFirst 
                      ? 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(234,179,8,0.08) 50%, rgba(249,115,22,0.12) 100%)'
                      : '#111827',
                    border: isFirst 
                      ? '1.5px solid rgba(249,115,22,0.5)' 
                      : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: isFirst ? '16px' : '12px',
                    padding: isFirst ? '16px 16px' : '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    animationDelay: `${index * 20}ms`,
                    position: 'relative',
                    overflow: 'hidden',
                    ...(isFirst ? {
                      boxShadow: '0 0 20px rgba(249,115,22,0.15), 0 0 60px rgba(249,115,22,0.05), inset 0 1px 0 rgba(255,255,255,0.06)',
                    } : {})
                  }}
                >
                  {/* Shimmer effect for first place */}
                  {isFirst && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.06) 50%, transparent 100%)',
                      animation: 'shimmer 3s ease-in-out infinite',
                      pointerEvents: 'none'
                    }} />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: isFirst ? 14 : 12 }}>
                    
                    {/* Rank Circle */}
                    {isFirst ? (
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #F97316 0%, #EAB308 100%)',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 900,
                        boxShadow: '0 2px 8px rgba(249,115,22,0.4)',
                        position: 'relative'
                      }}>
                        {/* Crown SVG above rank circle */}
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="#EAB308" 
                          style={{
                            position: 'absolute',
                            top: '-12px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '18px',
                            height: '18px',
                            filter: 'drop-shadow(0 1px 2px rgba(234,179,8,0.5))'
                          }}
                        >
                          <path d="M2.5 18.5l2-9 5 4.5L12 7l2.5 7 5-4.5 2 9h-19z"/>
                        </svg>
                        1
                      </div>
                    ) : (
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 800,
                        ...getRankBadgeStyle(index)
                      }}>
                        {index + 1}
                      </div>
                    )}

                    {/* Avatar */}
                    <PlayerAvatar 
                      fotoUrl={jogador.foto_url} 
                      nome={jogador.nome} 
                      size={isFirst ? 50 : 40}
                      border={isFirst ? '2px solid rgba(249,115,22,0.6)' : 'none'}
                    />

                    {/* Detalhes */}
                    <div>
                      <div style={{
                        fontSize: isFirst ? '15px' : '14px',
                        fontWeight: isFirst ? 800 : 700,
                        color: isFirst ? '#FDE68A' : '#F8FAFC',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        {jogador.nome}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: isFirst ? '#D4A853' : '#94A3B8', 
                        marginTop: 2,
                        fontWeight: isFirst ? 600 : 400
                      }}>
                        {jogador.posicao || 'Ala'}
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Nota e Tendência */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

                    {/* Nota Estrelas */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 3,
                      ...(isFirst ? {
                        background: 'rgba(249,115,22,0.15)',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: '1px solid rgba(249,115,22,0.25)'
                      } : {})
                    }}>
                      <span style={{ 
                        fontSize: isFirst ? '17px' : '15px', 
                        fontWeight: 900, 
                        color: isFirst ? '#FBBF24' : '#F97316', 
                        fontFamily: 'monospace' 
                      }}>
                        {Number(getMetricValue(jogador)).toFixed(1)}
                      </span>
                      <span style={{ color: isFirst ? '#FBBF24' : '#F97316', fontSize: isFirst ? '14px' : '12px' }}>★</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Botão de Rodapé para fechar/voltar */}
        <button 
          onClick={() => window.history.back()}
          style={{
            width: '100%',
            background: 'none',
            border: '1px solid #2563EB',
            borderRadius: '50px',
            color: '#60A5FA',
            padding: '12px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 10,
            marginBottom: 24,
            fontFamily: 'inherit'
          }}
        >
          Ver ranking completo
        </button>

      </div>

      {selectedPlayer && (
        <PlayerProfileModal
          jogador={selectedPlayer}
          rank={selectedPlayer.rank}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
