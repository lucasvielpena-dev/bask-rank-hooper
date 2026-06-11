import { useState, useEffect, useMemo, memo } from 'react';
import { supabase, rankingAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';

const PlayerAvatar = memo(function PlayerAvatar({ fotoUrl, nome, size = 48, isFirst = false }) {
  const initial = nome ? nome.charAt(0).toUpperCase() : '?';

  const getGradientForName = (name) => {
    const colors = [
      ['#C8F135', '#B8E030'],
      ['#f59e0b', '#d97706'],
      ['#10b981', '#047857'],
      ['#8b5cf6', '#6d28d9'],
      ['#ec4899', '#be185d'],
      ['#06b6d4', '#0891b2'],
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `linear-gradient(135deg, ${colors[Math.abs(hash) % colors.length][0]} 0%, ${colors[Math.abs(hash) % colors.length][1]} 100%)`;
  };

  const wrapperStyle = {
    position: 'relative',
    display: 'inline-flex',
    flexShrink: 0,
  };

  const imgStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    border: isFirst ? '2px solid rgba(200,241,53,0.3)' : '1px solid var(--border)',
    boxShadow: isFirst ? '0 0 0 2px rgba(200,241,53,0.3)' : 'none',
  };

  const initialsStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: getGradientForName(nome),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary)',
    fontWeight: 800,
    fontSize: size * 0.4,
    fontFamily: "'Barlow Condensed',sans-serif",
    border: isFirst ? '2px solid transparent' : '1px solid var(--border)',
    boxShadow: isFirst ? '0 0 0 2px rgba(200,241,53,0.3)' : 'none',
  };

  if (fotoUrl) {
    return (
      <div style={wrapperStyle}>
        <img src={fotoUrl} alt={nome} style={imgStyle} />
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <div style={initialsStyle}>{initial}</div>
    </div>
  );
});

const LocationPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#C8F135" stroke="none" style={{ verticalAlign: 'middle', marginRight: 3 }}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);

const ScoreBar = ({ value, max = 5.0, color = 'var(--accent)' }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'var(--border)', marginTop: 6, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.6s ease' }} />
    </div>
  );
};

export default function Ranking({ profile }) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';
  const uf = profile?.uf || 'PA';

  useEffect(() => {
    if (profile) loadRanking(city, uf);
  }, [profile, city, uf]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('ranking-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jogadores' }, () => loadRanking(city, uf))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, city, uf]);

  async function loadRanking(cityVal = city, ufVal = uf) {
    setLoading(true);
    const { data } = await rankingAPI.get(cityVal, ufVal, 100);
    setRanking(data || []);
    setLoading(false);
  }

  const sortedRanking = useMemo(() => [...ranking].sort((a, b) => (b.media_estrelas || 0) - (a.media_estrelas || 0)), [ranking]);

  const getScore = (player) => player.media_estrelas || 0;

  const getBorderStyle = (index) => {
    if (index === 0) return { borderLeft: '4px solid #C8F135' };
    if (index === 1) return { borderLeft: '4px solid #9CA3AF' };
    if (index === 2) return { borderLeft: '4px solid #CD7F32' };
    return {};
  };

  const getBarColor = (index) => {
    if (index === 0) return '#C8F135';
    if (index === 1) return '#9CA3AF';
    if (index === 2) return '#CD7F32';
    return '#64748B';
  };

  const getCardBg = (index) => {
    if (index === 0) return 'linear-gradient(135deg, rgba(200,241,53,0.08) 0%, var(--bg-card) 100%)';
    return 'var(--bg-card)';
  };

  if (loading) return (
    <div className="page-content" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4, 5].map(idx => (
          <div key={idx} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: '16px 16px 0' }}>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h2 style={{
            fontWeight: 800, fontSize: 18, color: 'var(--text-primary)',
            fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: 4
          }}>
            Ranking
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 400, fontFamily: "'Inter',sans-serif" }}>
            <LocationPin />{city} - {uf}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, fontFamily: "'Inter',sans-serif" }}>
            Atualizado hoje
          </p>
        </div>

        {sortedRanking.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
            <h3>Nenhum jogador classificado</h3>
            <p>Os jogadores aparecerão aqui quando forem avaliados.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {sortedRanking.slice(0, 10).map((jogador, index) => {
              const isFirst = index === 0;
              const score = getScore(jogador);
              const barColor = getBarColor(index);

              return (
                <div
                  key={jogador.id}
                  onClick={() => setSelectedPlayer({ ...jogador, rank: index + 1 })}
                  style={{
                    background: getCardBg(index),
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: isFirst ? '16px' : '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'transform 0.15s',
                    position: 'relative',
                    overflow: 'hidden',
                    ...getBorderStyle(index),
                  }}
                >
                  {/* Rank */}
                  <div style={{
                    width: isFirst ? 28 : 22,
                    height: isFirst ? 28 : 22,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isFirst ? 13 : 11,
                    fontWeight: 800,
                    flexShrink: 0,
                    fontFamily: "'Barlow Condensed',sans-serif",
                    ...(isFirst ? {
                      background: '#C8F135',
                      color: '#0C0C14',
                      boxShadow: '0 2px 8px rgba(200,241,53,0.3)',
                    } : index < 3 ? {
                      background: 'var(--border)',
                      color: barColor,
                    } : {
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--text-muted)',
                    }),
                  }}>
                    {index + 1}
                  </div>

                  {/* Avatar */}
                  <PlayerAvatar
                    fotoUrl={jogador.foto_url}
                    nome={jogador.nome}
                    size={isFirst ? 56 : 44}
                    isFirst={isFirst}
                  />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: isFirst ? 16 : 14,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: "'Inter',sans-serif",
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {jogador.nome}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: '#6B7280',
                      fontFamily: "'Inter',sans-serif",
                      fontWeight: 400,
                      marginTop: 2,
                    }}>
                      {jogador.posicao || 'Ala'}
                    </div>
                    <ScoreBar value={score} color={barColor} />
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: isFirst ? 22 : 17,
                      fontWeight: 800,
                      color: isFirst ? '#C8F135' : 'var(--text-primary)',
                      fontFamily: "'Barlow Condensed',sans-serif",
                      lineHeight: 1,
                    }}>
                      {Number(score).toFixed(1)}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      fontFamily: "'Inter',sans-serif",
                      marginTop: 2,
                    }}>
                      / 5.0
                    </div>
                  </div>
                </div>
              );
            })}

            {sortedRanking.length > 10 && (
              <div style={{
                padding: '16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 12,
                fontFamily: "'Inter',sans-serif",
                opacity: 0.5,
              }}>
                +{sortedRanking.length - 10} jogadores no ranking completo
              </div>
            )}
          </div>
        )}

        {/* Stats bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-around',
          padding: '16px 0', marginBottom: 16,
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Barlow Condensed',sans-serif" }}>
              {sortedRanking.length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Atletas
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Barlow Condensed',sans-serif" }}>
              {sortedRanking.filter(j => j.media_estrelas >= 4.0).length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Elite
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Barlow Condensed',sans-serif" }}>
              {sortedRanking.length > 0 ? Number(sortedRanking.reduce((a, b) => a + (b.media_estrelas || 0), 0) / sortedRanking.length).toFixed(1) : '0.0'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Média
            </div>
          </div>
        </div>

        <button
          onClick={() => window.history.back()}
          style={{
            width: '100%', background: '#C8F135', border: 'none', borderRadius: 12,
            height: 52, color: '#0C0C14', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Inter',sans-serif",
            textTransform: 'uppercase', letterSpacing: '0.06em',
            boxShadow: '0 4px 16px rgba(200,241,53,0.25)',
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
