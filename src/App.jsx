import { useState, useEffect } from 'react';
import { supabase, authAPI } from './lib/supabase';
import './styles/global.css';

import Home from './pages/Home';
import Ranking from './pages/Ranking';
import Jogadores from './pages/Jogadores';
import Votar from './pages/Votar';
import Jogos from './pages/Jogos';
import Stats from './pages/Stats';
import AuthModal from './components/AuthModal';

const PAGES = {
  inicio: { label: 'Início', icon: 'home' },
  ranking: { label: 'Ranking', icon: 'trophy' },
  jogadores: { label: 'Jogadores', icon: 'users' },
  votar: { label: 'Votar', icon: 'star' },
  jogos: { label: 'Jogos', icon: 'moon' },
  stats: { label: 'Stats', icon: 'bar' },
};

function NavIcon({ type, active }) {
  const color = active ? '#60a5fa' : '#64748b';
  const s = { width: 20, height: 20 };
  if (type === 'home') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if (type === 'trophy') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;
  if (type === 'users') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (type === 'star') return <svg {...s} viewBox="0 0 24 24" fill={active ? '#60a5fa' : 'none'} stroke={color} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
  if (type === 'moon') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
  if (type === 'bar') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
  return null;
}

export default function App() {
  const [page, setPage] = useState('inicio');
  const [pageProps, setPageProps] = useState({});
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  function navigate(to, props = {}) {
    setPage(to);
    setPageProps(props);
  }

  function renderPage() {
    switch (page) {
      case 'inicio': return <Home onNavigate={navigate} />;
      case 'ranking': return <Ranking />;
      case 'jogadores': return <Jogadores user={user} onOpenLogin={() => setIsAuthOpen(true)} initialOpenAdd={pageProps.openAdd} />;
      case 'votar': return <Votar user={user} onOpenLogin={() => setIsAuthOpen(true)} />;
      case 'jogos': return <Jogos user={user} onOpenLogin={() => setIsAuthOpen(true)} />;
      case 'stats': return <Stats user={user} />;
      default: return <Home onNavigate={navigate} />;
    }
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo-icon">🏆</div>
        <div>
          <div className="header-title">
            Ranks <span>Hoops</span>
          </div>
          <div className="header-subtitle">ALTAMIRA • PARÁ</div>
        </div>
        {user ? (
          <div 
            onClick={() => setShowUserMenu(true)}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>
              {user.user_metadata?.nome?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setIsAuthOpen(true)}
            style={{ 
              marginLeft: 'auto', 
              background: 'var(--accent-blue-dim)', 
              border: '1px solid var(--border)', 
              color: '#60a5fa', 
              padding: '6px 14px', 
              borderRadius: '50px', 
              fontSize: '13px', 
              fontWeight: 600, 
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Entrar
          </button>
        )}
      </header>

      {/* Page */}
      {renderPage()}

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        {Object.entries(PAGES).map(([key, cfg]) => (
          <button
            key={key}
            className={`nav-item ${page === key ? 'active' : ''}`}
            onClick={() => { setPage(key); setPageProps({}); }}
          >
            <NavIcon type={cfg.icon} active={page === key} />
            <span>{cfg.label}</span>
          </button>
        ))}
      </nav>

      {/* Modais de Autenticação */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {showUserMenu && user && (
        <div className="modal-overlay" onClick={() => setShowUserMenu(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, textAlign: 'center' }}>Sua Conta</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              Logado como <strong style={{ color: '#f1f5f9' }}>{user.user_metadata?.nome || user.email}</strong>
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)' }}>
                <div className="avatar">{user.user_metadata?.nome?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <div style={{ fontWeight: 700 }}>{user.user_metadata?.nome || 'Usuário'}</div>
                  <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                </div>
              </div>
              
              <button 
                className="btn btn-secondary" 
                onClick={async () => {
                  await authAPI.logout();
                  setShowUserMenu(false);
                }}
                style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
              >
                Sair da Conta
              </button>
              
              <button className="btn btn-primary" onClick={() => setShowUserMenu(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
