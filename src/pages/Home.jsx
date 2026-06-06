import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI, rankingAPI } from '../lib/supabase';

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

        // Calcular rank do usuário na cidade
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

  // Obter Badge com base na média de estrelas
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
    <div className="page-content" style={{ background: '#080F1A' }}>
      <div style={{ padding: '20px 20px 0' }}>
        
        {/* Saudação e Localização */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC' }}>
            Boa noite, <span style={{ color: '#2563EB' }}>{greetingName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: '12px', marginTop: 4 }}>
            Ranking de {city} - {uf}
          </div>
        </div>

        {/* Card: Sua Posição */}
        <div className="card" style={{
          background: '#111827',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              SUA POSIÇÃO
            </div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#F97316', lineHeight: 1, marginBottom: 4 }}>
              {myRank}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: 12 }}>
              Entre {stats.jogadores} jogadores
            </div>
            <span style={{
              background: 'rgba(37, 99, 235, 0.15)',
              color: '#60A5FA',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.02em',
              textTransform: 'uppercase'
            }}>
              {myBadge}
            </span>
          </div>

          {/* Gráfico Linear e Avatar com Linha de Tendência */}
          <div style={{ position: 'relative', width: '100px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="100" height="60" viewBox="0 0 100 60" style={{ position: 'absolute', right: 0, bottom: 0, opacity: 0.75 }}>
              <path d="M0,50 Q20,38 40,43 T80,18 T100,10" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="100" cy="10" r="3.5" fill="#F97316" />
            </svg>
            <div style={{ zIndex: 2, border: '3px solid #111827', borderRadius: '50%', overflow: 'hidden', width: '64px', height: '64px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              {profile?.foto_perfil ? (
                <img src={profile.foto_perfil} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontWeight: 800, fontSize: '20px' }}>
                  {greetingName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Seção Destaques */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              DESTAQUES
            </div>
            <button 
              onClick={() => onNavigate('jogos', { aba: 'torneios' })}
              style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              Ver tudo
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
            {/* Card 1: Posição Semanal */}
            <div className="card" style={{
              background: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '16px',
              minWidth: '135px',
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '110px'
            }}>
              <div style={{ fontSize: '20px', color: '#F97316' }}>📈</div>
              <div style={{ fontSize: '11px', color: '#F8FAFC', fontWeight: 500, lineHeight: 1.4, marginTop: 10 }}>
                Você subiu <span style={{ color: '#F97316', fontWeight: 700 }}>3 posições</span> esta semana
              </div>
            </div>

            {/* Card 2: MVP da Semana */}
            <div className="card" style={{
              background: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '16px',
              minWidth: '135px',
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '110px'
            }}>
              <div style={{ fontSize: '20px', color: '#F97316' }}>🏆</div>
              <div style={{ fontSize: '11px', color: '#F8FAFC', fontWeight: 500, lineHeight: 1.4, marginTop: 10 }}>
                <span style={{ color: '#F97316', fontWeight: 700 }}>MVP</span> da semana<br />
                {lider ? lider.nome.split(' ')[0] : 'João Silva'} {(lider?.media_estrelas || 4.9).toFixed(1)} ★
              </div>
            </div>

            {/* Card 3: Torneio Municipal */}
            <div className="card" style={{
              background: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '16px',
              minWidth: '135px',
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '110px'
            }}>
              <div style={{ fontSize: '20px', color: '#F97316' }}>📅</div>
              <div style={{ fontSize: '11px', color: '#F8FAFC', fontWeight: 500, lineHeight: 1.4, marginTop: 10 }}>
                Torneio Municipal<br />
                <span style={{ color: '#94A3B8' }}>Inscrições abertas</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Estatísticas Gerais */}
        <div className="card" style={{
          background: '#111827',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: 20
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
            ESTATÍSTICAS GERAIS
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', paddingRight: 8 }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#F8FAFC' }}>{stats.jogadores}</div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: 2 }}>Jogadores</div>
            </div>
            <div style={{ paddingLeft: 8 }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#F8FAFC' }}>{stats.torneios}</div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: 2 }}>Torneios</div>
            </div>
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', paddingRight: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#F8FAFC' }}>{stats.avaliacoes}</div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: 2 }}>Avaliações</div>
            </div>
            <div style={{ paddingLeft: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#F97316' }}>{stats.mediaGeral.toFixed(1)}</div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: 2 }}>Média Geral</div>
            </div>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
            AÇÕES RÁPIDAS
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Avaliar Jogador */}
            <button 
              onClick={() => onNavigate('jogadores')}
              style={{
                background: '#2563EB',
                border: 'none',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '20px', color: '#FFF', marginBottom: 12 }}>★</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFF' }}>Avaliar<br />jogador</div>
            </button>

            {/* Meus Jogos */}
            <button 
              onClick={() => onNavigate('jogos')}
              style={{
                background: '#1A233D',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '20px', color: '#60A5FA', marginBottom: 12 }}>🏀</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC' }}>Meus<br />jogos</div>
            </button>

            {/* Ranking */}
            <button 
              onClick={() => onNavigate('ranking')}
              style={{
                background: '#1A233D',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '20px', color: '#60A5FA', marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC' }}>Ver<br />Ranking</div>
            </button>

            {/* Torneios */}
            <button 
              onClick={() => onNavigate('jogos', { aba: 'torneios' })}
              style={{
                background: '#1A233D',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '20px', color: '#60A5FA', marginBottom: 12 }}>🏆</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC' }}>Ver<br />Torneios</div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
