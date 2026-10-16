import { memo, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEsporte } from '../contexts/EsporteContext';
import { IconMenu, IconSino, IconSportDynamic } from './Icons';

export default memo(function Header() {
  const { profile, notificacoes, setShowUserMenu, setShowNotificacoes } = useAuth();
  const { esporte } = useEsporte();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="app-header" style={{
      boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.35)' : '0 1px 0 rgba(255,255,255,0.04)',
      transition: 'box-shadow 0.3s ease'
    }}>
      <button
        onClick={() => setShowUserMenu(true)}
        style={{ background:'none', border:'none', color:'var(--text-primary)', cursor:'pointer', padding:4, display:'flex', alignItems:'center', justifyContent:'center' }}
      >
        <IconMenu size={22} color="var(--text-primary)" />
      </button>

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, flex:1, justifyContent:'center', transition: 'opacity 0.2s ease' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div className="header-logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconSportDynamic sport={esporte} size={18} color="#0C0C14" />
          </div>
          <div style={{ fontFamily:"'Oswald',sans-serif", fontWeight:700, fontSize:'16px', letterSpacing:'0.08em', color:'var(--text-primary)', textTransform:'uppercase' }}>
            RANK <span style={{ color:'var(--accent)' }}>HOOPER</span>
          </div>
        </div>
        
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ position:'relative', cursor:'pointer', display:'flex', alignItems:'center' }} onClick={() => setShowNotificacoes(true)}>
          <IconSino size={22} color="var(--text-primary)" />
          {notificacoes.filter(n => !n.lida).length > 0 && (
            <span className="header-notif-badge">
              {notificacoes.filter(n => !n.lida).length > 9 ? '9+' : notificacoes.filter(n => !n.lida).length}
            </span>
          )}
        </div>

        <div onClick={() => setShowUserMenu(true)} style={{ display:'flex', alignItems:'center', cursor:'pointer' }}>
          {profile.foto_perfil ? (
            <img src={profile.foto_perfil} alt="Avatar" style={{ width:32, height:32, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.12)', objectFit:'cover' }} />
          ) : (
            <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'var(--accent)' }}>
              {profile.nome_completo?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
});

