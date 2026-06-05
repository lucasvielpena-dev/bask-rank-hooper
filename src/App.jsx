import { useState, useEffect } from 'react';
import { supabase, authAPI, profilesAPI } from './lib/supabase';
import './styles/global.css';

import Home from './pages/Home';
import Ranking from './pages/Ranking';
import Jogadores from './pages/Jogadores';
import Votar from './pages/Votar';
import Jogos from './pages/Jogos';
import Stats from './pages/Stats';

import AuthScreen from './components/AuthScreen';
import CompleteProfileScreen from './components/CompleteProfileScreen';

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
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // States para edição do perfil
  const [editApelido, setEditApelido] = useState('');
  const [editAltura, setEditAltura] = useState('');
  const [editIdade, setEditIdade] = useState('');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        loadProfile(user.id);
      } else {
        setProfile(null);
        setLoadingProfile(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u.id);
      } else {
        setProfile(null);
        setLoadingProfile(false);
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile(uid, retries = 0) {
    try {
      const { data } = await profilesAPI.obterPerfil(uid);
      if (data) {
        setProfile(data);
        setEditApelido(data.apelido || '');
        setEditAltura(data.altura || '');
        setEditIdade(data.idade || '');
        setLoadingProfile(false);
      } else if (retries < 3) {
        // Se o trigger do Supabase ainda não completou a inserção, tenta novamente em 1s
        setTimeout(() => loadProfile(uid, retries + 1), 1000);
      } else {
        // Fallback: criar perfil no front-end caso o trigger do banco não tenha rodado
        const fallbackProfile = {
          id: uid,
          nome_completo: user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email || 'Jogador',
          email: user?.email,
          foto_perfil: user?.user_metadata?.avatar_url || null,
          cadastro_completo: false
        };
        
        const { data: createdData } = await supabase
          .from('profiles')
          .insert([fallbackProfile])
          .select()
          .single();

        if (createdData) {
          setProfile(createdData);
          setEditApelido(createdData.apelido || '');
          setEditAltura(createdData.altura || '');
          setEditIdade(createdData.idade || '');
        } else {
          setProfile(fallbackProfile);
        }
        setLoadingProfile(false);
      }
    } catch (e) {
      console.error(e);
      setLoadingProfile(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSalvandoPerfil(true);
    setErroPerfil(null);

    const parsedAltura = parseFloat(editAltura);
    const parsedIdade = parseInt(editIdade);

    try {
      if (!editApelido.trim()) {
        throw new Error('Por favor, informe seu apelido.');
      }
      if (isNaN(parsedAltura) || parsedAltura <= 0 || parsedAltura > 3) {
        throw new Error('Por favor, informe uma altura válida (ex: 1.85).');
      }
      if (isNaN(parsedIdade) || parsedIdade <= 0 || parsedIdade > 120) {
        throw new Error('Por favor, informe uma idade válida.');
      }

      const { data, error } = await profilesAPI.atualizar(profile.id, {
        apelido: editApelido.trim(),
        altura: parsedAltura,
        idade: parsedIdade
      });

      if (error) throw error;
      setProfile(data);
      setIsEditingProfile(false);
    } catch (err) {
      setErroPerfil(err.message || 'Erro ao salvar alterações.');
    } finally {
      setSalvandoPerfil(false);
    }
  }

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

  // 1. Fluxo de Carregamento
  if (user && loadingProfile) {
    return (
      <div className="app-shell" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="loading"><div className="spinner" />Carregando perfil...</div>
      </div>
    );
  }

  // 2. Fluxo: Sem autenticação -> Bloquear acesso total
  if (!user) {
    return <AuthScreen />;
  }

  // 3. Fluxo: Autenticado mas sem cadastro completo -> Bloquear e exigir preenchimento
  if (!profile || !profile.cadastro_completo) {
    return (
      <CompleteProfileScreen 
        profile={profile} 
        onComplete={(updatedProfile) => {
          setProfile(updatedProfile);
          setEditApelido(updatedProfile.apelido || '');
          setEditAltura(updatedProfile.altura || '');
          setEditIdade(updatedProfile.idade || '');
        }} 
      />
    );
  }

  // 4. Fluxo: Acesso total liberado
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
        
        <div 
          onClick={() => setShowUserMenu(true)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          {profile.foto_perfil ? (
            <img 
              src={profile.foto_perfil} 
              alt="Avatar" 
              style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)' }} 
            />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>
              {profile.nome_completo?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
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

      {/* Modal Menu Usuário / Meu Perfil */}
      {showUserMenu && user && profile && (
        <div className="modal-overlay" onClick={() => { if (!salvandoPerfil) { setShowUserMenu(false); setIsEditingProfile(false); } }}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, textAlign: 'center' }}>
              {isEditingProfile ? 'Editar Perfil' : 'Meu Perfil'}
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              {isEditingProfile ? 'Atualize suas informações pessoais' : 'Informações do seu perfil de atleta'}
            </p>

            {erroPerfil && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                color: '#f87171',
                padding: '10px 14px',
                fontSize: 13,
                marginBottom: 16
              }}>
                ⚠️ {erroPerfil}
              </div>
            )}

            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Apelido *
                  </label>
                  <input
                    required
                    type="text"
                    value={editApelido}
                    onChange={(e) => setEditApelido(e.target.value)}
                    placeholder="Ex: DD, Viel..."
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Altura (m) *
                    </label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.5"
                      max="3"
                      value={editAltura}
                      onChange={(e) => setEditAltura(e.target.value)}
                      placeholder="Ex: 1.85"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Idade *
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="120"
                      value={editIdade}
                      onChange={(e) => setEditIdade(e.target.value)}
                      placeholder="Ex: 25"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => { setIsEditingProfile(false); setErroPerfil(null); }}
                    style={{ flex: 1 }}
                    disabled={salvandoPerfil}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ flex: 2 }}
                    disabled={salvandoPerfil}
                  >
                    {salvandoPerfil ? <div className="spinner" /> : 'Salvar'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)' }}>
                  {profile.foto_perfil ? (
                    <img 
                      src={profile.foto_perfil} 
                      alt="Avatar" 
                      style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border)' }} 
                    />
                  ) : (
                    <div className="avatar">
                      {profile.nome_completo?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <div style={{ fontWeight: 700 }}>{profile.nome_completo}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{profile.email}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="card" style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>APELIDO</div>
                    <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: 14 }}>{profile.apelido}</div>
                  </div>
                  <div className="card" style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>ALTURA</div>
                    <div style={{ fontWeight: 800, color: '#60a5fa', fontSize: 14 }}>{Number(profile.altura).toFixed(2)}m</div>
                  </div>
                  <div className="card" style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>IDADE</div>
                    <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: 14 }}>{profile.idade} anos</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setIsEditingProfile(true)}
                    style={{ flex: 1 }}
                  >
                    Editar Perfil
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={async () => {
                      await authAPI.logout();
                      setShowUserMenu(false);
                    }}
                    style={{ flex: 1, color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
                  >
                    Sair da Conta
                  </button>
                </div>

                <button className="btn btn-primary" onClick={() => setShowUserMenu(false)}>
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
