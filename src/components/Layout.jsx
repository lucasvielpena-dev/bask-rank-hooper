import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useEsporte } from '../contexts/EsporteContext';
import Header from './Header';
import BottomNavigation from './BottomNavigation';
import { IconSino, IconLocalizacao } from './Icons';
import NotificationsPanel from './NotificationsPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '../lib/supabase';
import { preloadBackgrounds, backgroundsProntos, aoTerminarBackgrounds } from '../lib/backgrounds';

export default function Layout({ page, onNavigate, children }) {
  const { cfg } = useEsporte();
  const {
    profile,
    user,
    isMaster,
    showUserMenu,
    setShowUserMenu,
    isEditingProfile,
    setIsEditingProfile,
    cityPrompt,
    solicitarLocalizacaoBanner,
    handleConfirmCityUpdate,
    handleRejectCityUpdate,
    showNotificacoes,
    setShowNotificacoes,
    notificacoes,
    handleMarcarLida,
    handleMarcarTodasLidas,
    handleExcluirNotificacao,
    carregarNotificacoes,
    editApelido,
    setEditApelido,
    editPosicao,
    setEditPosicao,
    editAltura,
    editIdade,
    setEditIdade,
    editFoto,
    setEditFoto,
    uploadingFoto,
    salvandoPerfil,
    erroPerfil,
    setErroPerfil,
    handleEditFileChange,
    handleEditAlturaChange,
    handleSaveProfile,
    handleUpdateTheme,
    logout,
  } = useAuth();

  const { themePref, setThemePref } = useTheme();

  // Exclusao de conta (exigencia da Play Store)
  const [showExcluirConta, setShowExcluirConta] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState('');

  async function handleExcluirConta() {
    if (confirmExcluir.trim().toUpperCase() !== 'EXCLUIR') return;
    setExcluindo(true);
    setErroExcluir('');
    const { error } = await authAPI.excluirConta();
    if (error) {
      setExcluindo(false);
      setErroExcluir(error.message || 'Nao foi possivel excluir a conta agora. Tente de novo.');
      return;
    }
    try { await logout(); } catch { /* a sessao ja nao existe */ }
    window.location.reload();
  }

  // Parallax Logic
  // Fundo: quando as imagens vieram pré-carregadas do login, elas aparecem já
  // na primeira pintura (sem o fade de 1,2s chegando depois da tela).
  const [bgLoaded, setBgLoaded] = useState(backgroundsProntos);
  const parallaxRef = useRef(null);
  
  useEffect(() => {
    // Disable parallax if reduced motion is preferred
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (parallaxRef.current) {
            const offset = window.scrollY * 0.3;
            parallaxRef.current.style.transform = `scale(1.05) translateY(${offset}px)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Preload background images (compartilhado com a tela de login)
  useEffect(() => {
    let mounted = true;

    if (backgroundsProntos()) {
      setBgLoaded(true);
      return () => { mounted = false; };
    }

    preloadBackgrounds();
    const cancelar = aoTerminarBackgrounds(() => {
      if (mounted) setBgLoaded(true);
    });

    return () => { mounted = false; cancelar(); };
  }, []);

  const isHome = page === 'inicio';
  const bgFilter = themePref === 'light' ? 'blur(3px) brightness(0.92) sepia(0.15)' : 'blur(3px) brightness(0.35)';

  return (
    <div className="app-shell">
      {/* Background Images Parallax */}
      <div 
        ref={parallaxRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: bgLoaded ? 1 : 0,
          transition: 'opacity 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform, opacity'
        }}
      >
        {/* Background 1 (Home) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/images/bg-1.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
          filter: bgFilter,
          opacity: isHome ? 1 : 0,
          transition: 'opacity 0.6s ease'
        }} />
        
        {/* Background 2 (Other pages / Ranking) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/images/bg-2.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
          filter: bgFilter,
          opacity: isHome ? 0 : 1,
          transition: 'opacity 0.6s ease'
        }} />
      </div>
      <Header />

      {profile && profile.cadastro_completo && !profile.player_id && (
        <div style={{
          background: 'rgba(245,158,11,0.12)',
          borderBottom: '1px solid rgba(245,158,11,0.2)',
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          textAlign: 'center'
        }}>
          <span style={{ fontSize: 13, color: '#fde047', fontWeight: 600 }}>
            Para participar dos rankings municipais, é necessário permitir acesso à localização.
          </span>
          <button
            onClick={solicitarLocalizacaoBanner}
            style={{
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Permitir Localização
          </button>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', overflowX: 'hidden', zIndex: 120 }}>
        <AnimatePresence mode="popLayout">
          <motion.div 
            key={page} 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNavigation page={page} onNavigate={onNavigate} isMaster={isMaster} />

      {showUserMenu && profile && (
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
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Foto de Perfil
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {editFoto ? (
                      <img src={editFoto} alt="Preview" style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border)', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: 18 }}>
                        {profile.nome_completo?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditFileChange}
                      style={{ display: 'none' }}
                      id="edit-profile-file"
                      disabled={uploadingFoto}
                    />
                    <label htmlFor="edit-profile-file" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, width: 'auto' }}>
                      {uploadingFoto ? <div className="spinner" style={{ width: 12, height: 12 }} /> : 'Alterar Foto'}
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
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

                <div>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Posição de Jogo *
                  </label>
                  <select
                    required
                    value={editPosicao}
                    onChange={(e) => setEditPosicao(e.target.value)}
                  >
                    {cfg.posicoes.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Altura (m) *
                    </label>
                    <input
                      required
                      type="text"
                      inputMode="decimal"
                      value={editAltura}
                      onChange={handleEditAlturaChange}
                      placeholder="Ex: 1,85"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
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
                    <div style={{ fontSize: 12, color: '#64748b' }}>{user?.email || ''}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="card" style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>APELIDO</div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14 }}>{profile.apelido}</div>
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

                <div style={{ marginTop: 8, marginBottom: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 8, textAlign: 'center' }}>
                    Tema do Aplicativo
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { key: 'light', label: '☀️ Claro' },
                      { key: 'dark', label: '🌙 Escuro' },
                      { key: 'system', label: '📱 Sistema' }
                    ].map(t => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => { setThemePref(t.key); handleUpdateTheme(t.key); }}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: 8,
                          border: themePref === t.key ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: themePref === t.key ? 'rgba(200,241,53,0.15)' : 'none',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditApelido(profile.apelido || '');
                      setEditPosicao(profile.posicao || cfg.posicoes[0]);
                      setEditFoto(profile.foto_perfil || '');
                      setIsEditingProfile(true);
                    }}
                    style={{ flex: 1 }}
                  >
                    Editar Perfil
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={logout}
                    style={{ flex: 1, color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
                  >
                    Sair da Conta
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmExcluir('');
                    setErroExcluir('');
                    setShowExcluirConta(true);
                  }}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    opacity: 0.85
                  }}
                >
                  Excluir minha conta
                </button>

                <button className="btn btn-primary" onClick={() => setShowUserMenu(false)}>
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {cityPrompt && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-sheet" style={{ maxWidth: 400, padding: 24, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <IconLocalizacao size={40} color="var(--accent)" />
            </div>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Mudar cidade de competição?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Detectamos que você está em <strong>{cityPrompt.city} - {cityPrompt.uf}</strong>. Deseja atualizar sua cidade de competição?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleConfirmCityUpdate}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 50,
                  padding: '12px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Atualizar
              </button>
              <button
                onClick={handleRejectCityUpdate}
                style={{
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 50,
                  padding: '12px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Manter Atual
              </button>
            </div>
          </div>
        </div>
      )}

      {showExcluirConta && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-sheet" style={{ maxWidth: 400, padding: 24 }}>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 10, color: '#f87171' }}>
              Excluir minha conta
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>
              Esta acao e <strong>permanente</strong> e nao pode ser desfeita. Vao ser apagados:
            </p>
            <ul style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7, margin: '0 0 14px 18px' }}>
              <li>Sua conta e seu login (e-mail/senha e Google)</li>
              <li>Seu perfil, foto e apelido</li>
              <li>Suas votacoes e avaliacoes de partidas</li>
              <li>Suas participacoes em rachoes e torneios</li>
            </ul>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
              As partidas, atletas e rankings da comunidade <strong>continuam no ar</strong> — apenas sem
              o seu vinculo com eles.
            </p>

            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 8 }}>
              Digite EXCLUIR para confirmar:
            </label>
            <input
              type="text"
              value={confirmExcluir}
              onChange={(e) => setConfirmExcluir(e.target.value)}
              placeholder="EXCLUIR"
              autoCapitalize="characters"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: 15,
                marginBottom: 14,
                textAlign: 'center',
                letterSpacing: 2,
                fontWeight: 700
              }}
            />

            {erroExcluir && (
              <div style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 13,
                marginBottom: 14
              }}>
                {erroExcluir}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                disabled={excluindo || confirmExcluir.trim().toUpperCase() !== 'EXCLUIR'}
                onClick={handleExcluirConta}
                style={{
                  background: confirmExcluir.trim().toUpperCase() === 'EXCLUIR' ? '#dc2626' : 'rgba(220,38,38,0.35)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 50,
                  padding: '12px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: excluindo ? 'wait' : (confirmExcluir.trim().toUpperCase() === 'EXCLUIR' ? 'pointer' : 'not-allowed')
                }}
              >
                {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={() => setShowExcluirConta(false)}
                style={{
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 50,
                  padding: '12px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <NotificationsPanel
        open={showNotificacoes}
        onClose={() => setShowNotificacoes(false)}
        notificacoes={notificacoes}
        onMarkRead={handleMarcarLida}
        onMarkAllRead={handleMarcarTodasLidas}
        onDelete={handleExcluirNotificacao}
        onRefresh={carregarNotificacoes}
      />
    </div>
  );
}
