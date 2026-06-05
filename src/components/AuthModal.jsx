import { useState } from 'react';
import { authAPI } from '../lib/supabase';

export default function AuthModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    try {
      if (tab === 'login') {
        const { error } = await authAPI.login(email, senha);
        if (error) throw error;
      } else {
        if (!nome.trim()) {
          throw new Error('Por favor, informe seu nome completo.');
        }
        const { error } = await authAPI.registrar(email, senha, nome);
        if (error) throw error;
      }
      onClose(); // fecha o modal se der tudo certo
    } catch (err) {
      setErro(err.message || 'Ocorreu um erro ao processar a autenticação.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-handle" />

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          <button
            className={`tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setErro(null); }}
          >
            Entrar
          </button>
          <button
            className={`tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setErro(null); }}
          >
            Criar Conta
          </button>
        </div>

        <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, textAlign: 'center' }}>
          {tab === 'login' ? 'Bem-vindo de volta' : 'Faça parte do Ranks Hoops'}
        </h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
          {tab === 'login' ? 'Acesse sua conta para avaliar jogadores' : 'Cadastre-se para participar das votações'}
        </p>

        {erro && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            color: '#f87171',
            padding: '10px 14px',
            fontSize: 13,
            marginBottom: 16,
            lineHeight: 1.4
          }}>
            ⚠️ {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'register' && (
            <div>
              <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
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
            <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
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

          <div>
            <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Senha *
            </label>
            <input
              required
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ flex: 1 }}
              disabled={carregando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={carregando}
            >
              {carregando ? (
                <>
                  <div className="spinner" /> Processando...
                </>
              ) : tab === 'login' ? (
                'Entrar'
              ) : (
                'Cadastrar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
