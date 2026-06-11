import { useState, useEffect } from 'react';
import { supabase, rankingAPI } from '../lib/supabase';
import { IconTrofeu, IconAvaliar, IconBasquete, IconRanking } from '../components/Icons';

const ChevronArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const StarIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const MedalIcon = ({ rank }) => {
  if (rank === 1) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C8F135" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  );
  if (rank === 2) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6A6A82" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  );
};

const RankBadge = ({ rank }) => {
  const colors = {
    1: { bg: 'rgba(200,241,53,0.12)', color: '#C8F135', border: '1px solid rgba(200,241,53,0.25)' },
    2: { bg: 'rgba(148,163,184,0.12)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.25)' },
    3: { bg: 'rgba(106,106,130,0.12)', color: '#6A6A82', border: '1px solid rgba(106,106,130,0.25)' },
  };
  const c = colors[rank] || colors[3];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 26, height: 26, borderRadius: 8,
      background: c.bg, border: c.border, color: c.color,
      fontSize: 12, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif",
      flexShrink: 0,
    }}>
      {rank}º
    </span>
  );
};

export default function Home({ profile, onNavigate }) {
  const [topPlayers, setTopPlayers] = useState([]);
  const [myPlayerInfo, setMyPlayerInfo] = useState(null);
  const [myRank, setMyRank] = useState('--');
  const [loading, setLoading] = useState(true);

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';
  const uf = profile?.uf || 'PA';

  useEffect(() => {
    if (profile) loadData(city, uf);
  }, [profile, city, uf]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jogadores' }, () => loadData(city, uf))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, city, uf]);

  async function loadData(cityVal = city, ufVal = uf) {
    setLoading(true);
    try {
      const { data: rankList } = await rankingAPI.get(cityVal, ufVal, 50);
      if (rankList) {
        const sorted = [...rankList].sort((a, b) => (b.media_estrelas || 0) - (a.media_estrelas || 0));
        setTopPlayers(sorted.slice(0, 5));

        if (profile?.player_id) {
          const myIndex = sorted.findIndex(j => j.id === profile.player_id);
          setMyRank(myIndex !== -1 ? `#${myIndex + 1}` : '--');
          if (myIndex !== -1) {
            setMyPlayerInfo(sorted[myIndex]);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const getBadgeText = (media) => {
    if (media >= 4.5) return 'ELITE';
    if (media >= 4.0) return 'DESTAQUE';
    if (media >= 3.5) return 'PROMISSA';
    return 'EM DEV';
  };

  const myBadge = getBadgeText(myPlayerInfo?.media_estrelas || 0);
  const greetingName = profile?.apelido || profile?.nome_completo?.split(' ')[0] || 'Atleta';

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getPositionColor = (pos) => {
    const map = { 'Ala': '#3B82F6', 'Ala-Armador': '#8B5CF6', 'Armador': '#A855F7', 'Ala-Pivô': '#06B6D4', 'Pivô': '#10B981' };
    return map[pos] || '#6A6A82';
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-content home-page">
      <div className="home-container">

        <div className="home-greeting">
          <div className="home-greeting-title">
            {getGreeting()}, <span className="home-greeting-name">{greetingName}</span>
          </div>
          <div className="home-greeting-sub">
            Você está entre os melhores atletas de {city}.
          </div>
        </div>

        <div className="home-position-card">
          <div className="home-position-top">
            <div className="home-position-left">
              <div className="home-position-label">Sua Posição</div>
              <div className="home-position-number">{myRank}</div>
              <div className="home-position-city">Ranking de {city} - {uf}</div>
            </div>
            {myPlayerInfo?.foto_perfil && (
              <img src={myPlayerInfo.foto_perfil} alt={greetingName} className="home-position-avatar" />
            )}
          </div>
          <div className="home-position-meta">
            <span className="home-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M2.5 18.5l2-9 5 4.5L12 7l2.5 7 5-4.5 2 9h-19z"/>
              </svg>
              {myBadge}
            </span>
            <span className="home-position-percent">
              Top {myRank !== '--' ? `${Math.max(1, Math.round((parseInt(myRank.replace('#','')) || 1) / (topPlayers.length || 1) * 100))}%` : '--'} da cidade
            </span>
          </div>
          <button className="btn-ranking" onClick={() => onNavigate('ranking')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
            Ver Ranking
          </button>
        </div>

        <div className="home-highlights-section">
          <div className="home-highlights-header">
            <div className="home-section-label">Destaques da Semana</div>
            <button onClick={() => onNavigate('destaques')} className="home-section-link">
              Ver todos
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topPlayers.map((player, i) => (
              <div
                key={player.id}
                onClick={() => onNavigate('jogadores', { selectedPlayer: { ...player, rank: i + 1 } })}
                style={{
                  background: 'var(--bg-card)',
                  border: i === 0 ? '1px solid rgba(200,241,53,0.15)' : '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
              >
                {player.foto_url ? (
                  <img
                    src={player.foto_url}
                    alt={player.nome}
                    style={{
                      width: 76, height: 76, borderRadius: 12, objectFit: 'cover',
                      border: i === 0 ? '2px solid rgba(200,241,53,0.25)' : '1px solid var(--border)',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div style={{
                    width: 76, height: 76, borderRadius: 12, flexShrink: 0,
                    background: `linear-gradient(135deg, ${getPositionColor(player.posicao)}22, ${getPositionColor(player.posicao)}44)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: i === 0 ? '2px solid rgba(200,241,53,0.25)' : '1px solid var(--border)',
                  }}>
                    <span style={{
                      fontSize: 26, fontWeight: 800, color: getPositionColor(player.posicao),
                      fontFamily: "'Barlow Condensed',sans-serif",
                    }}>
                      {player.nome ? player.nome.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RankBadge rank={i + 1} />
                    <span style={{
                      fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
                      fontFamily: "'Inter',sans-serif", lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {player.nome}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 12, color: getPositionColor(player.posicao), fontWeight: 600,
                      fontFamily: "'Inter',sans-serif",
                    }}>
                      {player.posicao || 'Ala'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <StarIcon size={13} />
                    <span style={{
                      fontSize: 15, fontWeight: 800, color: 'var(--text-primary)',
                      fontFamily: "'Barlow Condensed',sans-serif",
                    }}>
                      {Number(player.media_estrelas || 0).toFixed(1)}
                    </span>
                  </div>
                </div>

                {i === 0 && (
                  <MedalIcon rank={1} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="home-actions-section">
          <div className="home-section-label">Ações Rápidas</div>
          <div className="acoes-rapidas-grid">
            {[
              { icon: <IconAvaliar size={20} color="var(--accent)" />, label: 'Avaliar atleta', action: () => onNavigate('jogadores') },
              { icon: <IconBasquete size={20} color="var(--accent)" />, label: 'Meus jogos', action: () => onNavigate('jogos') },
              { icon: <IconRanking size={20} color="var(--accent)" />, label: 'Ver ranking', action: () => onNavigate('ranking') },
              { icon: <IconTrofeu size={20} color="var(--accent)" />, label: 'Ver torneios', action: () => onNavigate('jogos', { aba: 'torneios' }) }
            ].map((item) => (
              <button key={item.label} className="home-quick-action" onClick={item.action}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
                  <div className="home-quick-action-icon">
                    {item.icon}
                  </div>
                  <ChevronArrow />
                </div>
                <div className="home-quick-action-label">{item.label}</div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
