import { useState, useEffect, useMemo } from 'react';
import { supabase, jogadoresAPI, rankingAPI } from '../lib/supabase';
import { IconTrofeu, IconAvaliar, IconBasquete, IconRanking } from '../components/Icons';

const ChevronArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m9 18 6-6-6-6"/>
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
    if (media >= 3.5) return 'PROMESSA';
    return 'EM DEV.';
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
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, value: stats.jogadores, label: 'Atletas' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, value: stats.mediaGeral.toFixed(1), label: 'Nota' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/></svg>, value: stats.avaliacoes, label: 'Partidas' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>, value: stats.torneios, label: 'Torneios' }
  ], [stats]);

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

        <div className="home-position-card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div style={{ position:'relative', zIndex:2 }}>
            <div className="home-position-label">Sua Posição</div>
            <div className="home-position-number">{myRank}</div>
            <div className="home-position-city">Ranking de {city} - {uf}</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <span className="home-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M2.5 18.5l2-9 5 4.5L12 7l2.5 7 5-4.5 2 9h-19z"/>
                </svg>
                {myBadge}
              </span>
              <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>
                Top {myRank !== '--' ? `${Math.max(1, Math.round((parseInt(myRank.replace('#','')) || 1) / (stats.jogadores || 1) * 100))}%` : '--'} da cidade
              </span>
            </div>
            <button
              onClick={() => onNavigate('ranking')}
              style={{ background:'var(--accent)', color:'#05070A', border:'none', borderRadius:14, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Oswald',sans-serif", textTransform:'uppercase', letterSpacing:'0.04em', transition:'all 0.2s' }}
            >
              Ver Ranking
            </button>
          </div>
          {myPlayerInfo?.foto_perfil ? (
            <img src={myPlayerInfo.foto_perfil} alt={greetingName} style={{ width:100, height:100, borderRadius:'50%', objectFit:'cover', border:'3px solid rgba(255,107,0,0.3)', flexShrink:0 }} />
          ) : (
            <div style={{ width:100, height:100, borderRadius:'50%', background:'var(--accent-dim)', border:'3px solid rgba(255,107,0,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, fontWeight:700, color:'var(--accent)', flexShrink:0, fontFamily:"'Oswald',sans-serif" }}>
              {greetingName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ marginBottom:24 }}>
          <div className="home-section-label" style={{ marginBottom:12 }}>Estatísticas</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {statsData.map((item) => (
              <div key={item.label} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:'14px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <div style={{ color:'var(--accent)' }}>{item.icon}</div>
                <div style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', fontFamily:"'Oswald',sans-serif" }}>{item.value}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textAlign:'center', fontFamily:"'Oswald',sans-serif", textTransform:'uppercase', letterSpacing:'0.04em' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div className="home-section-label">Destaques da Semana</div>
            <button onClick={() => onNavigate('destaques')} style={{ background:'none', border:'none', color:'var(--accent)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Oswald',sans-serif", textTransform:'uppercase', letterSpacing:'0.04em' }}>
              Ver todos
            </button>
          </div>
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
            {[
              { medal: '1º', name: 'Líder', nota: '5.0', pos: 'Ala' },
              { medal: '2º', name: 'Vice', nota: '4.8', pos: 'Pivô' },
              { medal: '3º', name: 'Terceiro', nota: '4.6', pos: 'Armador' },
            ].map((item, i) => (
              <div key={i} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:16, minWidth:160, flex:'0 0 auto' }}>
                <div style={{ fontSize:22, fontWeight:700, color:'var(--accent)', fontFamily:"'Oswald',sans-serif", marginBottom:8 }}>{item.medal}</div>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:2, fontFamily:"'Oswald',sans-serif", textTransform:'uppercase' }}>{item.name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>{item.pos}</div>
                <div style={{ fontSize:18, fontWeight:700, color:'var(--accent)', fontFamily:"'Oswald',sans-serif" }}>{item.nota}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="home-section-label" style={{ marginBottom:12 }}>Ações Rápidas</div>
          <div className="acoes-rapidas-grid">
            {[
              { icon: <IconAvaliar size={22} color="#05070A" />, label: 'Avaliar atleta', action: () => onNavigate('jogadores'), primary: true },
              { icon: <IconBasquete size={22} color="var(--accent)" />, label: 'Meus jogos', action: () => onNavigate('jogos'), primary: false },
              { icon: <IconRanking size={22} color="var(--accent)" />, label: 'Ver ranking', action: () => onNavigate('ranking'), primary: false },
              { icon: <IconTrofeu size={22} color="var(--accent)" />, label: 'Ver torneios', action: () => onNavigate('jogos', { aba: 'torneios' }), primary: false }
            ].map((item) => (
              <button key={item.label} className={`home-quick-action ${item.primary ? 'home-quick-action-primary' : ''}`} onClick={item.action}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
                  <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background: item.primary ? 'rgba(0,0,0,0.12)' : 'var(--accent-dim)' }}>
                    {item.icon}
                  </div>
                  <ChevronArrow />
                </div>
                <div style={{ fontSize:13, fontWeight:700, lineHeight:1.2, fontFamily:"'Oswald',sans-serif", textTransform:'uppercase', letterSpacing:'0.02em' }}>{item.label}</div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
