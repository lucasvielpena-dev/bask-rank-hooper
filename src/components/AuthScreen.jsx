import { useState } from 'react';
import { authAPI } from '../lib/supabase';

export default function AuthScreen() {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

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
        if (!nome.trim()) {
          throw new Error('Por favor, informe seu nome completo.');
        }
        const { data, error } = await authAPI.registrar(email, senha, nome);
        if (error) throw error;
        
        if (data && !data.session) {
          setSuccessMsg('Cadastro realizado! Um e-mail de confirmação foi enviado. Por favor, confirme seu e-mail antes de entrar.');
        }
      } else if (tab === 'forgot') {
        if (!email.trim()) {
          throw new Error('Por favor, informe seu e-mail.');
        }
        const { error } = await authAPI.recuperarSenha(email);
        if (error) throw error;
        setSuccessMsg('E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.');
        setTab('login');
      }
    } catch (err) {
      setErro(err.message || 'Ocorreu um erro ao processar a autenticação.');
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

  return (
    <div className="app-shell" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
      <div style={{ padding: '0 clamp(14px, 4vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Logo/Header */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ 
            width: 64, 
            height: 64, 
            background: 'var(--accent-blue)', 
            borderRadius: 18, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: 32, 
            margin: '0 auto 16px' 
          }}>
            🏆
          </div>
          <h1 style={{ fontFamily: 'DM Sans', fontWeight: 900, fontSize: 'clamp(24px, 6vw, 32px)', lineHeight: 1.1, marginBottom: 8 }}>
            Ranks <span style={{ color: '#60a5fa' }}>Hoops</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
            Sistema de ranking de basquete de Altamira, Pará.
          </p>
        </div>

        {erro && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
            color: '#f87171',
            padding: '12px 16px',
            fontSize: 13,
            lineHeight: 1.4
          }}>
            ⚠️ {erro}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 10,
            color: '#4ade80',
            padding: '12px 16px',
            fontSize: 13,
            lineHeight: 1.4
          }}>
            ✓ {successMsg}
          </div>
        )}

        {/* Google Login */}
        <button 
          onClick={handleGoogleLogin} 
          disabled={carregando}
          className="btn btn-secondary"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 10,
            background: '#ffffff',
            color: '#1f2937',
            border: 'none',
            fontSize: 15,
            fontWeight: 700
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.22-.67-.35-1.37-.35-2.09z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          Entrar com o Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>OU</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Tabs */}
        {tab === 'forgot' ? (
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <h3 style={{ fontWeight: 800, fontSize: 18 }}>Recuperar Senha</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              Digite seu e-mail para receber as instruções de recuperação
            </p>
          </div>
        ) : (
          <div className="tabs">
            <button
              className={`tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); setErro(null); setSuccessMsg(null); }}
            >
              Entrar
            </button>
            <button
              className={`tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); setErro(null); setSuccessMsg(null); }}
            >
              Criar Conta
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'register' && (
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Nome completo *
              </label>
              <input
                required
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Felipe Santos"
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              E-mail *
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
            />
          </div>

          {tab !== 'forgot' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Senha *
                </label>
                {tab === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setErro(null); setSuccessMsg(null); }}
                    style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <input
                required
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            disabled={carregando}
          >
            {carregando ? (
              <>
                <div className="spinner" /> Processando...
              </>
            ) : tab === 'login' ? (
              'Entrar'
            ) : tab === 'register' ? (
              'Cadastrar'
            ) : (
              'Enviar E-mail de Recuperação'
            )}
          </button>
          
          {tab === 'forgot' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setTab('login'); setErro(null); setSuccessMsg(null); }}
              disabled={carregando}
            >
              Voltar ao Login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
