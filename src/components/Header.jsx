import { memo, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEsporte } from '../contexts/EsporteContext';
import { IconSino, IconSportDynamic } from './Icons';

export default memo(function Header() {
  const { profile, notificacoes, setShowUserMenu, setShowNotificacoes } = useAuth();
  const { esporte } = useEsporte();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const unread = (notificacoes || []).filter((n) => !n.lida).length;

  return (
    <header
      className="app-header"
      style={{
        boxShadow: scrolled ? '0 8px 28px rgba(0,0,0,0.35)' : 'none' }}
    >
      {/* Logo + marca (sem menu de três linhas à esquerda) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <div className="header-logo-icon">
          <IconSportDynamic sport={esporte} size={17} color="var(--accent-on)" />
        </div>
        <div className="header-brand">
          RANK <span style={{ color: 'var(--accent)' }}>HOOPER</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="header-icon-btn"
          style={{ position: 'relative' }}
          onClick={() => setShowNotificacoes(true)}
          aria-label="Notificações"
        >
          <IconSino size={18} color="var(--text-primary)" />
          {unread > 0 && (
            <span className="header-notif-badge">{unread > 9 ? '9+' : unread}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowUserMenu(true)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
          aria-label="Perfil e menu"
        >
          {profile?.foto_perfil ? (
            <img src={profile.foto_perfil} alt="" className="header-avatar" />
          ) : (
            <div
              className="header-avatar"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                fontWeight: 800,
                fontSize: 13 }}
            >
              {(profile?.nome_completo || profile?.apelido || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </button>
      </div>
    </header>
  );
});
