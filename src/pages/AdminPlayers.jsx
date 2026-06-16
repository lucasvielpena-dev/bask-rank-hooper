import { useState, useEffect } from 'react';
import { masterAPI } from '../lib/supabase';
import { IconVoltar, IconBuscar, IconBasquete } from '../components/Icons';
import { useEsporte } from '../contexts/EsporteContext';

export default function AdminPlayers({ profile, onNavigate }) {
  const { esporte } = useEsporte();
  const [players, setPlayers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSport, setFilterSport] = useState(esporte);

  const isMaster = profile?.role === 'master';

  useEffect(() => {
    if (isMaster) loadPlayers();
  }, [isMaster]);

  useEffect(() => {
    setFilterSport(esporte);
  }, [esporte]);

  useEffect(() => {
    let result = [...players];

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(p =>
        (p.nome || '').toLowerCase().includes(term) ||
        (p.apelido || '').toLowerCase().includes(term) ||
        (p.cidade || '').toLowerCase().includes(term) ||
        (p.posicao || '').toLowerCase().includes(term)
      );
    }

    if (filterStatus === 'active') {
      result = result.filter(p => p.ativo);
    } else if (filterStatus === 'suspended') {
      result = result.filter(p => !p.ativo);
    }

    if (filterSport === 'basquete') {
      result = result.filter(p => (p.esporte || 'basquete') === 'basquete');
    } else if (filterSport === 'handebol') {
      result = result.filter(p => p.esporte === 'handebol');
    }

    setFiltered(result);
  }, [search, players, filterStatus, filterSport]);

  async function loadPlayers() {
    setLoading(true);
    try {
      const { data, error } = await masterAPI.getPlayers();
      if (error) throw error;
      setPlayers(data || []);
    } catch (e) {
      console.error(e);
      showToast('Erro ao carregar jogadores.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePlayer(player) {
    if (togglingId) return;
    setTogglingId(player.id);
    try {
      const newActive = !player.ativo;
      const { error } = await masterAPI.togglePlayer(player.id, newActive);
      if (error) throw error;
      setPlayers(prev =>
        prev.map(p => p.id === player.id ? { ...p, ativo: newActive } : p)
      );
      showToast(newActive ? 'Jogador ativado.' : 'Jogador suspenso.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Erro ao alterar status do jogador.', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function renderStars(rating) {
    const stars = [];
    const rounded = Math.round(rating || 0);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <svg key={i} width="14" height="14" viewBox="0 0 24 24"
          fill={i <= rounded ? 'var(--accent)' : 'none'}
          stroke={i <= rounded ? 'var(--accent)' : 'var(--text-muted)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    }
    return stars;
  }

  if (!isMaster) {
    return (
      <div className="page-content" style={{ background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, opacity: 0.6, margin: '0 auto 14px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={{ fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            Acesso negado
          </h2>
          <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: 'clamp(14px, 4vw, 20px) clamp(12px, 3vw, 20px) 0', maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => onNavigate('master')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              fontFamily: 'inherit'
            }}
          >
            <IconVoltar size={20} color="var(--text-primary)" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontSize: 'clamp(18px, 4.5vw, 24px)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em'
            }}>
              Gerenciar Jogadores
            </h1>
            <p style={{ fontSize: 'clamp(11px, 2.5vw, 13px)', color: 'var(--text-secondary)' }}>
              {filtered.length} jogador(es) encontrado(s)
            </p>
          </div>
        </div>

        {/* Busca */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
            <IconBuscar size={16} color="var(--text-muted)" />
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, apelido, cidade ou posição..."
            style={{ paddingLeft: 40, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Filtros de Esporte */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }} className="hide-scrollbar">
          {[
            { key: 'all', label: 'Todos os Esportes' },
            { key: 'basquete', label: 'Basquete 🏀' },
            { key: 'handebol', label: 'Handebol 🤾' }
          ].map(f => {
            const active = filterSport === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilterSport(f.key)}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  borderRadius: '30px',
                  border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                  background: active ? 'var(--accent-dim)' : 'var(--bg-card)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease'
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Filtros de Status */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', scrollbarWidth: 'none' }} className="hide-scrollbar">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'active', label: 'Ativos' },
            { key: 'suspended', label: 'Suspensos' }
          ].map(f => {
            const active = filterStatus === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                style={{
                  flexShrink: 0,
                  padding: '8px 16px',
                  borderRadius: '30px',
                  border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                  background: active ? 'var(--accent-dim)' : 'var(--bg-card)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease'
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Lista de Jogadores */}
        {filtered.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(30px, 8vw, 60px) 24px',
            textAlign: 'center'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              opacity: 0.6
            }}>
              <IconBasquete size={26} color="var(--accent)" />
            </div>
            <h3 style={{
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 6
            }}>
              Nenhum jogador encontrado
            </h3>
            <p style={{
              fontSize: 'clamp(11px, 2.5vw, 13px)',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              maxWidth: 280
            }}>
              Tente alterar os filtros ou a busca.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 30 }}>
            {filtered.map((player, i) => (
              <div
                key={player.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'clamp(12px, 2vw, 16px)',
                  padding: 'clamp(12px, 3vw, 16px)',
                  opacity: togglingId === player.id ? 0.6 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                {/* Linha Principal */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Avatar */}
                  {player.foto_url ? (
                    <img
                      src={player.foto_url}
                      alt={player.nome}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 18,
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                      {(player.nome || '?').charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontWeight: 800,
                        fontSize: 15,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {player.nome}
                      </span>
                      {player.apelido && (
                        <span style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--text-muted)'
                        }}>
                          "{player.apelido}"
                        </span>
                      )}
                      {/* Badge de Status */}
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: player.ativo ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: player.ativo ? '#22c55e' : '#ef4444',
                        letterSpacing: '0.03em'
                      }}>
                        {player.ativo ? 'ATIVO' : 'SUSPENSO'}
                      </span>
                      {/* Badge de Esporte */}
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: (player.esporte || 'basquete') === 'handebol' ? 'rgba(59,130,246,0.15)' : 'rgba(249,115,22,0.15)',
                        color: (player.esporte || 'basquete') === 'handebol' ? '#3b82f6' : '#f97316',
                        letterSpacing: '0.03em'
                      }}>
                        {(player.esporte || 'basquete').toUpperCase()}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 3,
                      flexWrap: 'wrap'
                    }}>
                      <span>{player.posicao || 'Ala'}</span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span>{player.cidade || '—'}{player.uf ? ` - ${player.uf}` : ''}</span>
                    </div>
                  </div>

                  {/* Toggle de Status */}
                  <button
                    onClick={() => handleTogglePlayer(player)}
                    disabled={togglingId === player.id}
                    style={{
                      width: 48,
                      height: 28,
                      borderRadius: 14,
                      border: 'none',
                      background: player.ativo ? 'var(--accent)' : 'var(--bg-secondary)',
                      cursor: togglingId === player.id ? 'wait' : 'pointer',
                      position: 'relative',
                      flexShrink: 0,
                      transition: 'background 0.2s',
                      fontFamily: 'inherit'
                    }}
                  >
                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: 3,
                      left: player.ativo ? 23 : 3,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </button>
                </div>

                {/* Linha Secundária: Stats */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                  flexWrap: 'wrap'
                }}>
                  {/* Estrelas */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {renderStars(player.media_estrelas)}
                    <span style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--accent)',
                      marginLeft: 2
                    }}>
                      {player.total_votos >= 1 ? Number(player.media_estrelas).toFixed(1) : 'S/N'}
                    </span>
                  </div>

                  {/* Votos */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                    <span style={{ fontWeight: 700 }}>{player.total_votos || 0}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>votos</span>
                  </div>

                  {/* Partidas */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M3 9h18" />
                      <path d="M9 21V9" />
                    </svg>
                    <span style={{ fontWeight: 700 }}>{player.total_partidas || 0}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>partidas</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
