import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Header from './Header';
import BottomNavigation from './BottomNavigation';
import { IconSino, IconLocalizacao } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

export default function Layout({ page, onNavigate, children }) {
  const {
    profile,
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

  return (
    <div className="app-shell">
      {/* Background SVG — court lines + basketballs */}
      <svg
        className="rh-bg"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMin slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="rh-glow" cx="50%" cy="15%" r="40%">
            <stop offset="0%" stopColor="#C8F135" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#C8F135" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="800" fill="url(#rh-glow)" />
        {/* Court outline */}
        <g stroke="#C8F135" strokeWidth="0.8" fill="none" opacity="0.04">
          <rect x="40" y="100" width="320" height="500" rx="0" />
          <line x1="200" y1="100" x2="200" y2="600" />
          <circle cx="200" cy="350" r="60" />
          {/* 3-point arcs */}
          <path d="M 40 250 Q 120 350 40 450" />
          <path d="M 360 250 Q 280 350 360 450" />
          {/* Free throw areas */}
          <rect x="40" y="230" width="120" height="140" />
          <rect x="240" y="230" width="120" height="140" />
          <circle cx="160" cy="350" r="30" />
          <circle cx="240" cy="350" r="30" />
        </g>
        {/* Large basketball top-right */}
        <g transform="translate(310, 60)" stroke="#C8F135" strokeWidth="1.2" fill="none" opacity="0.045">
          <circle cx="0" cy="0" r="40" />
          <path d="M 0 -40 Q 20 0 0 40" />
          <path d="M 0 -40 Q -20 0 0 40" />
          <line x1="-40" y1="0" x2="40" y2="0" />
        </g>
        {/* Small basketball bottom-left */}
        <g transform="translate(60, 720)" stroke="#C8F135" strokeWidth="1" fill="none" opacity="0.03">
          <circle cx="0" cy="0" r="28" />
          <path d="M 0 -28 Q 14 0 0 28" />
          <path d="M 0 -28 Q -14 0 0 28" />
          <line x1="-28" y1="0" x2="28" y2="0" />
        </g>
      </svg>
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

      <div style={{ flex: 1, position: 'relative', overflowX: 'hidden' }}>
        <AnimatePresence mode="wait">
          <motion.div 
            key={page} 
            className="page-transition"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
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
                    <option value="Armador">Armador</option>
                    <option value="Ala-Armador">Ala-Armador</option>
                    <option value="Ala">Ala</option>
                    <option value="Ala-Pivô">Ala-Pivô</option>
                    <option value="Pivô">Pivô</option>
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
                    <div style={{ fontSize: 12, color: '#64748b' }}>{profile.email}</div>
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
                      setEditPosicao(profile.posicao || 'Ala');
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

      {showNotificacoes && (
        <div className="modal-overlay" onClick={() => setShowNotificacoes(false)} style={{ zIndex: 1000 }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 900, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}><IconSino size={20} color="var(--text-primary)" /> Notificações</h3>
              {notificacoes.filter(n => !n.lida).length > 0 && (
                <button
                  onClick={handleMarcarTodasLidas}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: 0
                  }}
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
              {notificacoes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ marginBottom: 12, opacity: 0.5, display: 'flex', justifyContent: 'center' }}>
                    <IconSino size={40} color="currentColor" />
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 600 }}>Nenhuma notificação por aqui</p>
                  <p style={{ fontSize: '11px', marginTop: 4 }}>Você será avisado sempre que receber avaliações de outros jogadores.</p>
                </div>
              ) : (
                notificacoes.map(n => (
                  <div
                    key={n.id}
                    style={{
                      background: n.lida ? 'transparent' : 'rgba(200, 241, 53, 0.04)',
                      border: n.lida ? '1px solid var(--border)' : '1px solid rgba(200, 241, 53, 0.15)',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      gap: 12,
                      position: 'relative',
                      alignItems: 'flex-start',
                      transition: 'all 0.2s'
                    }}
                  >
                    {!n.lida && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        background: 'var(--accent)',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '16px',
                        right: '16px'
                      }} />
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {n.titulo}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: 8 }}>
                        {n.mensagem}
                      </p>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {new Date(n.created_at).toLocaleDateString('pt-BR')} às {new Date(n.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {!n.lida && (
                      <button
                        onClick={() => handleMarcarLida(n.id)}
                        style={{
                          background: 'rgba(200, 241, 53, 0.12)',
                          color: 'var(--accent)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '9px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          alignSelf: 'center'
                        }}
                      >
                        Lida
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setShowNotificacoes(false)}
              style={{ width: '100%', marginTop: 10 }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
