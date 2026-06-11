import { useState, useEffect, useMemo } from 'react';
import { supabase, jogadoresAPI, rankingAPI } from '../lib/supabase';
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

export default function Home({ profile, onNavigate }) {
  const [stats, setStats] = useState({ jogadores: 0, torneios: 0, avaliacoes: 0, mediaGeral: 0.0 });
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
      const [{ data: jogs }, { count: tCount }] = await Promise.all([
        jogadoresAPI.listarPorEstado(ufVal),
        supabase.from('torneios').select('*', { count: 'exact', head: true })
      ]);

      const total = jogs?.length || 0;
      const totalVotes = jogs?.reduce((acc, curr) => acc + (curr.total_votos || 0), 0) || 0;
      const averageStarsSum = jogs?.reduce((acc, curr) => acc + (curr.media_estrelas || 0), 0) || 0;
      const generalAvg = total > 0 ? (averageStarsSum / total) : 4.8;

      setStats({ jogadores: total, torneios: tCount || 0, avaliacoes: totalVotes, mediaGeral: generalAvg });

      if (profile?.player_id) {
        const { data: pInfo } = await supabase.from('jogadores').select('*').eq('id', profile.player_id).maybeSingle();
        if (pInfo) setMyPlayerInfo(pInfo);

        const { data: rankList } = await rankingAPI.get(cityVal, ufVal, 200);
        if (rankList) {
          const myIndex = rankList.findIndex(j => j.id === profile.player_id);
          setMyRank(myIndex !== -1 ? `#${myIndex + 1}` : '--');
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

  const statsData = useMemo(() => [
    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, value: stats.jogadores, label: 'Atletas', trend: '+12%' },
    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, value: stats.mediaGeral.toFixed(1), label: 'Nota Media', trend: '+0.3' },
    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/></svg>, value: stats.avaliacoes, label: 'Partidas', trend: '+8' },
    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>, value: stats.torneios, label: 'Torneios', trend: '+2' }
  ], [stats]);

  const topHighlights = useMemo(() => [
    { rank: '1\u00ba', name: 'L\u00edder', nota: '5.0', pos: 'Ala', cardClass: 'gold' },
    { rank: '2\u00ba', name: 'Vice', nota: '4.8', pos: 'Piv\u00f4', cardClass: 'silver' },
    { rank: '3\u00ba', name: 'Terceiro', nota: '4.6', pos: 'Armador', cardClass: 'bronze' },
  ], []);

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
            Voc\u00ea est\u00e1 entre os melhores atletas de {city}.
          </div>
        </div>

        <div className="home-position-card">
          <div className="home-position-top">
            <div className="home-position-left">
              <div className="home-position-label">Sua Posi\u00e7\u00e3o</div>
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
              Top {myRank !== '--' ? `${Math.max(1, Math.round((parseInt(myRank.replace('#','')) || 1) / (stats.jogadores || 1) * 100))}%` : '--'} da cidade
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

        <div className="home-stats-section">
          <div className="home-section-label">Estat\u00edsticas</div>
          <div className="home-stats-grid">
            {statsData.map((item) => (
              <div key={item.label} className="home-stat-item">
                <div className="home-stat-header">
                  <div className="home-stat-icon">{item.icon}</div>
                  <span className="home-stat-trend">{item.trend}</span>
                </div>
                <div className="home-stat-value">{item.value}</div>
                <div className="home-stat-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="home-highlights-section">
          <div className="home-highlights-header">
            <div className="home-section-label">Destaques da Semana</div>
            <button onClick={() => onNavigate('destaques')} className="home-section-link">
              Ver todos
            </button>
          </div>
          <div className="home-highlights-scroll">
            {topHighlights.map((item, i) => (
              <div key={i} className={`home-highlight-card ${item.cardClass}`}>
                <div className="home-highlight-rank">{item.rank}</div>
                <div className="home-highlight-name">{item.name}</div>
                <div className="home-highlight-detail">{item.pos}</div>
                <div className="home-highlight-score">
                  <StarIcon size={14} />
                  {item.nota}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="home-actions-section">
          <div className="home-section-label">A\u00e7\u00f5es R\u00e1pidas</div>
          <div className="acoes-rapidas-grid">
            {[
              { icon: <IconAvaliar size={20} color="#0C0C14" />, label: 'Avaliar atleta', action: () => onNavigate('jogadores'), primary: true },
              { icon: <IconBasquete size={20} color="var(--accent)" />, label: 'Meus jogos', action: () => onNavigate('jogos'), primary: false },
              { icon: <IconRanking size={20} color="var(--accent)" />, label: 'Ver ranking', action: () => onNavigate('ranking'), primary: false },
              { icon: <IconTrofeu size={20} color="var(--accent)" />, label: 'Ver torneios', action: () => onNavigate('jogos', { aba: 'torneios' }), primary: false }
            ].map((item) => (
              <button key={item.label} className={`home-quick-action ${item.primary ? 'home-quick-action-primary' : ''}`} onClick={item.action}>
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
