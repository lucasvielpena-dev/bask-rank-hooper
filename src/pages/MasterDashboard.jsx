import { useState, useEffect } from 'react';
import { masterAPI } from '../lib/supabase';
import {
  IconJogador,
  IconBasquete,
  IconPlacar,
  IconTrofeu,
  IconAvaliar,
  IconLocalizacao,
  IconNotificacao,
  IconEstatisticas
} from '../components/Icons';

export default function MasterDashboard({ profile, onNavigate }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    total_usuarios: 0,
    total_jogadores: 0,
    total_partidas: 0,
    total_torneios: 0,
    total_avaliacoes: 0,
    total_cidades: 0,
    online_agora: 0,
    novos_30_dias: 0
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const isMaster = profile?.role === 'master';

  useEffect(() => {
    if (isMaster) loadStats();
  }, [isMaster]);

  async function loadStats() {
    setLoading(true);
    try {
      const { data, error } = await masterAPI.getStats();
      if (error) throw error;
      if (data) {
        setStats({
          total_usuarios: data.total_usuarios || 0,
          total_jogadores: data.total_jogadores || 0,
          total_partidas: data.total_partidas || 0,
          total_torneios: data.total_torneios || 0,
          total_avaliacoes: data.total_avaliacoes || 0,
          total_cidades: data.total_cidades || 0,
          online_agora: data.online_agora || 0,
          novos_30_dias: data.novos_30_dias || 0
        });
      }
    } catch (e) {
      console.error(e);
      showToast('Erro ao carregar estatísticas.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleTabClick(tabKey) {
    setActiveTab(tabKey);
    onNavigate('master', tabKey);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  if (!isMaster) {
    return (
      <div className="page-content" style={{ background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 'clamp(40px, 10vw, 56px)', marginBottom: 12, opacity: 0.3 }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={{ fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            Acesso negado
          </h2>
          <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Você não tem permissão para acessar o painel administrativo.
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

  const statCards = [
    { key: 'usuarios', label: 'Total Usuários', value: stats.total_usuarios, icon: <IconJogador size={20} color="#2563EB" />, color: 'blue' },
    { key: 'jogadores', label: 'Total Jogadores', value: stats.total_jogadores, icon: <IconBasquete size={20} color="#F97316" />, color: 'gold' },
    { key: 'partidas', label: 'Total Partidas', value: stats.total_partidas, icon: <IconPlacar size={20} color="#2563EB" />, color: 'blue' },
    { key: 'torneios', label: 'Total Torneios', value: stats.total_torneios, icon: <IconTrofeu size={20} color="#F97316" />, color: 'gold' },
    { key: 'avaliacoes', label: 'Total Avaliações', value: stats.total_avaliacoes, icon: <IconAvaliar size={20} color="#2563EB" />, color: 'blue' },
    { key: 'cidades', label: 'Total Cidades', value: stats.total_cidades, icon: <IconLocalizacao size={20} color="#F97316" />, color: 'gold' },
    { key: 'online', label: 'Online Agora', value: stats.online_agora, icon: <IconNotificacao size={20} color="#2563EB" />, color: 'blue' },
    { key: 'novos', label: 'Novos (30 dias)', value: stats.novos_30_dias, icon: <IconEstatisticas size={20} color="#F97316" />, color: 'gold' }
  ];

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'usuarios', label: 'Usuários' },
    { key: 'cidades', label: 'Cidades' },
    { key: 'jogadores', label: 'Jogadores' },
    { key: 'torneios', label: 'Torneios' },
    { key: 'notificacoes', label: 'Notificações' },
    { key: 'relatorios', label: 'Relatórios' },
    { key: 'logs', label: 'Logs' }
  ];

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: 'clamp(14px, 4vw, 20px) clamp(12px, 3vw, 20px) 0', maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 'clamp(12px, 3vw, 20px)' }}>
          <h1 style={{
            fontSize: 'clamp(20px, 5vw, 26px)',
            fontWeight: 900,
            color: 'var(--text-primary)',
            marginBottom: 2,
            letterSpacing: '-0.02em'
          }}>
            Painel Master
          </h1>
          <p style={{ fontSize: 'clamp(11px, 2.5vw, 13px)', color: 'var(--text-secondary)' }}>
            Visão geral do sistema e gerenciamento
          </p>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'clamp(8px, 2vw, 12px)',
          marginBottom: 'clamp(12px, 3vw, 24px)'
        }}>
          {statCards.map(card => (
            <div
              key={card.key}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'clamp(12px, 2vw, 16px)',
                padding: 'clamp(12px, 3vw, 16px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
            >
              <div style={{
                width: 'clamp(34px, 8vw, 40px)',
                height: 'clamp(34px, 8vw, 40px)',
                borderRadius: 10,
                background: card.color === 'blue' ? 'var(--accent-blue-dim)' : 'var(--accent-gold-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {card.icon}
              </div>
              <div>
                <div style={{
                  fontSize: 'clamp(20px, 5vw, 28px)',
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                  fontFamily: 'monospace'
                }}>
                  {card.value.toLocaleString('pt-BR')}
                </div>
                <div style={{
                  fontSize: 'clamp(9px, 2vw, 11px)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  marginTop: 4,
                  letterSpacing: '0.01em'
                }}>
                  {card.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
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
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabClick(tab.key)}
              style={{
                flex: '0 0 auto',
                padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 14px)',
                borderRadius: 'clamp(6px, 1vw, 8px)',
                border: 'none',
                background: activeTab === tab.key ? 'var(--bg-elevated)' : 'none',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 'clamp(10px, 2.5vw, 12px)',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                letterSpacing: '0.02em'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: 'clamp(120px, 30vh, 200px)', paddingBottom: 24 }}>
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Summary Card */}
              <div style={{
                background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(37,99,235,0.06) 100%)',
                border: '1px solid rgba(37,99,235,0.12)',
                borderRadius: 'clamp(12px, 2vw, 16px)',
                padding: 'clamp(14px, 3vw, 20px)'
              }}>
                <div style={{
                  fontSize: 'clamp(10px, 2.5vw, 12px)',
                  fontWeight: 800,
                  color: 'var(--accent-blue-light)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: 8
                }}>
                  Resumo do Sistema
                </div>
                <p style={{
                  fontSize: 'clamp(12px, 3vw, 14px)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6
                }}>
                  Bem-vindo ao painel administrativo. Aqui você pode visualizar métricas gerais,
                  gerenciar usuários, jogadores, torneios e acompanhar a atividade da plataforma.
                </p>
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'clamp(8px, 2vw, 12px)' }}>
                {[
                  { label: 'Gerenciar Usuários', tab: 'usuarios', color: 'blue' },
                  { label: 'Gerenciar Jogadores', tab: 'jogadores', color: 'gold' },
                  { label: 'Ver Torneios', tab: 'torneios', color: 'blue' },
                  { label: 'Enviar Notificação', tab: 'notificacoes', color: 'gold' }
                ].map(action => (
                  <button
                    key={action.tab}
                    onClick={() => handleTabClick(action.tab)}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'clamp(10px, 2vw, 14px)',
                      padding: 'clamp(12px, 3vw, 16px)',
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
                      background: action.color === 'blue' ? 'var(--accent-blue-dim)' : 'var(--accent-gold-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10
                    }}>
                      {action.color === 'blue'
                        ? <IconJogador size={18} color="#2563EB" />
                        : <IconBasquete size={18} color="#F97316" />
                      }
                    </div>
                    <div style={{
                      fontSize: 'clamp(11px, 2.5vw, 13px)',
                      fontWeight: 700,
                      color: 'var(--text-primary)'
                    }}>
                      {action.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab !== 'dashboard' && (
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
                background: 'var(--accent-blue-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                opacity: 0.6
              }}>
                {tabs.find(t => t.key === activeTab)?.label === 'Usuários' && <IconJogador size={26} color="#2563EB" />}
                {tabs.find(t => t.key === activeTab)?.label === 'Cidades' && <IconLocalizacao size={26} color="#F97316" />}
                {tabs.find(t => t.key === activeTab)?.label === 'Jogadores' && <IconBasquete size={26} color="#F97316" />}
                {tabs.find(t => t.key === activeTab)?.label === 'Torneios' && <IconTrofeu size={26} color="#2563EB" />}
                {tabs.find(t => t.key === activeTab)?.label === 'Notificações' && <IconNotificacao size={26} color="#F97316" />}
                {tabs.find(t => t.key === activeTab)?.label === 'Relatórios' && <IconEstatisticas size={26} color="#2563EB" />}
                {tabs.find(t => t.key === activeTab)?.label === 'Logs' && <IconEstatisticas size={26} color="#F97316" />}
              </div>
              <h3 style={{
                fontSize: 'clamp(14px, 3.5vw, 16px)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 6
              }}>
                {tabs.find(t => t.key === activeTab)?.label || activeTab}
              </h3>
              <p style={{
                fontSize: 'clamp(11px, 2.5vw, 13px)',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                maxWidth: 280
              }}>
                Esta seção será implementada em breve.
              </p>
            </div>
          )}
        </div>

      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
