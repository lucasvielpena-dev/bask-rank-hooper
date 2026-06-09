import { memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { IconMenu, IconSino } from './Icons';

export default memo(function Header() {
  const { profile, notificacoes, setShowUserMenu, setShowNotificacoes } = useAuth();

  return (
    <header className="app-header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border)'
    }}>
      <button
        onClick={() => setShowUserMenu(true)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <IconMenu size={22} color="var(--text-primary)" />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 900,
          fontSize: '15px',
          letterSpacing: '0.08em',
          color: 'var(--text-primary)',
          textTransform: 'uppercase'
        }}>
          RANK <span style={{ color: '#60A5FA' }}>HOOPER</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setShowNotificacoes(true)}>
          <IconSino size={22} color="#F8FAFC" />
          {notificacoes.filter(n => !n.lida).length > 0 && (
            <span style={{
              position: 'absolute',
              top: -2,
              right: -2,
              background: '#F97316',
              color: '#FFF',
              fontSize: '8px',
              fontWeight: 800,
              width: 13,
              height: 13,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid var(--bg-primary)'
            }}>
              {notificacoes.filter(n => !n.lida).length}
            </span>
          )}
        </div>

        <div
          onClick={() => setShowUserMenu(true)}
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          {profile.foto_perfil ? (
            <img
              src={profile.foto_perfil}
              alt="Avatar"
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>
              {profile.nome_completo?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
});
