import { useState, useEffect, memo } from 'react';
import { supabase, jogadoresAPI, votacaoAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'avaliados', label: 'Mais Avaliados' },
  { key: 'votados', label: 'Mais Votados' },
  { key: 'elite', label: 'Elite' },
  { key: 'promessa', label: 'Promessa' },
  { key: 'mvp', label: 'MVP' }
];

const labelsNota = ['', 'Muito Fraco', 'Fraco', 'Regular', 'Bom', 'Excelente'];

const positionColors = {
  'Ala': ['#3B82F6', '#1D4ED8'],
  'Armador': ['#8B5CF6', '#6D28D9'],
  'Piv\u00f4': ['#10B981', '#047857'],
  'Ala-Piv\u00f4': ['#06B6D4', '#0891B2'],
  'Armador-Ala': ['#EC4899', '#BE185D'],
};

function PlayerAvatar({ fotoUrl, nome, posicao, size = 44, isFirst = false }) {
  const initial = nome ? nome.charAt(0).toUpperCase() : '?';

  const getGradient = () => {
    const pos = positionColors[posicao] || positionColors['Ala'];
    return `linear-gradient(135deg, ${pos[0]} 0%, ${pos[1]} 100%)`;
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
    border: isFirst ? '2px solid transparent' : '1.5px solid rgba(255,255,255,0.12)',
    boxShadow: isFirst ? '0 0 0 2px rgba(200,241,53,0.3)' : 'none',
  };

  const initialsStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: getGradient(),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: size * 0.38,
    fontFamily: "'Barlow Condensed',sans-serif",
    border: isFirst ? '2px solid transparent' : '1.5px solid rgba(255,255,255,0.12)',
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
}

const ScoreBar = ({ value, max = 5.0 }) => {
  const pct = Math.min((value / max) * 100, 100);
  let color = '#64748B';
  if (value >= 3.0) color = '#C8F135';
  else if (value >= 2.0) color = '#EAB308';
  return (
    <div style={{ width: 80, height: 4, borderRadius: 2, background: 'var(--border)', marginTop: 4, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.5s ease' }} />
    </div>
  );
};

const StarPicker = memo(function StarPicker({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '4px 0' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => !disabled && onChange(i)}
          onMouseEnter={() => !disabled && setHover(i)}
          onMouseLeave={() => !disabled && setHover(0)}
          disabled={disabled}
          style={{
            background: 'none', border: 'none',
            cursor: disabled ? 'default' : 'pointer', padding: '2px',
            transition: 'transform 0.1s',
            transform: (hover || value) >= i ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill={(hover || value) >= i ? 'var(--accent)' : 'none'} stroke={(hover || value) >= i ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
});

export default function Jogadores({ profile }) {
  const [jogadores, setJogadores] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedCity] = useState(profile?.cidade_atual || profile?.cidade || 'Altamira');

  const [ranks, setRanks] = useState({});
  const [mvpPlayerIds, setMvpPlayerIds] = useState(new Set());

  const fundamentos = [
    { key: 'arremesso', label: 'Arremesso' },
    { key: 'controle_de_bola', label: 'Controle de Bola' },
    { key: 'defesa', label: 'Defesa' },
    { key: 'visao_de_jogo', label: 'Vis\u00e3o de Jogo' },
    { key: 'explosao_fisica', label: 'Explos\u00e3o F\u00edsica' }
  ];

  const [votingPlayer, setVotingPlayer] = useState(null);
  const [estrelasVoto, setEstrelasVoto] = useState({ arremesso: 0, controle_de_bola: 0, defesa: 0, visao_de_jogo: 0, explosao_fisica: 0 });
  const [comentarioVoto, setComentarioVoto] = useState('');
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  const [votosStatus, setVotosStatus] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (profile) {
      loadJogadores();
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('jogadores-global-realtime-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jogadores' }, () => loadJogadores())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avaliacoes' }, () => loadJogadores())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  useEffect(() => {
    let result = [...jogadores];

    if (busca.trim() !== '') {
      result = result.filter(j =>
        j.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (j.apelido || '').toLowerCase().includes(busca.toLowerCase()) ||
        (j.posicao || '').toLowerCase().includes(busca.toLowerCase())
      );
    }

    if (selectedCity !== 'todos') {
      result = result.filter(j => j.cidade === selectedCity);
    }

    if (filtroAtivo === 'elite') {
      result = result.filter(j => j.media_estrelas >= 4.5 && j.total_votos >= 1);
    } else if (filtroAtivo === 'promessa') {
      result = result.filter(j => j.media_estrelas >= 3.5 && j.media_estrelas < 4.5 && j.total_votos >= 1);
    } else if (filtroAtivo === 'mvp') {
      result = result.filter(j => j.atual_campeao || mvpPlayerIds.has(j.id));
    }

    if (filtroAtivo === 'votados') {
      result.sort((a, b) => b.total_votos - a.total_votos || b.media_estrelas - a.media_estrelas);
    } else {
      result.sort((a, b) => b.media_estrelas - a.media_estrelas || b.total_votos - a.total_votos);
    }

    setFiltrados(result);
  }, [busca, jogadores, filtroAtivo, selectedCity, mvpPlayerIds]);

  async function loadJogadores() {
    setLoading(true);
    try {
      const stateUfVal = profile?.uf || 'PA';
      const userId = (await supabase.auth.getUser()).data.user?.id;

      const [{ data: jogs }, { data: partidasData }, { data: votesStatus }, { data: minhasAvaliacoes }] = await Promise.all([
        jogadoresAPI.listarPorEstado(stateUfVal),
        supabase.from('partidas').select('mvp_id'),
        votacaoAPI.getStatusHoje(),
        userId
          ? supabase.from('avaliacoes').select('jogador_id').eq('avaliador_id', userId)
          : Promise.resolve({ data: [] })
      ]);

      const avaliadosSet = new Set((minhasAvaliacoes || []).map(a => a.jogador_id));

      const players = (jogs || []).map(j => ({
        ...j,
        ja_votou_hoje: avaliadosSet.has(j.id)
      }));

      setJogadores(players);
      setVotosStatus(votesStatus);

      const playerRanks = {};
      const playersByCity = {};
      players.forEach(j => {
        const cityKey = j.cidade || 'Altamira';
        if (!playersByCity[cityKey]) playersByCity[cityKey] = [];
        playersByCity[cityKey].push(j);
      });
      Object.keys(playersByCity).forEach(cityKey => {
        const sorted = [...playersByCity[cityKey]].sort((a, b) => b.media_estrelas - a.media_estrelas || b.total_votos - a.total_votos);
        sorted.forEach((j, index) => {
          playerRanks[j.id] = index + 1;
        });
      });
      setRanks(playerRanks);

      const mvps = new Set(partidasData?.map(p => p.mvp_id).filter(Boolean) || []);
      setMvpPlayerIds(mvps);
    } catch (e) {
      console.error('Erro ao carregar atletas:', e);
    }
    setLoading(false);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function handleOpenVote(player, e) {
    e.stopPropagation();
    if (profile?.player_id === player.id) {
      showToast('Voc\u00ea n\u00e3o pode avaliar a si mesmo!', 'error');
      return;
    }
    if (votosStatus && votosStatus.restantes <= 0) {
      showToast('Voc\u00ea atingiu o limite de 20 avalia\u00e7\u00f5es por dia!', 'error');
      return;
    }
    setVotingPlayer(player);
    setEstrelasVoto({ arremesso: 0, controle_de_bola: 0, defesa: 0, visao_de_jogo: 0, explosao_fisica: 0 });
    setComentarioVoto('');
  }

  async function handleSubmitVote(e) {
    e.preventDefault();
    const faltando = fundamentos.some(f => !estrelasVoto[f.key]);
    if (faltando) {
      showToast('Selecione uma nota para todos os 5 fundamentos', 'error');
      return;
    }
    setEnviandoVoto(true);
    try {
      const { data, error } = await votacaoAPI.votar(votingPlayer.id, {
        ...estrelasVoto,
        comentario: comentarioVoto.trim() || null
      });
      if (error || !data?.sucesso) {
        showToast(data?.erro || error?.message || 'Erro ao registrar avalia\u00e7\u00e3o.', 'error');
      } else {
        showToast(`\u2713 Avalia\u00e7\u00e3o computada! Nova m\u00e9dia: \u2605 ${Number(data.media_estrelas).toFixed(1)}`, 'success');
        setVotingPlayer(null);
        loadJogadores();
      }
    } catch (err) {
      showToast('Erro de conex\u00e3o ao salvar avalia\u00e7\u00e3o.', 'error');
    } finally {
      setEnviandoVoto(false);
    }
  }

  return (
    <div className="page-content" style={{ position: 'relative' }}>
      <div style={{ padding: '16px 16px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{
              fontWeight: 800, fontSize: 22, color: 'var(--text-primary)',
              fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase',
              letterSpacing: '0.04em', lineHeight: 1,
            }}>
              Jogadores
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 3, fontFamily: "'Inter',sans-serif", fontWeight: 400 }}>
              <span style={{ color: '#22C55E', fontSize: 8, marginRight: 4 }}>&#9679;</span>
              {filtrados.length} atletas em {selectedCity} - {profile?.uf || 'PA'}
            </p>
          </div>
          <button style={{
            width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--bg-card)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', fontSize: 16,
          }}>
            &#8693;
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou posi\u00e7\u00e3o..."
            style={{
              paddingLeft: 40, width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 14px 12px 40px',
              fontSize: 14, color: '#F8FAFC', fontFamily: "'Inter',sans-serif",
              outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(200,241,53,0.5)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16,
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }} className="hide-scrollbar">
          {FILTROS.map(f => {
            const active = filtroAtivo === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFiltroAtivo(f.key)}
                style={{
                  flexShrink: 0, padding: '8px 16px', borderRadius: 20,
                  border: active ? 'none' : '1px solid #333',
                  background: active ? '#C8F135' : 'transparent',
                  color: active ? '#FFFFFF' : '#8A8A9A',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  fontFamily: "'Inter',sans-serif", transition: 'all 0.2s',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="skeleton" style={{ height: 72, borderRadius: 14 }} />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <h3>Nenhum jogador encontrado</h3>
            <p>Selecione outro filtro ou altere sua busca.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtrados.map((j, i) => {
              const rankVal = ranks[j.id] || 0;
              const hasVoted = j.ja_votou_hoje;
              const score = j.total_votos >= 1 ? Number(j.media_estrelas) : 0;
              const isFirst = rankVal === 1;

              return (
                <div
                  key={j.id}
                  onClick={() => setSelectedPlayer({ ...j, rank: rankVal })}
                  style={{
                    background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 14, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer', transition: 'transform 0.15s',
                    animationDelay: `${i * 20}ms`,
                  }}
                >
                  <PlayerAvatar
                    fotoUrl={j.foto_url}
                    nome={j.nome}
                    posicao={j.posicao}
                    size={44}
                    isFirst={isFirst}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' }}>
                      <span style={{
                        fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                        fontFamily: "'Inter',sans-serif",
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {j.nome}
                      </span>
                      {j.apelido && (
                        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 400, flexShrink: 0 }}>
                          "{j.apelido}"
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', fontFamily: "'Inter',sans-serif", fontWeight: 400, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {rankVal > 0 && (
                        <span style={{ fontWeight: 700, color: isFirst ? '#C8F135' : '#8A8A9A', fontSize: 12 }}>
                          #{rankVal}
                        </span>
                      )}
                      <span>{j.posicao || 'Ala'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{
                        fontSize: 18, fontWeight: 800, color: 'var(--text-primary)',
                        fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1,
                      }}>
                        {j.total_votos >= 1 ? score.toFixed(1) : 'S/N'}
                      </span>
                       <span style={{ color: '#C8F135', fontSize: 12 }}>&#9733;</span>
                    </div>
                    {j.total_votos >= 1 && <ScoreBar value={score} />}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>
                      {j.total_votos} {j.total_votos === 1 ? 'voto' : 'votos'}
                    </div>
                    {hasVoted && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif", fontWeight: 500 }}>
                        &#10003; avaliado
                      </div>
                    )}
                  </div>

                  {!hasVoted && profile?.player_id !== j.id && (
                    <button
                      onClick={(e) => handleOpenVote(j, e)}
                      style={{
                        width: 40, height: 28, borderRadius: 8,
                        background: '#C8F135', border: 'none',
                        color: '#0C0C14', fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                        flexShrink: 0, display: 'flex', alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Avaliar
                    </button>
                  )}
                </div>
              );
            })}

            <div style={{
              padding: '20px 0 40px', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: 12, fontFamily: "'Inter',sans-serif",
            }}>
              Mais jogadores em breve
            </div>
          </div>
        )}
      </div>

      {/* Voting Modal */}
      {votingPlayer && (
        <div className="modal-overlay" onClick={() => { if (!enviandoVoto) setVotingPlayer(null); }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 900, fontSize: 18, marginBottom: 2, textAlign: 'center' }}>
              Avaliar {votingPlayer.apelido || votingPlayer.nome}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 14, textAlign: 'center' }}>
              D\u00ea uma nota de 1 a 5 estrelas para cada habilidade:
            </p>

            <form onSubmit={handleSubmitVote} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fundamentos.map((f, i) => {
                const val = estrelasVoto[f.key] || 0;
                return (
                  <div key={f.key} style={{
                    background: val > 0 ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                    padding: '8px 12px', borderRadius: 10,
                    border: val > 0 ? '1.5px solid var(--border)' : '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 5,
                          background: val > 0 ? 'var(--accent)' : 'var(--bg-secondary)',
                          color: val > 0 ? '#fff' : 'var(--text-muted)', fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: val > 0 ? 'none' : '1px solid var(--border)',
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{f.label}</span>
                      </div>
                      <span style={{ fontSize: 11, color: val > 0 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700 }}>
                        {val > 0 ? `\u2605 ${val}.0` : labelsNota[val] || 'Nota'}
                      </span>
                    </div>
                    <StarPicker value={val} onChange={v => setEstrelasVoto(p => ({ ...p, [f.key]: v }))} disabled={enviandoVoto} />
                  </div>
                );
              })}

              <div style={{ marginTop: 2 }}>
                <input
                  type="text" maxLength="200"
                  value={comentarioVoto}
                  onChange={e => setComentarioVoto(e.target.value)}
                  placeholder="Coment\u00e1rio (opcional)"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  disabled={enviandoVoto}
                />
              </div>

              {votosStatus && (
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
                  Avalia\u00e7\u00f5es hoje: <strong>{votosStatus.votos_hoje}/20</strong>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setVotingPlayer(null)} disabled={enviandoVoto} style={{ flex: 1, padding: '10px 0' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={enviandoVoto || fundamentos.some(f => !estrelasVoto[f.key])} style={{ flex: 2, padding: '10px 0' }}>
                  {enviandoVoto ? <div className="spinner" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <PlayerProfileModal
          jogador={selectedPlayer}
          onClose={() => { setSelectedPlayer(null); loadJogadores(); }}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
