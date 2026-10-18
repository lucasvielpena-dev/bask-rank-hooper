import { useState, useEffect, useMemo } from 'react';
import { supabase, masterAPI } from '../lib/supabase';
import {
  IconJogador,
  IconBasquete,
  IconPlacar,
  IconTrofeu,
  IconAvaliar,
  IconLocalizacao,
  IconNotificacao,
  IconEstatisticas,
} from '../components/Icons';
import MasterNav from '../components/MasterNav';

const STAT_CARDS = [
  { key: 'total_users', label: 'Usuários', icon: IconJogador },
  { key: 'total_players', label: 'Jogadores', icon: IconBasquete },
  { key: 'total_matches', label: 'Partidas', icon: IconPlacar },
  { key: 'total_tournaments', label: 'Torneios', icon: IconTrofeu },
  { key: 'total_ratings', label: 'Avaliações', icon: IconAvaliar },
  { key: 'total_cities', label: 'Cidades', icon: IconLocalizacao },
  { key: 'online_now', label: 'Online', icon: IconNotificacao },
  { key: 'new_30d', label: 'Novos 30d', icon: IconEstatisticas },
];

export default function MasterDashboard({ onNavigate }) {
  const [stats, setStats] = useState({});
  const [cities, setCities] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function loadAll() {
    try {
      const statsRes = await supabase.rpc('get_master_stats');
      if (statsRes.error) throw statsRes.error;
      const d = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
      setStats(d && typeof d === 'object' ? d : {});

      try {
        const cityRes = await masterAPI.getCityStats();
        setCities(!cityRes.error && Array.isArray(cityRes.data) ? cityRes.data : []);
      } catch (_) {
        setCities([]);
      }

      try {
        const playersRes = await masterAPI.getPlayers();
        setPlayers(!playersRes.error && Array.isArray(playersRes.data) ? playersRes.data : []);
      } catch (_) {
        setPlayers([]);
      }

      setError(null);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e?.message || 'Erro ao carregar painel');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 20000);
    return () => clearInterval(interval);
  }, []);

  const insights = useMemo(() => {
    const list = Array.isArray(players) ? players : [];
    return {
      semCidade: list.filter((p) => !p?.cidade || String(p.cidade).trim() === ''),
      suspensos: list.filter((p) => p?.ativo === false),
      semVotos: list.filter((p) => p?.ativo !== false && (Number(p?.total_votos) || 0) === 0),
    };
  }, [players]);

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const isEmpty = !stats || Object.keys(stats).length === 0;

  return (
    <div className="page-content home-page" style={{ background: 'var(--bg-primary)' }}>
      <div className="home-container" style={{ padding: '16px 16px 28px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div>
            <h1 className="page-title">Master</h1>
            <p className="page-sub">
              {lastUpdate
                ? `Atualizado ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Painel de gestão'}
            </p>
          </div>
          <button type="button" onClick={loadAll} className="btn btn-secondary btn-sm">
            Atualizar
          </button>
        </div>

        <MasterNav current="master" onNavigate={onNavigate} />

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12,
              padding: '12px 14px',
              color: '#f87171',
              fontSize: 'var(--fs-sm)',
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        {isEmpty ? (
          <div className="premium-card" style={{ borderRadius: 14, padding: 24, textAlign: 'center' }}>
            <p className="page-sub" style={{ margin: 0 }}>Sem dados ainda no painel.</p>
          </div>
        ) : (
          <>
            {/* Alertas — estilo Home highlights */}
            <div className="home-section-label" style={{ marginBottom: 10 }}>Precisa de atenção</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 18 }}>
              <button
                type="button"
                className="premium-card"
                onClick={() => onNavigate?.('master-players')}
                style={{
                  borderRadius: 14,
                  padding: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: insights.semCidade.length ? '1px solid rgba(245,158,11,0.35)' : undefined,
                  fontFamily: 'inherit',
                }}
              >
                <div className="text-lg" style={{ color: insights.semCidade.length ? '#fbbf24' : 'var(--accent)', margin: 0 }}>
                  {insights.semCidade.length}
                </div>
                <div className="text-sm" style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>Sem cidade</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>Ver em Jogadores</div>
              </button>
              <button
                type="button"
                className="premium-card"
                onClick={() => onNavigate?.('master-players')}
                style={{ borderRadius: 14, padding: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <div className="text-lg" style={{ color: 'var(--text-secondary)', margin: 0 }}>{insights.suspensos.length}</div>
                <div className="text-sm" style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>Suspensos</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>Ativar / suspender</div>
              </button>
              <button
                type="button"
                className="premium-card"
                onClick={() => onNavigate?.('master-players')}
                style={{ borderRadius: 14, padding: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <div className="text-lg" style={{ color: '#93c5fd', margin: 0 }}>{insights.semVotos.length}</div>
                <div className="text-sm" style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>Sem votos</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>Ainda sem avaliação</div>
              </button>
              <button
                type="button"
                className="premium-card"
                onClick={() => onNavigate?.('master-reports')}
                style={{ borderRadius: 14, padding: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <div className="text-lg" style={{ color: 'var(--accent)', margin: 0 }}>→</div>
                <div className="text-sm" style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>Relatórios</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>Gráficos do sistema</div>
              </button>
            </div>

            {insights.semCidade.length > 0 && (
              <div className="premium-card" style={{ borderRadius: 14, padding: 14, marginBottom: 18 }}>
                <div className="text-sm" style={{ fontWeight: 800, color: '#fbbf24', marginBottom: 8 }}>
                  Atletas sem cidade
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {insights.semCidade.slice(0, 10).map((p) => (
                    <span
                      key={p.id}
                      className="text-sm"
                      style={{
                        padding: '4px 8px',
                        borderRadius: 8,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                      }}
                    >
                      {p.apelido || p.nome || 'Atleta'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Números */}
            <div className="home-section-label" style={{ marginBottom: 10 }}>Números</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
              {STAT_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.key} className="premium-card" style={{ borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                      <Icon size={16} color="var(--accent)" />
                    </div>
                    <div className="text-lg" style={{ margin: 0, fontSize: 18 }}>{stats[card.key] ?? '—'}</div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                      {card.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cidades */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="home-section-label" style={{ margin: 0 }}>Por cidade</div>
              <button
                type="button"
                className="home-section-link"
                onClick={() => onNavigate?.('master-cities')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Ver todas
              </button>
            </div>

            {cities.length === 0 ? (
              <div className="premium-card" style={{ borderRadius: 14, padding: 16, textAlign: 'center', marginBottom: 18 }}>
                <p className="page-sub" style={{ margin: 0 }}>Nenhuma cidade com cadastro ainda.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                {cities.slice(0, 5).map((c) => {
                  const maxUsers = Math.max(...cities.map((x) => Number(x.user_count) || 0), 1);
                  const pct = Math.round(((Number(c.user_count) || 0) / maxUsers) * 100);
                  return (
                    <button
                      key={String(c.cidade)}
                      type="button"
                      className="premium-card"
                      onClick={() => onNavigate?.('master-cities')}
                      style={{
                        borderRadius: 14,
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        width: '100%',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="text-md" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{c.cidade}</span>
                        <span className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                          {c.user_count} · {c.player_count} atletas
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: 'var(--accent)' }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
