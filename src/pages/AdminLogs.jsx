import { useState, useEffect } from 'react';
import { masterAPI } from '../lib/supabase';

const ACTION_LABELS = {
  set_role: 'Alterou role',
  suspend_user: 'Suspendeu usuário',
  activate_user: 'Ativou usuário',
  delete_user: 'Excluiu usuário',
  global_notification: 'Enviou notificação global',
  delete_tournament: 'Excluiu torneio',
  close_tournament: 'Encerrou torneio',
  activate_player: 'Ativou jogador',
  suspend_player: 'Suspendeu jogador',
};

function formatDate(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const LogIcon = ({ action }) => {
  const color = {
    set_role: 'var(--accent)',
    suspend_user: '#EF4444',
    activate_user: '#10B981',
    delete_user: '#EF4444',
    global_notification: 'var(--accent)',
    delete_tournament: '#EF4444',
    close_tournament: 'var(--accent)',
    activate_player: '#10B981',
    suspend_player: '#EF4444',
  }[action] || '#64748B';

  return (
    <div style={{
      width: 36,
      height: 36,
      borderRadius: 10,
      background: `${color}15`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {action === 'delete_user' || action === 'delete_tournament' ? (
          <>
            <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </>
        ) : action === 'set_role' ? (
          <>
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </>
        ) : action === 'global_notification' ? (
          <>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </>
        ) : action === 'close_tournament' ? (
          <>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </>
        ) : (
          <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
          </>
        )}
      </svg>
    </div>
  );
};

export default function AdminLogs({ profile, onNavigate }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const { data, error } = await masterAPI.getLogs(100);
      if (!error && data) setLogs(data);
    } catch (e) {
      console.error('Erro ao carregar logs:', e);
    }
    setLoading(false);
  }

  return (
    <div className="page-content">
      <div style={{ padding: 'clamp(12px, 3vw, 20px) clamp(14px, 3vw, 20px) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => onNavigate('master')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20, margin: 0 }}>Logs de Admin</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
              {logs.length} registros
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
            <div className="spinner" />
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 48, height: 48 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <h3>Nenhum log encontrado</h3>
            <p>As ações dos administradores aparecerão aqui.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 30 }}>
            {logs.map((log, i) => (
              <div
                key={log.id || i}
                className="card card-enter"
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  animationDelay: `${i * 30}ms`,
                }}
              >
                <LogIcon action={log.action} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {ACTION_LABELS[log.action] || log.action}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {log.admin_email || 'Desconhecido'}
                    {log.target_name && (
                      <> &middot; {log.target_name}</>
                    )}
                  </div>
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}>
                  {formatDate(log.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
