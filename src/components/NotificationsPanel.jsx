import { memo, useMemo, useState } from 'react';
import { IconSino } from './Icons';
import { notificacoesAPI } from '../lib/supabase';

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function iconForTitle(titulo = '') {
  const t = titulo.toLowerCase();
  if (t.includes('avalia')) return '⭐';
  if (t.includes('torneio') || t.includes('campe')) return '🏆';
  if (t.includes('jogo') || t.includes('partida')) return '🏀';
  if (t.includes('bem-vindo') || t.includes('boas')) return '👋';
  return '🔔';
}

function NotificationsPanel({
  open,
  onClose,
  notificacoes = [],
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onRefresh,
}) {
  const [filter, setFilter] = useState('all'); // all | unread
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const unreadCount = useMemo(
    () => notificacoes.filter((n) => !n.lida).length,
    [notificacoes]
  );

  const list = useMemo(() => {
    if (filter === 'unread') return notificacoes.filter((n) => !n.lida);
    return notificacoes;
  }, [notificacoes, filter]);

  if (!open) return null;

  async function handleDelete(id) {
    setDeleting(id);
    try {
      if (onDelete) await onDelete(id);
      else {
        await notificacoesAPI.excluir(id);
        if (onRefresh) onRefresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  async function handleRead(id) {
    setBusyId(id);
    try {
      await onMarkRead(id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="modal-overlay notif-overlay" onClick={onClose}>
      <div className="modal-sheet notif-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        <div className="notif-header">
          <div className="notif-header-left">
            <div className="notif-header-icon">
              <IconSino size={18} color="var(--accent)" />
            </div>
            <div>
              <h3 className="notif-title">Notificações</h3>
              <p className="notif-subtitle">
                {unreadCount > 0
                  ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
                  : 'Tudo em dia'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button type="button" className="notif-mark-all" onClick={onMarkAllRead}>
              Marcar todas
            </button>
          )}
        </div>

        <div className="notif-filters">
          <button
            type="button"
            className={`notif-filter ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todas
          </button>
          <button
            type="button"
            className={`notif-filter ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Não lidas
            {unreadCount > 0 && <span className="notif-filter-badge">{unreadCount}</span>}
          </button>
        </div>

        <div className="notif-list">
          {list.length === 0 ? (
            <div className="notif-empty">
              <div className="notif-empty-icon">
                <IconSino size={36} color="currentColor" />
              </div>
              <p className="notif-empty-title">
                {filter === 'unread' ? 'Nenhuma não lida' : 'Nenhuma notificação'}
              </p>
              <p className="notif-empty-text">
                Você será avisado quando receber avaliações, novidades de torneios e avisos do sistema.
              </p>
            </div>
          ) : (
            list.map((n) => (
              <div
                key={n.id}
                className={`notif-item ${n.lida ? 'is-read' : 'is-unread'}`}
                onClick={() => !n.lida && handleRead(n.id)}
              >
                <div className="notif-item-icon">{iconForTitle(n.titulo)}</div>
                <div className="notif-item-body">
                  <div className="notif-item-top">
                    <span className="notif-item-title">{n.titulo}</span>
                    <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="notif-item-msg">{n.mensagem}</p>
                  {/* Onde responder: sem esta dica o aviso era um beco sem saída. */}
                  {/placar compartilhado/i.test(n.titulo) && (
                    <p className="notif-item-msg" style={{ color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>
                      → Abra Rachões → Jogos da Noite para aceitar ou recusar.
                    </p>
                  )}
                  <div className="notif-item-actions">
                    {!n.lida && (
                      <button
                        type="button"
                        className="notif-action primary"
                        disabled={busyId === n.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRead(n.id);
                        }}
                      >
                        {busyId === n.id ? '...' : 'Marcar lida'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="notif-action danger"
                      disabled={deleting === n.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(n.id);
                      }}
                    >
                      {deleting === n.id ? '...' : 'Excluir'}
                    </button>
                  </div>
                </div>
                {!n.lida && <span className="notif-dot" />}
              </div>
            ))
          )}
        </div>

        <button type="button" className="btn btn-secondary notif-close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}

export default memo(NotificationsPanel);
