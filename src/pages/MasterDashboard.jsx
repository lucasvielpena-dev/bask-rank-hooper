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
  IconSportDynamic,
} from '../components/Icons';
import { useEsporte } from '../contexts/EsporteContext';

const TABS = [
  { label: 'Dashboard' },
  { label: 'Usuários', page: 'master-users' },
  { label: 'Cidades', page: 'master-cities' },
  { label: 'Jogadores', page: 'master-players' },
  { label: 'Torneios', page: 'master-tournaments' },
  { label: 'Notificações', page: 'master-notifications' },
  { label: 'Relatórios', page: 'master-reports' },
  { label: 'Logs', page: 'master-logs' },
];

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
  const { esporte } = useEsporte();
  const [stats, setStats] = useState({});
  const [cities, setCities] = useState([]);
  const [players, setPlayers] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function loadAll() {
    try {
      const [statsRes, cityRes, playersRes, reportsRes] = await Promise.all([
        supabase.rpc('get_master_stats'),
        masterAPI.getCityStats(),
        masterAPI.getPlayers(),
        masterAPI.getReports(),
      ]);

      if (statsRes.error) throw statsRes.error;
      const d = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
      setStats(d || {});

      if (!cityRes.error) setCities(cityRes.data || []);
      if (!playersRes.error) setPlayers(playersRes.data || []);
      if (!reportsRes.error) setReports(reportsRes.data || []);

      setError(null);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e.message || 'Erro ao carregar painel');
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
    const semCidade = players.filter(
      (p) => !p.cidade || String(p.cidade).trim() === ''
    );
    const suspensos = players.filter((p) => p.ativo === false);
    const semVotos = players.filter(
      (p) => p.ativo !== false && (p.total_votos || 0) === 0
    );
    const denunciasAbertas = (reports || []).filter(
      (r) => !r.status || r.status === 'aberto' || r.status === 'pendente'
    );
    return {
      semCidade,
      suspensos,
      semVotos,
      denunciasAbertas,
    };
  }, [players, reports]);

  if (loading) {
    return (
      <div
        className="page-content"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}
      >
        <div className="spinner" />
      </div>
    );
  }

  const isEmpty = Object.keys(stats).length === 0;
  const alertCount =
    insights.semCidade.length +
    insights.suspensos.length +
    insights.denunciasAbertas.length;

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: 'clamp(14px, 4vw, 20px) clamp(12px, 3vw, 20px) 0', maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Painel Master
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {lastUpdate
                ? `Atualizado ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · auto 20s`
                : 'Visão geral e alertas'}
            </p>
          </div>
          <button
            type="button"
            onClick={loadAll}
            className="btn btn-secondary btn-sm"
            style={{ flexShrink: 0 }}
          >
            Atualizar
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            marginBottom: 18,
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => (tab.page ? onNavigate(tab.page) : null)}
              style={{
                flexShrink: 0,
                padding: '8px 12px',
                borderRadius: 10,
                border: tab.page ? '1px solid var(--border)' : '1px solid rgba(200,241,53,0.35)',
                background: tab.page ? 'var(--bg-card)' : 'var(--accent-dim)',
                color: tab.page ? 'var(--text-secondary)' : 'var(--accent)',
                fontWeight: 700,
                fontSize: 12,
                cursor: tab.page ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12,
              padding: '12px 16px',
              color: '#f87171',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {isEmpty ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
            Sem dados ainda. Crie contas e jogadores para popular o painel.
          </div>
        ) : (
          <>
            {/* ALERTAS — o que exige atenção */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Precisa de atenção
                </h2>
                {alertCount === 0 && (
                  <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>Tudo ok</span>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                }}
              >
                <AlertCard
                  title="Sem cidade"
                  count={insights.semCidade.length}
                  hint="Não entram no ranking municipal"
                  tone={insights.semCidade.length ? 'warn' : 'ok'}
                  onClick={() => onNavigate('master-players')}
                />
                <AlertCard
                  title="Suspensos"
                  count={insights.suspensos.length}
                  hint="Jogadores desativados"
                  tone={insights.suspensos.length ? 'muted' : 'ok'}
                  onClick={() => onNavigate('master-players')}
                />
                <AlertCard
                  title="Sem votos"
                  count={insights.semVotos.length}
                  hint="Ativos ainda sem avaliação"
                  tone="info"
                  onClick={() => onNavigate('master-players')}
                />
                <AlertCard
                  title="Denúncias"
                  count={insights.denunciasAbertas.length}
                  hint="Relatórios abertos"
                  tone={insights.denunciasAbertas.length ? 'danger' : 'ok'}
                  onClick={() => onNavigate('master-reports')}
                />
              </div>

              {insights.semCidade.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 12,
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.25)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>
                    Atletas sem cidade (toque em Jogadores para gerir)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {insights.semCidade.slice(0, 8).map((p) => (
                      <span
                        key={p.id}
                        style={{
                          fontSize: 11,
                          padding: '4px 8px',
                          borderRadius: 8,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {p.apelido || p.nome || 'Atleta'}
                      </span>
                    ))}
                    {insights.semCidade.length > 8 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                        +{insights.semCidade.length - 8}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* NÚMEROS */}
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
              Números do sistema
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginBottom: 20,
              }}
            >
              {STAT_CARDS.map((card) => {
                const Icon = card.icon;
                const val = stats[card.key];
                return (
                  <div
                    key={card.key}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '10px 8px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                      <Icon size={16} color="var(--accent)" />
                    </div>
                    <div
                      style={{
                        fontSize: 'clamp(16px, 4vw, 20px)',
                        fontWeight: 900,
                        color: 'var(--text-primary)',
                        fontFamily: "'Barlow Condensed', sans-serif",
                      }}
                    >
                      {val ?? '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                      {card.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CIDADES */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Por cidade
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('master-cities')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Ver todas →
              </button>
            </div>

            {cities.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  marginBottom: 20,
                  textAlign: 'center',
                }}
              >
                Nenhuma cidade com cadastro completo ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {cities.slice(0, 6).map((c) => {
                  const maxUsers = Math.max(...cities.map((x) => Number(x.user_count) || 0), 1);
                  const pct = Math.round(((Number(c.user_count) || 0) / maxUsers) * 100);
                  return (
                    <button
                      key={c.cidade}
                      type="button"
                      onClick={() => onNavigate('master-cities')}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>
                          {c.cidade}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                          {c.user_count} user · {c.player_count} atletas
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 99,
                          background: 'rgba(255,255,255,0.06)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 99,
                            background: 'var(--accent)',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 12,
                          marginTop: 8,
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span>{c.match_count || 0} partidas</span>
                        <span>{c.tournament_count || 0} torneios</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ATALHOS */}
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
              Atalhos
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                paddingBottom: 28,
              }}
            >
              {[
                { label: 'Jogadores e status', tab: 'master-players', hint: 'Cidade, ativo, votos' },
                { label: 'Cidades', tab: 'master-cities', hint: 'Onde está a base' },
                { label: 'Usuários', tab: 'master-users', hint: 'Contas e papéis' },
                { label: 'Torneios', tab: 'master-tournaments', hint: 'Competições' },
                { label: 'Notificações', tab: 'master-notifications', hint: 'Avisos globais' },
                { label: 'Relatórios', tab: 'master-reports', hint: 'Denúncias' },
              ].map((action) => (
                <button
                  key={action.tab}
                  type="button"
                  onClick={() => onNavigate(action.tab)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(200,241,53,0.15)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: 'var(--accent-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <IconSportDynamic sport={esporte} size={18} color="var(--accent)" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {action.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{action.hint}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AlertCard({ title, count, hint, tone, onClick }) {
  const styles = {
    warn: { border: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.08)', num: '#fbbf24' },
    danger: { border: 'rgba(239,68,68,0.35)', bg: 'rgba(239,68,68,0.08)', num: '#f87171' },
    muted: { border: 'var(--border)', bg: 'var(--bg-card)', num: 'var(--text-secondary)' },
    info: { border: 'rgba(96,165,250,0.3)', bg: 'rgba(96,165,250,0.08)', num: '#93c5fd' },
    ok: { border: 'rgba(74,222,128,0.25)', bg: 'rgba(74,222,128,0.06)', num: '#4ade80' },
  }[tone] || { border: 'var(--border)', bg: 'var(--bg-card)', num: 'var(--text-primary)' };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: 14,
        padding: '12px 12px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900, color: styles.num, fontFamily: "'Barlow Condensed', sans-serif" }}>
        {count}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{title}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3 }}>{hint}</div>
    </button>
  );
}
