import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';

function renderBadge(media, totalVotos) {
  if (!totalVotos || totalVotos < 10) return null;
  if (media >= 4.5) return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>🏆 Elite</span>;
  if (media >= 4.0) return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>⭐ Destaque</span>;
  if (media >= 3.5) return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>📈 Promessa</span>;
  return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(148,163,184,0.15)', color: '#94a3b8', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>🔄 Em Des.</span>;
}

export default function Jogadores({ profile }) {
  const [jogadores, setJogadores] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';

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

  const getInitial = (nome) => nome ? nome.charAt(0).toUpperCase() : '?';


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
          <div className="loading"><div className="spinner" />Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <h3>Nenhum jogador encontrado</h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 20 }}>
            {filtrados.map(j => (
              <div key={j.id} className="card" onClick={() => setSelectedPlayer(j)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div className="avatar" style={{ position: 'relative' }}>
                  {getInitial(j.nome)}
                  {j.atual_campeao && (
                    <div style={{ position: 'absolute', top: -6, right: -6, fontSize: 14 }}>👑</div>
                  )}
                </div>
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
                  {j.total_votos >= 10 ? (
                    <>
                      <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 14 }}>★ {Number(j.media_estrelas).toFixed(1)}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{j.total_votos} av.</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: '#475569' }}>
                      {j.total_votos}/10 av.
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
