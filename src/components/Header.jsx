import { memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { IconMenu, IconSino } from './Icons';

export default memo(function Header() {
  const { profile, notificacoes, setShowUserMenu, setShowNotificacoes } = useAuth();

  return (
    <header className="app-header">
      <button
        onClick={() => setShowUserMenu(true)}
        style={{ background:'none', border:'none', color:'var(--text-primary)', cursor:'pointer', padding:4, display:'flex', alignItems:'center', justifyContent:'center' }}
      >
        <IconMenu size={22} color="var(--text-primary)" />
      </button>

      <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, justifyContent:'center' }}>
        <div className="header-logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A1018" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a14.5 14.5 0 0 1 0 20"/>
            <path d="M2 12h20"/>
          </svg>
        </div>
        <div style={{ fontFamily:"'Oswald',sans-serif", fontWeight:700, fontSize:'16px', letterSpacing:'0.08em', color:'var(--text-primary)', textTransform:'uppercase' }}>
          RANK <span style={{ color:'var(--accent)' }}>HOOPER</span>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ position:'relative', cursor:'pointer', display:'flex', alignItems:'center' }} onClick={() => setShowNotificacoes(true)}>
          <IconSino size={22} color="var(--text-primary)" />
          {notificacoes.filter(n => !n.lida).length > 0 && (
            <span style={{ position:'absolute', top:-2, right:-2, background:'var(--accent)', color:'#0A1018', fontSize:'8px', fontWeight:800, width:14, height:14, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid var(--bg-primary)' }}>
              {notificacoes.filter(n => !n.lida).length}
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
