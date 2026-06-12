import { useState, useEffect, memo } from 'react';
import { supabase, jogadoresAPI, votacaoAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedCounter from '../components/AnimatedCounter';
import { RankingBackground, JogadoresBackground } from '../components/AnimatedBackgrounds';

const FILTROS = [
  { key: 'ranking', label: 'Ranking' },
  { key: 'todos', label: 'Todos' },
  { key: 'recentes', label: 'Recentes' },
  { key: 'elite', label: 'Elite' }
];

const labelsNota = ['', 'Muito Fraco', 'Fraco', 'Regular', 'Bom', 'Excelente'];

const getGradientForName = (name) => {
  const colors = [
    ['#FFB800', '#D97706'],
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

function PlayerAvatar({ fotoUrl, nome, size = 48, className = '' }) {
  const initial = nome ? nome.charAt(0).toUpperCase() : '?';

  const wrapperStyle = {
    position: 'relative',
    display: 'inline-block',
  };

  const imgStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1.5px solid rgba(200,241,53,0.3)',
  };

  const initialsStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: getGradientForName(nome),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0C0C14',
    fontWeight: 800,
    fontSize: size * 0.4,
    fontFamily: "'Barlow Condensed',sans-serif",
    border: '1.5px solid rgba(200,241,53,0.3)',
  };

  return (
    <div style={wrapperStyle}>
      {fotoUrl ? (
        <img src={fotoUrl} alt={nome} style={imgStyle} className={className} />
      ) : (
        <div style={initialsStyle} className={className}>{initial}</div>
      )}
    </div>
  );
}

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
          <svg width="26" height="26" viewBox="0 0 24 24" fill={(hover || value) >= i ? '#FFB800' : 'none'} stroke={(hover || value) >= i ? '#FFB800' : '#A1A1AA'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
});

export default function Atletas({ profile }) {
  const [jogadores, setJogadores] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('ranking');
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  const selectedCity = profile?.cidade_atual || profile?.cidade || 'Altamira';
  
  const fundamentos = [
    { key: 'arremesso', label: 'Arremesso' },
    { key: 'controle_de_bola', label: 'Controle de Bola' },
    { key: 'defesa', label: 'Defesa' },
    { key: 'visao_de_jogo', label: 'Visão de Jogo' },
    { key: 'explosao_fisica', label: 'Explosão Física' }
  ];

  const [votingPlayer, setVotingPlayer] = useState(null);
  const [estrelasVoto, setEstrelasVoto] = useState({ arremesso: 0, controle_de_bola: 0, defesa: 0, visao_de_jogo: 0, explosao_fisica: 0 });
  const [comentarioVoto, setComentarioVoto] = useState('');
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  const [votosStatus, setVotosStatus] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (profile) loadJogadores();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('atletas-global-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jogadores' }, () => loadJogadores())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avaliacoes' }, () => loadJogadores())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  async function loadJogadores() {
    setLoading(true);
    try {
      const stateUfVal = profile?.uf || 'PA';
      const userId = (await supabase.auth.getUser()).data.user?.id;

      const [{ data: jogs }, { data: votesStatus }, { data: minhasAvaliacoes }] = await Promise.all([
        jogadoresAPI.listarPorEstado(stateUfVal),
        votacaoAPI.getStatusHoje(),
        userId
          ? supabase.from('avaliacoes').select('jogador_id').eq('avaliador_id', userId)
          : Promise.resolve({ data: [] })
      ]);

      const avaliadosSet = new Set((minhasAvaliacoes || []).map(a => a.jogador_id));

      const players = (jogs || []).filter(j => j.cidade === selectedCity).map(j => ({
        ...j,
        ja_votou_hoje: avaliadosSet.has(j.id)
      }));

      setJogadores(players);
      setVotosStatus(votesStatus);
    } catch (e) {
      console.error('Erro ao carregar atletas:', e);
    }
    setLoading(false);
  }

  useEffect(() => {
    let result = [...jogadores];

    if (busca.trim() !== '') {
      result = result.filter(j =>
        j.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (j.apelido || '').toLowerCase().includes(busca.toLowerCase()) ||
        (j.posicao || '').toLowerCase().includes(busca.toLowerCase())
      );
    }

    if (filtroAtivo === 'elite') {
      result = result.filter(j => j.media_estrelas >= 4.0 && j.total_votos >= 1);
      result.sort((a, b) => b.media_estrelas - a.media_estrelas || b.total_votos - a.total_votos);
    } else if (filtroAtivo === 'ranking') {
      result = result.filter(j => j.total_votos >= 1);
      result.sort((a, b) => b.media_estrelas - a.media_estrelas || b.total_votos - a.total_votos);
    } else if (filtroAtivo === 'recentes') {
      result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } else {
      result.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    setFiltrados(result);
  }, [busca, jogadores, filtroAtivo]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function handleOpenVote(player, e) {
    e.stopPropagation();
    if (profile?.player_id === player.id) {
      showToast('Você não pode avaliar a si mesmo!', 'error');
      return;
    }
    if (votosStatus && votosStatus.restantes <= 0) {
      showToast('Você atingiu o limite de 20 avaliações por dia!', 'error');
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
        showToast(data?.erro || error?.message || 'Erro ao registrar avaliação.', 'error');
      } else {
        showToast(`✓ Avaliação computada! Nova média: ★ ${Number(data.media_estrelas).toFixed(1)}`, 'success');
        setVotingPlayer(null);
        loadJogadores();
      }
    } catch (err) {
      showToast('Erro de conexão ao salvar avaliação.', 'error');
    } finally {
      setEnviandoVoto(false);
    }
  }

  const getMedal = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)', position: 'relative' }}>
      {(filtroAtivo === 'ranking' || filtroAtivo === 'elite') ? <RankingBackground /> : <JogadoresBackground />}
      <div style={{ padding: '20px 16px 0', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em', margin: 0 }}>
            ATLETAS
          </h1>
          <p style={{ color: '#A1A1AA', fontSize: 13, fontFamily: "'Inter', sans-serif", marginTop: 2 }}>
            {selectedCity} • {jogadores.length} atletas
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Pesquisar atleta..."
            className="search-input"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 12px 12px 42px',
              fontSize: 15, color: 'var(--text-primary)', fontFamily: "'Inter',sans-serif",
              outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Segmented Control */}
        <div className="tabs" style={{
          display: 'flex', background: 'var(--bg-card)', borderRadius: 12, padding: 4, marginBottom: 20, border: '1px solid var(--border)'
        }}>
          {FILTROS.map(f => {
            const active = filtroAtivo === f.key;
            return (
              <button
                key={f.key}
                className={active ? "tab active" : "tab"}
                onClick={() => setFiltroAtivo(f.key)}
                style={{
                  position: 'relative',
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: 'none', background: 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 500, fontSize: 13, cursor: 'pointer',
                  fontFamily: "'Inter',sans-serif", transition: 'color 0.2s',
                  zIndex: 1
                }}
              >
                {active && (
                  <motion.div
                    layoutId="filterPill"
                    className="tab-indicator"
                    style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      background: 'var(--border)', borderRadius: 8, zIndex: -1
                    }}
                  />
                )}
                {f.label}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(idx => (
              <div key={idx} className="skeleton card" style={{ height: 110, borderRadius: 20 }} />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ width: 48, height: 48, marginBottom: 16, opacity: 0.5, margin: '0 auto' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 16, marginBottom: 8, fontFamily: "'Inter',sans-serif" }}>Nenhum atleta encontrado</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontFamily: "'Inter',sans-serif" }}>Tente ajustar os filtros ou a sua busca.</p>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {filtrados.map((j, i) => {
              const score = j.total_votos >= 1 ? Number(j.media_estrelas) : 0;
              const hasVoted = j.ja_votou_hoje;
              const isRankingFilter = filtroAtivo === 'ranking' || filtroAtivo === 'elite';
              const isFirst = isRankingFilter && i === 0;

              return (
                <motion.div
                  key={j.id}
                  variants={itemVariants}
                  className="card"
                  style={{
                    background: isFirst ? 'var(--bg-elevated)' : 'var(--bg-card)',
                    borderColor: isFirst ? 'var(--border-active)' : 'var(--border)',
                    borderTop: isFirst ? '2px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    boxShadow: isFirst ? '0 4px 20px rgba(200,241,53,0.15)' : 'none',
                    position: 'relative'
                  }}
                >
                  {isRankingFilter && (
                    <div style={{
                      position: 'absolute', top: -10, right: 16,
                      background: isFirst ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: isFirst ? '#000000' : 'var(--text-primary)',
                      padding: '4px 10px', borderRadius: 12,
                      fontSize: 14, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif",
                      boxShadow: '0 2px 4px rgba(0,0,0,0.5)', zIndex: 1
                    }}>
                      {getMedal(i)}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <PlayerAvatar fotoUrl={j.foto_url} nome={j.nome} size={48} className={isFirst ? 'avatar-pulse' : ''} />
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {j.nome}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 400, fontFamily: "'Inter',sans-serif" }}>{j.posicao || 'Ala'}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>•</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 400, fontFamily: "'Inter',sans-serif" }}>{j.cidade}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: "'Barlow Condensed',sans-serif", marginTop: 4 }}>
                        <span>★</span>
                        <span>{j.total_votos >= 1 ? <AnimatedCounter value={score} /> : '--'}</span>
                      </div>
                      <div style={{ width: 80, height: 4, background: 'var(--bg-secondary)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      className="btn-primary"
                      onClick={() => setSelectedPlayer(j)}
                      style={{ flex: 1, padding: '10px 0', fontSize: 13, borderRadius: 10 }}
                    >
                      Perfil
                    </button>
                    {!hasVoted && profile?.player_id !== j.id ? (
                      <button
                        className="btn-secondary"
                        onClick={(e) => handleOpenVote(j, e)}
                        style={{ flex: 1, padding: '10px 0', fontSize: 13, borderRadius: 10 }}
                      >
                        Avaliar
                      </button>
                    ) : (
                      <button
                        disabled
                        style={{
                          flex: 1, background: 'var(--bg-secondary)', border: 'none', borderRadius: 10,
                          padding: '10px 0', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                          fontFamily: "'Inter',sans-serif", cursor: 'not-allowed'
                        }}
                      >
                        {profile?.player_id === j.id ? 'Seu Perfil' : '✓ Avaliado'}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {votingPlayer && (
        <div className="modal-overlay" onClick={() => { if (!enviandoVoto) setVotingPlayer(null); }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-elevated)' }}>
            <div className="modal-handle" style={{ background: 'var(--border)' }} />
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: 18, marginBottom: 2, textAlign: 'center' }}>
              Avaliar {votingPlayer.apelido || votingPlayer.nome}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
              Dê uma nota de 1 a 5 estrelas para cada habilidade:
            </p>

            <form onSubmit={handleSubmitVote} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fundamentos.map((f, i) => {
                const val = estrelasVoto[f.key] || 0;
                return (
                  <div key={f.key} style={{
                    background: val > 0 ? 'rgba(255,184,0,0.1)' : 'var(--bg-card)',
                    padding: '8px 12px', borderRadius: 12,
                    border: val > 0 ? '1px solid rgba(255,184,0,0.3)' : '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: 6,
                          background: val > 0 ? 'var(--accent)' : 'var(--bg-secondary)',
                          color: val > 0 ? '#000' : 'var(--text-muted)', fontSize: 11, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{f.label}</span>
                      </div>
                      <span style={{ fontSize: 12, color: val > 0 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700 }}>
                        {val > 0 ? `\u2605 ${val}.0` : labelsNota[val] || 'Nota'}
                      </span>
                    </div>
                    <StarPicker value={val} onChange={v => setEstrelasVoto(p => ({ ...p, [f.key]: v }))} disabled={enviandoVoto} />
                  </div>
                );
              })}

              <div style={{ marginTop: 6 }}>
                <input
                  type="text" maxLength="200"
                  value={comentarioVoto}
                  onChange={e => setComentarioVoto(e.target.value)}
                  placeholder="Comentário (opcional)"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: 13, borderRadius: 12, border: '1px solid #27272A', background: '#18181B', color: '#FFF' }}
                  disabled={enviandoVoto}
                />
              </div>

              {votosStatus && (
                <div style={{ textAlign: 'center', fontSize: 11, color: '#71717A', margin: '4px 0' }}>
                  Avaliações hoje: <strong>{votosStatus.votos_hoje}/20</strong>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setVotingPlayer(null)} disabled={enviandoVoto} style={{ flex: 1, padding: '12px 0', background: 'transparent', border: '1px solid #3F3F46', color: '#FFF', borderRadius: 12, fontWeight: 600 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={enviandoVoto || fundamentos.some(f => !estrelasVoto[f.key])} style={{ flex: 2, padding: '12px 0', background: '#FFB800', border: 'none', color: '#000', borderRadius: 12, fontWeight: 700, opacity: (enviandoVoto || fundamentos.some(f => !estrelasVoto[f.key])) ? 0.5 : 1 }}>
                  {enviandoVoto ? 'Enviando...' : 'Confirmar Avaliação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <PlayerProfileModal
          jogador={selectedPlayer}
          rank={selectedPlayer.rank}
          onClose={() => { setSelectedPlayer(null); loadJogadores(); }}
        />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`toast ${toast.type}`} 
            style={{ zIndex: 9999 }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
