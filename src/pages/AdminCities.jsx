import { useState, useEffect, useMemo } from 'react';
import { masterAPI } from '../lib/supabase';
import { IconVoltar, IconLocalizacao, IconBuscar } from '../components/Icons';

export default function AdminCities({ profile, onNavigate }) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('players'); // players | users | name

  useEffect(() => {
    loadCities();
  }, []);

  async function loadCities() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await masterAPI.getCityStats();
      if (err) throw err;
      setCities(data || []);
    } catch (e) {
      setError(e.message || 'Erro ao carregar cidades.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let list = [...cities];
    if (search.trim()) {
      const t = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.cidade || '').toLowerCase().includes(t) ||
          (c.uf || '').toLowerCase().includes(t)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'users') return (b.user_count || 0) - (a.user_count || 0);
      if (sortBy === 'name') return (a.cidade || '').localeCompare(b.cidade || '');
      return (b.player_count || 0) - (a.player_count || 0);
    });
    return list;
  }, [cities, search, sortBy]);

  const totals = useMemo(() => {
    return cities.reduce(
      (acc, c) => {
        acc.users += c.user_count || 0;
        acc.players += c.player_count || 0;
        acc.matches += c.match_count || 0;
        acc.tournaments += c.tournament_count || 0;
        return acc;
      },
      { users: 0, players: 0, matches: 0, tournaments: 0 }
    );
  }, [cities]);

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
        <div className="admin-header">
          <button type="button" className="admin-back" onClick={() => onNavigate?.('master')} aria-label="Voltar">
            <IconVoltar size={18} color="var(--accent)" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="admin-title">Cidades</h1>
            <p className="admin-sub">Onde estão os jogadores e a atividade</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadCities}>
            Atualizar
          </button>
        </div>

        <div className="admin-summary">
          <div className="admin-summary-item">
            <span className="admin-summary-val">{cities.length}</span>
            <span className="admin-summary-lbl">Cidades</span>
          </div>
          <div className="admin-summary-item">
            <span className="admin-summary-val">{totals.players}</span>
            <span className="admin-summary-lbl">Jogadores</span>
          </div>
          <div className="admin-summary-item">
            <span className="admin-summary-val">{totals.users}</span>
            <span className="admin-summary-lbl">Usuários</span>
          </div>
          <div className="admin-summary-item">
            <span className="admin-summary-val">{totals.matches}</span>
            <span className="admin-summary-lbl">Partidas</span>
          </div>
        </div>

        <div className="admin-search">
          <IconBuscar size={16} color="var(--text-muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cidade ou UF..."
          />
        </div>

        <div className="admin-sort-row">
          <span className="admin-section-label" style={{ margin: 0 }}>
            {filtered.length} cidade{filtered.length !== 1 ? 's' : ''}
          </span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="admin-select">
            <option value="players">Mais jogadores</option>
            <option value="users">Mais usuários</option>
            <option value="name">Nome A–Z</option>
          </select>
        </div>

        {error && (
          <div className="admin-error">{error}</div>
        )}

        {filtered.length === 0 ? (
          <div className="empty-state">
            <IconLocalizacao size={36} color="var(--text-muted)" />
            <h3>Nenhuma cidade encontrada</h3>
            <p>Os dados aparecem quando houver cadastros.</p>
          </div>
        ) : (
          <div className="admin-city-list">
            {filtered.map((city, index) => (
              <article key={`${city.cidade}-${city.uf}-${index}`} className="admin-city-card">
                <div className="admin-city-head">
                  <div className={`admin-city-rank ${index < 3 ? 'top' : ''}`}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="admin-city-name">{city.cidade || 'Desconhecida'}</h3>
                    <p className="admin-city-uf">{city.uf || '—'}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigate?.('master-players')}
                    title="Ver jogadores"
                  >
                    Ver atletas
                  </button>
                </div>
                <div className="admin-city-grid">
                  <div className="admin-city-stat">
                    <span>Jogadores</span>
                    <strong>{city.player_count || 0}</strong>
                  </div>
                  <div className="admin-city-stat">
                    <span>Usuários</span>
                    <strong>{city.user_count || 0}</strong>
                  </div>
                  <div className="admin-city-stat">
                    <span>Partidas</span>
                    <strong>{city.match_count || 0}</strong>
                  </div>
                  <div className="admin-city-stat">
                    <span>Torneios</span>
                    <strong>{city.tournament_count || 0}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
