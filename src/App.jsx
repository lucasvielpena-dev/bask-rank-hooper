import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import './styles/global.css';

import Home from './pages/Home';
import Ranking from './pages/Ranking';
import Jogadores from './pages/Jogadores';
import Votar from './pages/Votar';
import Jogos from './pages/Jogos';
import Stats from './pages/Stats';

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
      case 'jogadores': return <Jogadores initialOpenAdd={pageProps.openAdd} />;
      case 'votar': return <Votar />;
      case 'jogos': return <Jogos />;
      case 'stats': return <Stats />;
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
        {user && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>
              {user.email?.charAt(0).toUpperCase()}
            </div>
          </div>
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
    </div>
  );
}
