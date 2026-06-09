import { useState, useEffect, useMemo } from 'react';
import { masterAPI } from '../lib/supabase';
import { IconVoltar, IconBuscar, IconLixeira } from '../components/Icons';

export default function AdminUsers({ profile, onNavigate }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadUsers(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function loadUsers(searchTerm = '') {
    setLoading(true);
    const { data, error } = await masterAPI.getUsers(searchTerm);
    if (error) {
      console.error(error);
      showToast('Erro ao carregar usuários', 'error');
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleToggleRole(user) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setActionLoading(user.id);
    const { error } = await masterAPI.setRole(user.id, newRole);
    setActionLoading(null);
    if (error) {
      showToast('Erro ao alterar papel', 'error');
    } else {
      showToast(`Papel alterado para ${newRole}`);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    }
  }

  async function handleToggleActive(user) {
    const newActive = user.ativo === false || user.ativo === 0 ? true : false;
    setActionLoading(user.id);
    const { error } = await masterAPI.toggleActive(user.id, newActive);
    setActionLoading(null);
    if (error) {
      showToast('Erro ao alterar status', 'error');
    } else {
      showToast(newActive ? 'Conta ativada' : 'Conta suspensa');
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ativo: newActive } : u));
    }
  }

  async function handleDelete(userId) {
    setActionLoading(userId);
    const { error } = await masterAPI.deleteUser(userId);
    setActionLoading(null);
    setConfirmDelete(null);
    if (error) {
      showToast('Erro ao excluir usuário', 'error');
    } else {
      showToast('Usuário excluído');
      setUsers(prev => prev.filter(u => u.id !== userId));
    }
  }

  function isOnline(lastSeen) {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 5 * 60 * 1000;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  const filtered = useMemo(() => {
    if (!search) return users;
    const s = search.toLowerCase();
    return users.filter(u =>
      (u.nome_completo || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.cidade || '').toLowerCase().includes(s)
    );
  }, [users, search]);

  if (loading) {
    return (
      <div className="page-content" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div className="skeleton skeleton-avatar" style={{ width: 40, height: 40 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton skeleton-bar" style={{ width: '60%', height: 16 }} />
            <div className="skeleton skeleton-bar" style={{ width: '40%', height: 12 }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(idx => (
            <div key={idx} className="skeleton" style={{ height: 80, borderRadius: '12px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: '20px 20px 0' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => onNavigate('master')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-blue)',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'inherit'
            }}
          >
            <IconVoltar size={22} color="var(--accent-blue)" />
          </button>
          <div>
            <h2 style={{
              fontWeight: 800,
              fontSize: 'clamp(16px, 4vw, 20px)',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Gerenciar Usuários
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 2 }}>
              {filtered.length} usuário{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none'
          }}>
            <IconBuscar size={18} color="var(--text-muted)" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nome, email ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              paddingLeft: 40,
              paddingRight: 16,
              borderRadius: 50,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 'clamp(13px, 3vw, 15px)',
              padding: '12px 16px 12px 40px'
            }}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="8" r="5" />
              <path d="M20 21a8 8 0 0 0-16 0" />
            </svg>
            <h3>Nenhum usuário encontrado</h3>
            <p>Tente buscar com outros termos.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
            {filtered.map((user, index) => {
              const online = isOnline(user.last_seen);
              const isSuspended = user.ativo === false || user.ativo === 0;
              const isAdmin = user.role === 'admin';
              const isLoading = actionLoading === user.id;

              return (
                <div
                  key={user.id}
                  className="card card-enter"
                  style={{
                    padding: 'clamp(12px, 3vw, 16px)',
                    borderRadius: 14,
                    opacity: isSuspended ? 0.6 : 1,
                    animationDelay: `${index * 30}ms`,
                    position: 'relative'
                  }}
                >
                  {isLoading && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 5
                    }}>
                      <div className="spinner" />
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: isAdmin
                        ? 'linear-gradient(135deg, #F97316 0%, #EAB308 100%)'
                        : 'var(--accent-blue-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isAdmin ? '#fff' : 'var(--accent-blue-light)',
                      fontWeight: 800,
                      fontSize: 16,
                      flexShrink: 0
                    }}>
                      {(user.nome_completo || user.email || '?')[0]?.toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'clamp(13px, 3vw, 15px)',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {user.nome_completo || 'Sem nome'}
                      </div>
                      <div style={{
                        fontSize: 'clamp(11px, 2.5vw, 12px)',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {user.email}
                      </div>
                      <div style={{
                        fontSize: 'clamp(10px, 2vw, 11px)',
                        color: 'var(--text-muted)',
                        marginTop: 2
                      }}>
                        {user.cidade || '--'} {user.uf ? `- ${user.uf}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: online ? '#22c55e' : '#ef4444',
                          boxShadow: online ? '0 0 6px rgba(34,197,94,0.5)' : 'none'
                        }} />
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: online ? '#22c55e' : '#ef4444'
                        }}>
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: 50,
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background: isAdmin ? 'rgba(249,115,22,0.12)' : 'var(--accent-blue-dim)',
                        color: isAdmin ? '#F97316' : 'var(--accent-blue-light)',
                        border: isAdmin ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(37,99,235,0.2)'
                      }}>
                        {user.role || 'user'}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginBottom: 10,
                    fontSize: 11,
                    color: 'var(--text-muted)'
                  }}>
                    <span>
                      Criado: {formatDate(user.created_at)}
                    </span>
                    {user.last_seen && (
                      <>
                        <span style={{ opacity: 0.4 }}>|</span>
                        <span>
                          Último acesso: {formatDate(user.last_seen)}
                        </span>
                      </>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap'
                  }}>
                    <button
                      onClick={() => handleToggleRole(user)}
                      disabled={isLoading}
                      style={{
                        flex: '1 1 auto',
                        minWidth: 'clamp(80px, 25vw, 110px)',
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: isAdmin ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(37,99,235,0.2)',
                        background: isAdmin ? 'rgba(249,115,22,0.08)' : 'var(--accent-blue-dim)',
                        color: isAdmin ? '#F97316' : 'var(--accent-blue-light)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        opacity: isLoading ? 0.6 : 1
                      }}
                    >
                      {isAdmin ? 'Rebaixar' : 'Promover'}
                    </button>

                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={isLoading}
                      style={{
                        flex: '1 1 auto',
                        minWidth: 'clamp(80px, 25vw, 110px)',
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: isSuspended ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.2)',
                        background: isSuspended ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                        color: isSuspended ? '#22c55e' : '#f87171',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        opacity: isLoading ? 0.6 : 1
                      }}
                    >
                      {isSuspended ? 'Ativar' : 'Suspender'}
                    </button>

                    <button
                      onClick={() => setConfirmDelete(user.id)}
                      disabled={isLoading}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(239,68,68,0.2)',
                        background: 'rgba(239,68,68,0.08)',
                        color: '#f87171',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isLoading ? 0.6 : 1
                      }}
                    >
                      <IconLixeira size={14} color="#f87171" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(239,68,68,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <IconLixeira size={26} color="#ef4444" />
              </div>
              <h3 style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 6
              }}>
                Excluir usuário?
              </h3>
              <p style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: 20
              }}>
                Essa ação não pode ser desfeita. O usuário e todos os seus dados serão removidos permanentemente.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmDelete(null)}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={actionLoading === confirmDelete}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: 10,
                    border: 'none',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: actionLoading === confirmDelete ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: actionLoading === confirmDelete ? 0.6 : 1
                  }}
                >
                  {actionLoading === confirmDelete ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
