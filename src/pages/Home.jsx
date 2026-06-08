import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI, rankingAPI } from '../lib/supabase';
import { IconCrescimento, IconTrofeu, IconCalendario, IconAvaliar, IconBasquete, IconRanking } from '../components/Icons';

// Deterministic position evolution calculation
// eslint-disable-next-line no-unused-vars
const getEvolucaoValue = (id) => {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const val = (Math.abs(hash) % 7) - 3; // range -3 to +3
  return val;
};

export default function Home({ profile, onNavigate }) {
  const [stats, setStats] = useState({ jogadores: 0, torneios: 0, avaliacoes: 0, mediaGeral: 0.0 });
  const [myPlayerInfo, setMyPlayerInfo] = useState(null);
  const [myRank, setMyRank] = useState('--');
  const [lider, setLider] = useState(null);
  const [loading, setLoading] = useState(true);

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';
  const uf = profile?.uf || 'PA';

  useEffect(() => {
    if (profile) {
      loadData(city, uf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('home-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jogadores' },
        () => {
          loadData(city, uf);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function loadData(cityVal = city, ufVal = uf) {
    setLoading(true);
    try {
      const [{ data: jogs }, { data: ranking }, { count: tCount }] = await Promise.all([
        jogadoresAPI.listarPorEstado(ufVal),
        rankingAPI.getTop5(cityVal, ufVal),
        supabase.from('torneios').select('*', { count: 'exact', head: true })
      ]);

      const total = jogs?.length || 0;
      const totalVotes = jogs?.reduce((acc, curr) => acc + (curr.total_votos || 0), 0) || 0;
      const averageStarsSum = jogs?.reduce((acc, curr) => acc + (curr.media_estrelas || 0), 0) || 0;
      const generalAvg = total > 0 ? (averageStarsSum / total) : 4.8;

      setStats({
        jogadores: total,
        torneios: tCount || 0,
        avaliacoes: totalVotes,
        mediaGeral: generalAvg
      });

      if (ranking?.length > 0) {
        setLider(ranking[0]);
      } else {
        setLider(null);
      }

      if (profile?.player_id) {
        // Obter jogador atual
        const { data: pInfo } = await supabase
          .from('jogadores')
          .select('*')
          .eq('id', profile.player_id)
          .maybeSingle();
        if (pInfo) {
          setMyPlayerInfo(pInfo);
        }

        // Calcular rank do usuario na cidade
        const { data: rankList } = await rankingAPI.get(cityVal, ufVal, 200);
        if (rankList) {
          const myIndex = rankList.findIndex(j => j.id === profile.player_id);
          if (myIndex !== -1) {
            setMyRank(`#${myIndex + 1}`);
          } else {
            setMyRank('--');
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  // Obter Badge com base na media de estrelas
  const getBadgeText = (media) => {
    if (media >= 4.5) return 'ELITE';
    if (media >= 4.0) return 'DESTAQUE';
    if (media >= 3.5) return 'PROMESSA';
    return 'EM DEV.';
  };

  const myStars = myPlayerInfo?.media_estrelas || 0;
  const myBadge = getBadgeText(myStars);


  const greetingName = profile?.apelido || profile?.nome_completo?.split(' ')[0] || 'Atleta';

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-content home-page">
      <div className="home-container">
        
        {/* Saudacao e Localizacao */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            Boa noite, <span style={{ color: '#2563EB' }}>{greetingName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 'clamp(11px, 2.5vw, 12px)', marginTop: 4 }}>
            Ranking de {city} - {uf}
          </div>
        </div>

        <div className="home-top-row">
          {/* Card: Sua Posicao */}
          <div className="card" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: 'clamp(14px, 3vw, 20px)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 'clamp(9px, 2vw, 10px)', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                SUA POSICAO
              </div>
              <div style={{ fontSize: 'clamp(28px, 8vw, 36px)', fontWeight: 900, color: '#F97316', lineHeight: 1, marginBottom: 4 }}>
                {myRank}
              </div>
              <div style={{ fontSize: 'clamp(10px, 2.5vw, 11px)', color: 'var(--text-secondary)', marginBottom: 10 }}>
                Entre {stats.jogadores} jogadores
              </div>
              <span style={{
                background: 'rgba(37, 99, 235, 0.15)',
                color: '#60A5FA',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: 'clamp(9px, 2vw, 10px)',
                fontWeight: 800,
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
              }}>
                {myBadge}
              </span>
            </div>

            {/* Grafico Linear e Avatar com Linha de Tendencia */}
            <div style={{ position: 'relative', width: 'clamp(80px, 20vw, 100px)', height: 'clamp(65px, 16vw, 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 }}>
              <svg width="100" height="60" viewBox="0 0 100 60" style={{ position: 'absolute', right: 0, bottom: 0, opacity: 0.75, width: '100%', height: 'auto' }}>
                <path d="M0,50 Q20,38 40,43 T80,18 T100,10" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="100" cy="10" r="3.5" fill="#F97316" />
              </svg>
              <div style={{ zIndex: 2, border: '3px solid #111827', borderRadius: '50%', overflow: 'hidden', width: 'clamp(52px, 14vw, 64px)', height: 'clamp(52px, 14vw, 64px)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                {profile?.foto_perfil ? (
                  <img src={profile.foto_perfil} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontWeight: 800, fontSize: 'clamp(16px, 4vw, 20px)' }}>
                    {greetingName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card: Estatisticas Gerais */}
          <div className="card" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: 'clamp(14px, 3vw, 20px)'
          }}>
            <div style={{ fontSize: 'clamp(9px, 2vw, 10px)', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14 }}>
              ESTATISTICAS GERAIS
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(10px, 2.5vw, 16px)' }}>
              <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', paddingRight: 8 }}>
                <div style={{ fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.jogadores}</div>
                <div style={{ fontSize: 'clamp(9px, 2vw, 10px)', color: 'var(--text-secondary)', marginTop: 2 }}>Jogadores</div>
              </div>
              <div style={{ paddingLeft: 8 }}>
                <div style={{ fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.torneios}</div>
                <div style={{ fontSize: 'clamp(9px, 2vw, 10px)', color: 'var(--text-secondary)', marginTop: 2 }}>Torneios</div>
              </div>
              <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', paddingRight: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.avaliacoes}</div>
                <div style={{ fontSize: 'clamp(9px, 2vw, 10px)', color: 'var(--text-secondary)', marginTop: 2 }}>Avaliacoes</div>
              </div>
              <div style={{ paddingLeft: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: 800, color: '#F97316' }}>{stats.mediaGeral.toFixed(1)}</div>
                <div style={{ fontSize: 'clamp(9px, 2vw, 10px)', color: 'var(--text-secondary)', marginTop: 2 }}>Media Geral</div>
              </div>
            </div>
          </div>
        </div>

        {/* Secao Destaques */}
        <div className="home-section">
          <div className="home-section-header">
            <div className="home-section-title">
              DESTAQUES
            </div>
            <button
              className="home-section-link"
              onClick={() => onNavigate('jogos', { aba: 'torneios' })}
            >
              Ver tudo
            </button>
          </div>

          <div className="destaques-row">
            <div className="home-highlight-card">
              <div className="home-highlight-icon" style={{ background: 'rgba(37, 99, 235, 0.08)' }}>
                <IconCrescimento size={24} color="#2563EB" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="home-highlight-label">Evolucao semanal</div>
                <div className="home-highlight-text" style={{ fontSize: 'clamp(12px, 3vw, 13px)' }}>
                  Voce subiu <span>3 posicoes</span> esta semana
                </div>
              </div>
            </div>

            <div className="home-highlight-card">
              <div className="home-highlight-icon" style={{ background: 'rgba(242, 138, 46, 0.08)' }}>
                <IconTrofeu size={24} color="#F28A2E" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="home-highlight-label">MVP da semana</div>
                <div className="home-highlight-text" style={{ fontSize: 'clamp(12px, 3vw, 13px)' }}>
                  <span>{lider ? lider.nome.split(' ')[0] : 'Joao Silva'}</span> {(lider?.media_estrelas || 4.9).toFixed(1)} estrelas
                </div>
              </div>
            </div>

            <div className="home-highlight-card">
              <div className="home-highlight-icon" style={{ background: 'rgba(37, 99, 235, 0.08)' }}>
                <IconCalendario size={24} color="#2563EB" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="home-highlight-label">Torneio municipal</div>
                <div className="home-highlight-text" style={{ fontSize: 'clamp(12px, 3vw, 13px)' }}>
                  <span>Inscricoes abertas</span> para novas equipes
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="home-section home-actions-section">
          <div className="home-section-title">
            ACOES RAPIDAS
          </div>

          <div className="acoes-rapidas-grid">
            <button
              className="quick-action-card quick-action-card-primary"
              onClick={() => onNavigate('jogadores')}
            >
              <div className="quick-action-icon" style={{ background: 'rgba(255, 255, 255, 0.16)' }}>
                <IconAvaliar size={24} color="#fff" />
              </div>
              <div className="quick-action-text">Avaliar jogador</div>
            </button>

            <button
              className="quick-action-card"
              onClick={() => onNavigate('jogos')}
            >
              <div className="quick-action-icon" style={{ background: 'rgba(242, 138, 46, 0.08)' }}>
                <IconBasquete size={24} color="#F28A2E" />
              </div>
              <div className="quick-action-text">Meus jogos</div>
            </button>

            <button
              className="quick-action-card"
              onClick={() => onNavigate('ranking')}
            >
              <div className="quick-action-icon" style={{ background: 'rgba(37, 99, 235, 0.08)' }}>
                <IconRanking size={24} color="#2563EB" />
              </div>
              <div className="quick-action-text">Ver ranking</div>
            </button>

            <button
              className="quick-action-card"
              onClick={() => onNavigate('jogos', { aba: 'torneios' })}
            >
              <div className="quick-action-icon" style={{ background: 'rgba(242, 138, 46, 0.08)' }}>
                <IconTrofeu size={24} color="#F28A2E" />
              </div>
              <div className="quick-action-text">Ver torneios</div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
