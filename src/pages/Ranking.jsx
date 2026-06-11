import { useState, useEffect, useMemo, memo } from 'react';
import { supabase, rankingAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';

const PlayerAvatar = memo(function PlayerAvatar({ fotoUrl, nome, size = 40, border = 'none' }) {
  const initial = nome ? nome.charAt(0).toUpperCase() : '?';
  
  const getGradientForName = (name) => {
    const colors = [
      ['var(--accent)', 'var(--accent)'],
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
    border: border !== 'none' ? border : '1px solid var(--border)',
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.08)',
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
});

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

  const sortedRanking = useMemo(() => {
    const sorted = [...ranking];
    if (categoria === 'pontos') {
      return sorted.sort((a, b) => (b.media_arremesso || 0) - (a.media_arremesso || 0));
    }
    if (categoria === 'rebotes') {
      return sorted.sort((a, b) => (b.media_explosao_fisica || 0) - (a.media_explosao_fisica || 0));
    }
    if (categoria === 'assist') {
      return sorted.sort((a, b) => (b.media_controle_de_bola || 0) - (a.media_controle_de_bola || 0));
    }
    if (categoria === 'defesa') {
      return sorted.sort((a, b) => (b.media_defesa || 0) - (a.media_defesa || 0));
    }
    return sorted;
  }, [ranking, categoria]);

  const getMetricValue = (player) => {
    if (categoria === 'pontos') return player.media_arremesso || 0;
    if (categoria === 'rebotes') return player.media_explosao_fisica || 0;
    if (categoria === 'assist') return player.media_controle_de_bola || 0;
    if (categoria === 'defesa') return player.media_defesa || 0;
    return player.media_estrelas || 0;
  };

  const getRankBadgeStyle = (index) => {
    if (index === 0) return { border: '2px solid var(--accent)', background: 'rgba(249,115,22,0.15)', color: 'var(--accent)' };
    if (index === 1) return { border: '2px solid #94A3B8', background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-secondary)' };
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
    <div className="page-content" style={{ background: 'var(--bg-primary)', position: 'relative' }}>
      <div style={{ position: 'relative', zIndex: 2, padding: '20px 20px 0' }}>
        
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)', fontFamily:"'Oswald',sans-serif", textTransform:'uppercase', letterSpacing:'0.04em' }}>
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
          <div className="responsive-card-grid" style={{ marginBottom: 20 }}>
            {sortedRanking.map((jogador, index) => {
              const isFirst = index === 0;
              
              return (
                <div 
                  key={jogador.id} 
                  className={`card card-enter${isFirst ? ' first-place-card' : ''}`}
                  onClick={() => setSelectedPlayer({ ...jogador, rank: index + 1 })}
                  style={{
                    borderRadius: isFirst ? '22px' : '22px',
                    padding: isFirst ? '16px 16px' : '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    animationDelay: `${index * 20}ms`,
                    position: 'relative',
                    overflow: 'hidden',
                    ...(isFirst ? {
                      border: '1.5px solid var(--accent)',
                      background: 'linear-gradient(180deg, rgba(249,115,22,0.1) 0%, var(--bg-card) 100%)',
                      boxShadow: '0 8px 30px rgba(249,115,22,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
                    } : {})
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: isFirst ? 14 : 12 }}>
                    
                    {/* Rank Circle */}
                    {isFirst ? (
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--accent)',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 900,
                        boxShadow: '0 2px 8px rgba(249,115,22,0.4)',
                        position: 'relative',
                        flexShrink: 0
                      }}>
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
                        flexShrink: 0,
                        ...getRankBadgeStyle(index)
                      }}>
                        {index + 1}
                      </div>
                    )}

                    {/* Avatar */}
                    <PlayerAvatar 
                      fotoUrl={jogador.foto_url} 
                      nome={jogador.nome} 
                      size={isFirst ? 60 : 40}
                      border={isFirst ? '3px solid rgba(249,115,22,0.6)' : 'none'}
                    />

                    {/* Detalhes */}
                    <div>
                      <div style={{
                        fontSize: isFirst ? '17px' : '14px',
                        fontWeight: isFirst ? 900 : 700,
                        color: isFirst ? 'var(--accent)' : 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        {jogador.nome}
                      </div>
                      <div style={{ 
                        fontSize: isFirst ? '12px' : '11px', 
                        color: isFirst ? 'var(--text-secondary)' : 'var(--text-secondary)', 
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
                        background: 'var(--accent-dim)',
                        padding: '5px 12px',
                        borderRadius: '20px',
                        border: '1px solid rgba(249,115,22,0.25)'
                      } : {})
                    }}>
                      <span style={{ 
                        fontSize: isFirst ? '18px' : '15px', 
                        fontWeight: 900, 
                        color: isFirst ? 'var(--accent)' : 'var(--accent)', 
                        fontFamily: 'monospace' 
                      }}>
                        {Number(getMetricValue(jogador)).toFixed(1)}
                      </span>
                      <span style={{ color: isFirst ? 'var(--accent)' : 'var(--accent)', fontSize: isFirst ? '15px' : '12px' }}>★</span>
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
          className="btn-back-ranking"
          style={{
            background: 'none',
            border: '1px solid var(--accent)',
            borderRadius: '50px',
            color: 'var(--accent)',
            padding: '12px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
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
