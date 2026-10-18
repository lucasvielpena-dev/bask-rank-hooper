import { useState, useEffect, useMemo } from 'react';
import { masterAPI } from '../lib/supabase';
import { IconBuscar, IconSportDynamic } from '../components/Icons';
import MasterNav from '../components/MasterNav';

function StarRow({ value }) {
  const v = Number(value) || 0;
  const rounded = Math.round(v);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24"
          fill={i <= rounded ? 'var(--accent)' : 'none'}
          stroke={i <= rounded ? 'var(--accent)' : 'var(--text-muted)'}
          strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

export default function AdminPlayers({ profile, onNavigate }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all | active | suspended
  const [filterCity, setFilterCity] = useState('all');
  const [sortBy, setSortBy] = useState('nome'); // nome | media | votos | cidade

  const isMaster = profile?.role === 'master';

  useEffect(() => {
    if (isMaster) loadPlayers();
  }, [isMaster]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

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
      setPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, ativo: newActive } : p))
      );
      showToast(newActive ? 'Jogador reativado' : 'Jogador suspenso');
    } catch (e) {
      showToast(e.message || 'Erro ao alterar status', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  const cities = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      const key = `${p.cidade || 'Sem cidade'}|${p.uf || ''}`;
      if (!map[key]) map[key] = { cidade: p.cidade || 'Sem cidade', uf: p.uf || '', count: 0, ativos: 0 };
      map[key].count += 1;
      if (p.ativo) map[key].ativos += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [players]);

  const summary = useMemo(() => {
    const total = players.length;
    const ativos = players.filter((p) => p.ativo).length;
    const suspensos = total - ativos;
    const comVotos = players.filter((p) => (p.total_votos || 0) >= 1).length;
    return { total, ativos, suspensos, comVotos, cidades: cities.length };
  }, [players, cities]);

  const filtered = useMemo(() => {
    let result = [...players];
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.nome || '').toLowerCase().includes(term) ||
          (p.apelido || '').toLowerCase().includes(term) ||
          (p.cidade || '').toLowerCase().includes(term) ||
          (p.posicao || '').toLowerCase().includes(term) ||
          (p.uf || '').toLowerCase().includes(term)
      );
    }
    if (filterStatus === 'active') result = result.filter((p) => p.ativo);
    if (filterStatus === 'suspended') result = result.filter((p) => !p.ativo);
    if (filterCity !== 'all') {
      const [c, u] = filterCity.split('|');
      result = result.filter((p) => (p.cidade || 'Sem cidade') === c && (p.uf || '') === u);
    }
    result.sort((a, b) => {
      if (sortBy === 'media') return (Number(b.media_estrelas) || 0) - (Number(a.media_estrelas) || 0);
      if (sortBy === 'votos') return (b.total_votos || 0) - (a.total_votos || 0);
      if (sortBy === 'cidade') return `${a.cidade}${a.uf}`.localeCompare(`${b.cidade}${b.uf}`);
      return (a.nome || '').localeCompare(b.nome || '');
    });
    return result;
  }, [players, search, filterStatus, filterCity, sortBy]);

  if (!isMaster) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Acesso negado</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Você não tem permissão para esta área.</p>
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
    <div className="page-content admin-page">
      <div className="admin-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div>
            <h1 className="page-title">Jogadores</h1>
            <p className="page-sub">Status, cidade e votos — tudo nesta lista</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadPlayers}>
            Atualizar
          </button>
        </div>
        <MasterNav current="master-players" onNavigate={onNavigate} />

        {/* Resumo rápido */}
        <div className="admin-summary">
          <div className="admin-summary-item">
            <span className="admin-summary-val">{summary.total}</span>
            <span className="admin-summary-lbl">Total</span>
          </div>
          <div className="admin-summary-item is-ok">
            <span className="admin-summary-val">{summary.ativos}</span>
            <span className="admin-summary-lbl">Ativos</span>
          </div>
          <div className="admin-summary-item is-warn">
            <span className="admin-summary-val">{summary.suspensos}</span>
            <span className="admin-summary-lbl">Suspensos</span>
          </div>
          <div className="admin-summary-item">
            <span className="admin-summary-val">{summary.cidades}</span>
            <span className="admin-summary-lbl">Cidades</span>
          </div>
          <div className="admin-summary-item">
            <span className="admin-summary-val">{summary.comVotos}</span>
            <span className="admin-summary-lbl">Com votos</span>
          </div>
        </div>

        {/* Busca */}
        <div className="admin-search">
          <IconBuscar size={16} color="var(--text-muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, apelido, cidade, posição..."
          />
        </div>

        {/* Status */}
        <div className="admin-chips">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'active', label: 'Ativos' },
            { key: 'suspended', label: 'Suspensos' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              className={`admin-chip ${filterStatus === f.key ? 'active' : ''}`}
              onClick={() => setFilterStatus(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Cidades */}
        <div className="admin-section-label">Filtrar por cidade</div>
        <div className="admin-chips admin-chips-scroll">
          <button
            type="button"
            className={`admin-chip ${filterCity === 'all' ? 'active' : ''}`}
            onClick={() => setFilterCity('all')}
          >
            Todas ({players.length})
          </button>
          {cities.map((c) => {
            const key = `${c.cidade}|${c.uf}`;
            return (
              <button
                key={key}
                type="button"
                className={`admin-chip ${filterCity === key ? 'active' : ''}`}
                onClick={() => setFilterCity(key)}
              >
                {c.cidade}{c.uf ? `-${c.uf}` : ''} · {c.count}
              </button>
            );
          })}
        </div>

        {/* Ordenar */}
        <div className="admin-sort-row">
          <span className="admin-section-label" style={{ margin: 0 }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="admin-select">
            <option value="nome">Nome A–Z</option>
            <option value="media">Maior média</option>
            <option value="votos">Mais votos</option>
            <option value="cidade">Cidade</option>
          </select>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <IconSportDynamic sport="basquete" size={32} color="var(--text-muted)" />
            <h3>Nenhum jogador encontrado</h3>
            <p>Ajuste busca ou filtros.</p>
          </div>
        ) : (
          <div className="admin-player-list">
            {filtered.map((player) => (
              <article
                key={player.id}
                className={`admin-player-card ${!player.ativo ? 'is-suspended' : ''}`}
                style={{ opacity: togglingId === player.id ? 0.55 : 1 }}
              >
                <div className="admin-player-top">
                  {player.foto_url ? (
                    <img src={player.foto_url} alt="" loading="lazy" decoding="async" className="admin-player-avatar" />
                  ) : (
                    <div className="admin-player-avatar fallback">
                      {(player.nome || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="admin-player-info">
                    <div className="admin-player-name">
                      {player.nome || 'Sem nome'}
                      {player.apelido ? (
                        <span className="admin-player-nick">@{player.apelido}</span>
                      ) : null}
                    </div>
                    <div className="admin-player-meta">
                      <span>{player.posicao || '—'}</span>
                      <span className="dot">·</span>
                      <span className="admin-player-city">
                        {player.cidade || 'Sem cidade'}
                        {player.uf ? ` - ${player.uf}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className={`admin-status-pill ${player.ativo ? 'ok' : 'off'}`}>
                    {player.ativo ? 'Ativo' : 'Suspenso'}
                  </span>
                </div>

                <div className="admin-player-stats">
                  <div className="admin-stat">
                    <StarRow value={player.media_estrelas} />
                    <strong>
                      {(player.total_votos || 0) >= 1
                        ? Number(player.media_estrelas).toFixed(1)
                        : 'S/N'}
                    </strong>
                  </div>
                  <div className="admin-stat">
                    <span className="muted">Votos</span>
                    <strong>{player.total_votos || 0}</strong>
                  </div>
                  <div className="admin-stat">
                    <span className="muted">Partidas</span>
                    <strong>{player.total_partidas || 0}</strong>
                  </div>
                </div>

                <div className="admin-player-actions">
                  <button
                    type="button"
                    className={`btn btn-sm ${player.ativo ? 'btn-secondary' : 'btn-primary'}`}
                    disabled={!!togglingId}
                    onClick={() => handleTogglePlayer(player)}
                  >
                    {togglingId === player.id
                      ? '...'
                      : player.ativo
                        ? 'Suspender'
                        : 'Reativar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
