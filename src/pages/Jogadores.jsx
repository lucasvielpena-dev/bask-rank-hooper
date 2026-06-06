import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';

function renderBadge(media, totalVotos) {
  if (!totalVotos || totalVotos < 1) return null;
  if (media >= 4.5) return <span className="badge-elite" style={{ marginLeft: 6 }}>🏆 Elite</span>;
  if (media >= 4.0) return <span className="badge-destaque" style={{ marginLeft: 6 }}>⭐ Destaque</span>;
  if (media >= 3.5) return <span className="badge-promessa" style={{ marginLeft: 6 }}>📈 Promessa</span>;
  return <span className="badge-desenvolvimento" style={{ marginLeft: 6 }}>🔄 Em Des.</span>;
}

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

export default function Jogadores({ profile }) {
  const [jogadores, setJogadores] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    loadJogadores();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('jogadores-global-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jogadores' },
        () => {
          loadJogadores();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  useEffect(() => {
    if (busca.trim() === '') {
      setFiltrados(jogadores);
    } else {
      setFiltrados(jogadores.filter(j =>
        j.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (j.apelido || '').toLowerCase().includes(busca.toLowerCase())
      ));
    }
  }, [busca, jogadores]);

  async function loadJogadores() {
    setLoading(true);
    const { data } = await jogadoresAPI.listar();
    setJogadores(data || []);
    setFiltrados(data || []);
    setLoading(false);
  }


  return (
    <div className="page-content">
      <div style={{ padding: '20px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 20 }}>Jogadores</h2>
              <p style={{ color: '#64748b', fontSize: 13 }}>{jogadores.length} cadastrados</p>
            </div>
          </div>
        </div>


        {/* Busca */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar jogador..."
            style={{ paddingLeft: 40 }}
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 20 }}>
            {[1, 2, 3, 4, 5].map(idx => (
              <div key={idx} className="skeleton" style={{ height: 72, borderRadius: '16px' }} />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <h3>Nenhum jogador encontrado</h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 20 }}>
            {filtrados.map((j, i) => (
              <div key={j.id} className="card card-enter" onClick={() => setSelectedPlayer(j)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', animationDelay: `${i * 30}ms` }}>
                <PlayerAvatar fotoUrl={j.foto_url} nome={j.nome} size={40} hasCrown={j.atual_campeao} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {j.nome}
                    {renderBadge(j.media_estrelas, j.total_votos)}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {j.apelido && <span style={{ marginRight: 8 }}>"{j.apelido}"</span>}
                    {j.posicao && <span>{j.posicao}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {j.total_votos >= 1 ? (
                    <>
                      <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 14 }}>★ {Number(j.media_estrelas).toFixed(1)}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{j.total_votos} av.</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: '#475569' }}>
                      {j.total_votos}/1 av.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
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
