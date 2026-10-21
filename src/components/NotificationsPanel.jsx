import { memo, useEffect, useMemo, useState } from 'react';
import {
  IconSino,
  IconVoltar,
  IconAvaliar,
  IconTrofeu,
  IconPlacar,
  IconBasquete,
  IconJogador,
  IconLocalizacao,
  IconNotificacao,
} from './Icons';
import { notificacoesAPI, partidasAPI } from '../lib/supabase';

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

function formatFull(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function IconForTitle({ titulo = '', size = 18, color = 'var(--accent)' }) {
  const t = titulo.toLowerCase();
  if (t.includes('avalia')) return <IconAvaliar size={size} color={color} />;
  if (t.includes('torneio') || t.includes('campe')) return <IconTrofeu size={size} color={color} />;
  if (t.includes('placar') || t.includes('operar')) return <IconPlacar size={size} color={color} />;
  if (t.includes('jogo') || t.includes('partida') || t.includes('compet')) return <IconBasquete size={size} color={color} />;
  if (t.includes('rach') || t.includes('pickup')) return <IconJogador size={size} color={color} />;
  if (t.includes('cidade') || t.includes('local')) return <IconLocalizacao size={size} color={color} />;
  return <IconNotificacao size={size} color={color} />;
}

/** Destino sugerido a partir do título/mensagem */
function destinoPara(n) {
  const t = `${n?.titulo || ''} ${n?.mensagem || ''}`.toLowerCase();
  if (t.includes('placar') || t.includes('operar') || t.includes('partida') || t.includes('compet')) {
    return { page: 'jogos', label: 'Abrir Competições' };
  }
  if (t.includes('torneio') || t.includes('campeonato') || t.includes('equipe')) {
    return { page: 'torneios', label: 'Abrir Torneios' };
  }
  if (t.includes('rach')) {
    return { page: 'racoes', label: 'Abrir Rachões' };
  }
  if (t.includes('avalia') || t.includes('ranking') || t.includes('atleta')) {
    return { page: 'atletas', label: 'Abrir Atletas' };
  }
  return null;
}

function isPlacarNotif(n) {
  const t = `${n?.titulo || ''} ${n?.mensagem || ''}`.toLowerCase();
  return t.includes('placar') || t.includes('operar o placar') || t.includes('operador');
}

function NotificationsPanel({
  open,
  onClose,
  notificacoes = [],
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onRefresh,
  onAbrirJogos,
  onNavigate,
}) {
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [selected, setSelected] = useState(null); // notificação aberta em detalhe
  const [pedidos, setPedidos] = useState([]);
  const [respondendo, setRespondendo] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      return;
    }
    let vivo = true;
    const carregar = async () => {
      try {
        const { data } = await partidasAPI.listarPedidosPendentes();
        if (vivo) setPedidos(Array.isArray(data) ? data : []);
      } catch (_) {
        if (vivo) setPedidos([]);
      }
    };
    carregar();
    const t = setInterval(carregar, 5000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [open]);

  // Se a notificação selecionada sumiu da lista, fecha o detalhe
  useEffect(() => {
    if (!selected) return;
    const still = notificacoes.some((n) => n.id === selected.id);
    if (!still) setSelected(null);
    else {
      const fresh = notificacoes.find((n) => n.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [notificacoes, selected?.id]);

  const unreadCount = useMemo(
    () => (notificacoes || []).filter((n) => !n.lida).length,
    [notificacoes]
  );

  const list = useMemo(() => {
    const all = Array.isArray(notificacoes) ? notificacoes : [];
    if (filter === 'unread') return all.filter((n) => !n.lida);
    return all;
  }, [notificacoes, filter]);

  if (!open) return null;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleRead(id) {
    if (!id) return;
    setBusyId(id);
    try {
      if (onMarkRead) await onMarkRead(id);
      else await notificacoesAPI.marcarComoLida(id);
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpen(n) {
    setSelected(n);
    if (!n.lida) {
      await handleRead(n.id);
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      if (onDelete) await onDelete(id);
      else {
        await notificacoesAPI.excluir(id);
        if (onRefresh) onRefresh();
      }
      if (selected?.id === id) setSelected(null);
    } finally {
      setDeleting(null);
    }
  }

  async function handleResponder(pedido, aceitar) {
    const chave = `${pedido.partida_id}:${pedido.usuario_id}`;
    setRespondendo(chave);
    try {
      const { error } = await partidasAPI.responderPedidoOperador(
        pedido.partida_id,
        pedido.usuario_id,
        aceitar
      );
      if (error) {
        showToast(error.message || 'Não foi possível responder');
        return;
      }
      setPedidos((prev) => prev.filter((p) => `${p.partida_id}:${p.usuario_id}` !== chave));
      showToast(aceitar ? 'Pedido aceito' : 'Pedido recusado');
    } finally {
      setRespondendo(null);
    }
  }

  function goTo(page) {
    if (onNavigate) onNavigate(page);
    else if (page === 'jogos' && onAbrirJogos) onAbrirJogos();
    onClose?.();
  }

  // ---------- DETALHE ----------
  if (selected) {
    const dest = destinoPara(selected);
    const placar = isPlacarNotif(selected);

    return (
      <div className="modal-overlay notif-overlay" onClick={onClose}>
        <div className="modal-sheet notif-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-handle" />

          <div className="notif-header">
            <div className="notif-header-left">
              <button
                type="button"
                className="notif-back"
                onClick={() => setSelected(null)}
                aria-label="Voltar"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginRight: 4 }}
              >
                <IconVoltar size={16} color="var(--accent)" />
              </button>
              <div className="notif-header-icon"><IconForTitle titulo={selected.titulo} size={20} /></div>
              <div>
                <h3 className="notif-title">Detalhe</h3>
                <p className="notif-subtitle">{formatFull(selected.created_at)}</p>
              </div>
            </div>
          </div>

          <div className="notif-detail" style={{ flex: 1, overflowY: 'auto', padding: '4px 4px 12px' }}>
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 16,
                marginBottom: 14 }}
            >
              <div style={{ fontSize: 22, marginBottom: 10 }}><IconForTitle titulo={selected.titulo} size={20} /></div>
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: 8,
                  lineHeight: 1.25 }}
              >
                {selected.titulo}
              </h2>
              <p
                style={{
                  fontSize: 15,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word' }}
              >
                {selected.mensagem || 'Sem mensagem adicional.'}
              </p>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontWeight: 600 }}
              >
                {selected.lida ? 'Lida' : 'Marcada como lida'} · {timeAgo(selected.created_at)}
              </div>
            </div>

            {/* Aceitar / recusar operador de placar */}
            {placar && (
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em' }}
                >
                  Pedidos de placar
                </div>
                {pedidos.length === 0 ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent-line)',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4 }}
                  >
                    Nenhum pedido pendente agora. Você pode abrir Competições para ver o placar.
                  </div>
                ) : (
                  pedidos.map((p) => {
                    const chave = `${p.partida_id}:${p.usuario_id}`;
                    const ocupado = respondendo === chave;
                    return (
                      <div
                        key={chave}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          marginBottom: 8 }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                          {p.nome || 'Alguém'} quer operar o placar
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1 }}
                            disabled={ocupado}
                            onClick={() => handleResponder(p, true)}
                          >
                            {ocupado ? '...' : 'Aceitar'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1 }}
                            disabled={ocupado}
                            onClick={() => handleResponder(p, false)}
                          >
                            Recusar
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dest && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => goTo(dest.page)}
                >
                  {dest.label}
                </button>
              )}
              {!dest && placar && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => goTo('jogos')}
                >
                  Abrir Competições
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', color: '#f87171' }}
                disabled={deleting === selected.id}
                onClick={() => handleDelete(selected.id)}
              >
                {deleting === selected.id ? 'Excluindo...' : 'Excluir notificação'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSelected(null)}>
                Voltar à lista
              </button>
            </div>
          </div>

          {toast && (
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                left: 16,
                right: 16,
                padding: '8px 12px',
                borderRadius: 12,
                background: 'rgba(12,12,20,0.95)',
                border: '1px solid var(--accent-line)',
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 700,
                textAlign: 'center' }}
            >
              {toast}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- LISTA ----------
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
                  ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''} · toque para abrir`
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
                Você será avisado sobre avaliações, placar, torneios e avisos do sistema.
              </p>
            </div>
          ) : (
            list.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`notif-item ${n.lida ? 'is-read' : 'is-unread'}`}
                onClick={() => handleOpen(n)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: undefined }}
              >
                <div className="notif-item-icon"><IconForTitle titulo={n.titulo} size={18} /></div>
                <div className="notif-item-body">
                  <div className="notif-item-top">
                    <span className="notif-item-title">{n.titulo}</span>
                    <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="notif-item-msg">
                    {n.mensagem
                      ? n.mensagem.length > 100
                        ? `${n.mensagem.slice(0, 100)}…`
                        : n.mensagem
                      : 'Toque para ver detalhes'}
                  </p>
                  {isPlacarNotif(n) && pedidos.length > 0 && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--accent)' }}
                    >
                      {pedidos.length} pedido{pedidos.length > 1 ? 's' : ''} para aceitar →
                    </span>
                  )}
                </div>
                {!n.lida && <span className="notif-dot" />}
              </button>
            ))
          )}
        </div>

        <button type="button" className="btn btn-secondary notif-close" onClick={onClose}>
          Fechar
        </button>

        {toast && (
          <div
            style={{
              position: 'absolute',
              bottom: 72,
              left: 16,
              right: 16,
              padding: '8px 12px',
              borderRadius: 12,
              background: 'rgba(12,12,20,0.95)',
              border: '1px solid var(--accent-line)',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center' }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(NotificationsPanel);
