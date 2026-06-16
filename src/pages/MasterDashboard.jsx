import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  IconJogador,
  IconBasquete,
  IconPlacar,
  IconTrofeu,
  IconAvaliar,
  IconLocalizacao,
  IconNotificacao,
  IconEstatisticas,
  IconSportDynamic
} from '../components/Icons';
import { useEsporte } from '../contexts/EsporteContext';

const STAT_CARDS = [
  { key: 'total_users', label: 'Total Usuários', icon: IconJogador, color: 'blue' },
  { key: 'total_players', label: 'Total Jogadores', icon: IconBasquete, color: 'gold' },
  { key: 'total_matches', label: 'Total Partidas', icon: IconPlacar, color: 'blue' },
  { key: 'total_tournaments', label: 'Total Torneios', icon: IconTrofeu, color: 'gold' },
  { key: 'total_ratings', label: 'Total Avaliações', icon: IconAvaliar, color: 'blue' },
  { key: 'total_cities', label: 'Total Cidades', icon: IconLocalizacao, color: 'gold' },
  { key: 'online_now', label: 'Online Agora', icon: IconNotificacao, color: 'blue' },
  { key: 'new_30d', label: 'Novos (30 dias)', icon: IconEstatisticas, color: 'gold' }
];

const TABS = [
  { label: 'Dashboard' },
  { label: 'Usuários', page: 'master-users' },
  { label: 'Cidades', page: 'master-cities' },
  { label: 'Jogadores', page: 'master-players' },
  { label: 'Torneios', page: 'master-tournaments' },
  { label: 'Notificações', page: 'master-notifications' },
  { label: 'Relatórios', page: 'master-reports' },
  { label: 'Logs', page: 'master-logs' }
];

const ICON_COLOR = { blue: 'var(--accent)', gold: 'var(--accent)' };

export default function MasterDashboard({ onNavigate }) {
  const { esporte } = useEsporte();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function loadStats() {
    try {
      const { data: raw, error: err } = await supabase.rpc('get_master_stats');
      if (err) throw err;
      const d = Array.isArray(raw) ? raw[0] : raw;
      if (d) {
        setStats(d);
        setError(null);
        setLastUpdate(new Date());
      }
    } catch (e) {
      setError(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStats(); }, []);

  useEffect(() => {
    const interval = setInterval(loadStats, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const isEmpty = Object.keys(stats).length === 0;

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: 'clamp(14px, 4vw, 20px) clamp(12px, 3vw, 20px) 0', maxWidth: 960, margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'clamp(12px, 3vw, 20px)' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Painel Master
            </h1>
            <p style={{ fontSize: 'clamp(11px, 2.5vw, 13px)', color: 'var(--text-secondary)' }}>
              {lastUpdate
                ? `Última atualização: ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} — Auto 15s`
                : 'Visão geral do sistema e gerenciamento'}
            </p>
          </div>
          <button
            onClick={loadStats}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 12
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Atualizar
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12,
            padding: '12px 16px',
            color: '#f87171',
            fontSize: 13,
            marginBottom: 16
          }}>
            {error}
          </div>
        )}

        {isEmpty ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhum dado disponível</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Clique em "Atualizar" para tentar novamente</p>
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'clamp(8px, 2vw, 12px)',
              marginBottom: 'clamp(12px, 3vw, 24px)'
            }}>
              {STAT_CARDS.map(card => {
                let Icon = card.icon;
                if (Icon === IconBasquete) {
                  Icon = (props) => <IconSportDynamic sport={esporte} {...props} />;
                }
                const value = stats[card.key] ?? 0;
                return (
                  <div key={card.key} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(200,241,53,0.15)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}>
                    <div style={{
                      width: 'clamp(34px, 8vw, 40px)',
                      height: 'clamp(34px, 8vw, 40px)',
                      borderRadius: 10,
                      background: card.color === 'blue' ? 'var(--accent-dim)' : 'var(--accent-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={20} color={ICON_COLOR[card.color]} />
                    </div>
                    <div>
                      <div style={{
                        fontSize: 'clamp(20px, 5vw, 28px)',
                        fontWeight: 900,
                        color: 'var(--text-primary)',
                        lineHeight: 1,
                        fontFamily: 'monospace'
                      }}>
                        {Number(value).toLocaleString('pt-BR')}
                      </div>
                      <div style={{
                        fontSize: 'clamp(9px, 2vw, 11px)',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        marginTop: 4
                      }}>
                        {card.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              display: 'flex',
              background: 'var(--bg-secondary)',
              borderRadius: 'clamp(8px, 1.5vw, 10px)',
              padding: '3px',
              gap: 2,
              marginBottom: 'clamp(12px, 3vw, 20px)',
              overflowX: 'auto',
              scrollbarWidth: 'none'
            }}>
              {TABS.map(tab => (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => tab.page ? onNavigate(tab.page) : null}
                  style={{
                    flex: '0 0 auto',
                    padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 14px)',
                    borderRadius: 'clamp(6px, 1vw, 8px)',
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-muted)',
                    fontSize: 'clamp(10px, 2.5vw, 12px)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{
              background: 'rgba(200,241,53,0.08)',
              border: '1px solid rgba(200,241,53,0.2)',
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 16
            }}>
              <div style={{
                fontSize: 'clamp(10px, 2.5vw, 12px)',
                fontWeight: 800,
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8
              }}>
                Resumo do Sistema
              </div>
              <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#E8E8F0', lineHeight: 1.6 }}>
                Bem-vindo ao painel administrativo. Aqui você pode visualizar métricas gerais,
                gerenciar usuários, jogadores, torneios e acompanhar a atividade da plataforma.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'clamp(8px, 2vw, 12px)', paddingBottom: 24 }}>
              {[
                { label: 'Gerenciar Usuários', tab: 'master-users', color: 'blue' },
                { label: 'Gerenciar Jogadores', tab: 'master-players', color: 'gold' },
                { label: 'Ver Torneios', tab: 'master-tournaments', color: 'blue' },
                { label: 'Enviar Notificação', tab: 'master-notifications', color: 'gold' }
              ].map(action => (
                <button
                  key={action.tab}
                  onClick={() => onNavigate(action.tab)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(200,241,53,0.15)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'transform 0.2s'
                  }}
                >
                  <div style={{
                    width: 'clamp(32px, 7vw, 38px)',
                    height: 'clamp(32px, 7vw, 38px)',
                    borderRadius: 10,
                    background: action.color === 'blue' ? 'var(--accent-dim)' : 'var(--accent-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10
                  }}>
                    {action.color === 'blue'
                      ? <IconJogador size={18} color="var(--accent)" />
                      : <IconSportDynamic sport={esporte} size={18} color="var(--accent)" />
                    }
                  </div>
                  <div style={{ fontSize: 'clamp(11px, 2.5vw, 13px)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {action.label}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
