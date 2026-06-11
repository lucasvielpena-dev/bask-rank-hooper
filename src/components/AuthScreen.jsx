import { useState } from 'react';
import { authAPI } from '../lib/supabase';

export default function AuthScreen() {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    setSuccessMsg(null);

    try {
      if (tab === 'login') {
        const { error } = await authAPI.login(email, senha);
        if (error) throw error;
      } else if (tab === 'register') {
        if (!nome.trim()) throw new Error('Por favor, informe seu nome completo.');
        const { data, error } = await authAPI.registrar(email, senha, nome);
        if (error) throw error;
        if (data && !data.session) {
          setSuccessMsg('Cadastro realizado! Um e-mail de confirma\u00e7\u00e3o foi enviado. Confirme seu e-mail antes de entrar.');
        }
      } else if (tab === 'forgot') {
        if (!email.trim()) throw new Error('Por favor, informe seu e-mail.');
        const { error } = await authAPI.recuperarSenha(email);
        if (error) throw error;
        setSuccessMsg('E-mail de recupera\u00e7\u00e3o enviado! Verifique sua caixa de entrada.');
        setTab('login');
      }
    } catch (err) {
      setErro(err.message || 'Ocorreu um erro ao processar a autentica\u00e7\u00e3o.');
    } finally {
      setCarregando(false);
    }
  }

  async function handleGoogleLogin() {
    setCarregando(true);
    setErro(null);
    setSuccessMsg(null);
    try {
      const { error } = await authAPI.loginGoogle();
      if (error) throw error;
    } catch (err) {
      setErro(err.message || 'Erro ao conectar com o Google.');
      setCarregando(false);
    }
  }

  const showHint = touched.senha && senha.length > 0 && senha.length < 6;

  return (
    <div className="app-shell" style={{ justifyContent: 'flex-start', minHeight: '100dvh', background: '#0C0C14' }}>

      {/* Background glow */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(200,241,53,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Court lines pattern */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 300,
        opacity: 0.04, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='100' r='60' fill='none' stroke='white' stroke-width='1'/%3E%3Cline x1='100' y1='40' x2='100' y2='160' stroke='white' stroke-width='0.5'/%3E%3Cline x1='40' y1='100' x2='160' y2='100' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
        backgroundSize: '200px 200px',
      }} />

      <div style={{ padding: '0 clamp(14px, 4vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', zIndex: 1, paddingTop: '20vh' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            width: 72, height: 72, background: '#1D1D2E', borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', border: '1.5px solid rgba(200,241,53,0.3)',
            boxShadow: '0 0 30px rgba(200,241,53,0.1)',
          }}>
            <span style={{
              fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
              fontSize: 28, color: '#C8F135', letterSpacing: '-0.02em',
            }}>RH</span>
          </div>
          <h1 style={{
            fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
            fontSize: 'clamp(24px, 6vw, 28px)', color: '#FFFFFF',
            letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1, marginBottom: 8,
          }}>
            Rank Hooper
          </h1>
          <p style={{ color: '#6B7280', fontSize: 13, letterSpacing: '0.5px', fontFamily: "'Inter',sans-serif" }}>
            Ranking de basquete &middot; Altamira, PA
          </p>
        </div>

        {/* Error / Success */}
        {erro && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#f87171', padding: '12px 16px', fontSize: 13, lineHeight: 1.4 }}>
            {erro}
          </div>
        )}
        {successMsg && (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, color: '#4ade80', padding: '12px 16px', fontSize: 13, lineHeight: 1.4 }}>
            {successMsg}
          </div>
        )}

        {/* Google Button */}
        <button onClick={handleGoogleLogin} disabled={carregando} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: '#1D1D2E', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.12)',
          height: 52, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          fontFamily: "'Inter',sans-serif", transition: 'all 0.2s',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.22-.67-.35-1.37-.35-2.09z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Continuar com o Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ color: '#64748B', fontSize: 12, fontWeight: 600 }}>OU</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Tabs */}
        {tab === 'forgot' ? (
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <h3 style={{ fontWeight: 800, fontSize: 18, color: '#FFFFFF', fontFamily: "'Barlow Condensed',sans-serif" }}>Recuperar Senha</h3>
            <p style={{ color: '#8A8A9A', fontSize: 13, marginTop: 4, fontFamily: "'Inter',sans-serif" }}>Digite seu e-mail para receber as instru\u00e7\u00f5es</p>
          </div>
        ) : (
          <div style={{ display: 'flex', background: '#1D1D2E', borderRadius: 10, padding: 4, gap: 4 }}>
            {[
              { key: 'login', label: 'Entrar' },
              { key: 'register', label: 'Criar Conta' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setErro(null); setSuccessMsg(null); }}
                style={{
                  flex: 1, padding: '10px 4px', borderRadius: 8, border: 'none',
                  background: tab === t.key ? '#C8F135' : 'transparent',
                  color: tab === t.key ? '#FFFFFF' : '#555',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Inter',sans-serif", transition: 'all 0.2s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'register' && (
            <div>
              <label style={{ fontSize: 12, color: '#8A8A9A', fontWeight: 500, display: 'block', marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>Nome completo</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <input
                  required type="text" value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  style={{
                    width: '100%', boxSizing: 'border-box', paddingLeft: 40,
                    background: '#13131A', border: '1px solid #2A2A3A', borderRadius: 12,
                    padding: '0 16px 0 40px', height: 52, fontSize: 14, color: '#FFFFFF',
                    fontFamily: "'Inter',sans-serif", outline: 'none', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#C8F135'}
                  onBlur={e => e.target.style.borderColor = '#2A2A3A'}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, color: '#8A8A9A', fontWeight: 500, display: 'block', marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>E-mail</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </div>
              <input
                required type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#13131A', border: '1px solid #2A2A3A', borderRadius: 12,
                  padding: '0 16px 0 40px', height: 52, fontSize: 14, color: '#FFFFFF',
                  fontFamily: "'Inter',sans-serif", outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#C8F135'}
                onBlur={e => e.target.style.borderColor = '#2A2A3A'}
              />
            </div>
          </div>

          {tab !== 'forgot' && (
            <div>
              <label style={{ fontSize: 12, color: '#8A8A9A', fontWeight: 500, display: 'block', marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input
                  required type={showPassword ? 'text' : 'password'} value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Sua senha"
                  minLength={6}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#13131A', border: `1px solid ${touched.senha && senha.length > 0 && senha.length < 6 ? '#EF4444' : '#2A2A3A'}`,
                    borderRadius: 12, padding: '0 44px 0 40px', height: 52, fontSize: 14, color: '#FFFFFF',
                    fontFamily: "'Inter',sans-serif", outline: 'none', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#C8F135'}
                  onBlur={e => { setTouched(p => ({ ...p, senha: true })); if (!(touched.senha && showHint)) e.target.style.borderColor = '#2A2A3A'; }}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748B',
                }}>
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {showHint && (
                <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4, fontFamily: "'Inter',sans-serif" }}>Use ao menos 6 caracteres</div>
              )}
              {tab === 'login' && (
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <button type="button" onClick={() => { setTab('forgot'); setErro(null); setSuccessMsg(null); }} style={{ background: 'none', border: 'none', color: '#C8F135', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, fontFamily: "'Inter',sans-serif" }}>
                    Esqueci minha senha
                  </button>
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={carregando} style={{
            width: '100%', height: 56, borderRadius: 14, border: 'none',
            background: '#C8F135', color: '#0C0C14', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif",
            textTransform: 'uppercase', letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(200,241,53,0.3)', transition: 'all 0.2s',
          }}>
            {carregando ? (
              <div className="spinner" />
            ) : (
              <>
                {tab === 'login' ? 'Entrar' : tab === 'register' ? 'Cadastrar' : 'Enviar'}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </>
            )}
          </button>

          {tab === 'forgot' && (
            <button type="button" onClick={() => { setTab('login'); setErro(null); setSuccessMsg(null); }} disabled={carregando} style={{
              width: '100%', height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent', color: '#8A8A9A', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Inter',sans-serif",
            }}>
              Voltar ao Login
            </button>
          )}
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#444', fontFamily: "'Inter',sans-serif", padding: '16px 0 32px' }}>
          Ao entrar voc\u00ea concorda com os Termos de Uso
        </p>
      </div>
    </div>
  );
}
