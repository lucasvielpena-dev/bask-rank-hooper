import { useState } from 'react';
import { profilesAPI } from '../lib/supabase';

export default function CompleteProfileScreen({ profile, onComplete }) {
  const [apelido, setApelido] = useState(profile?.apelido || '');
  const [altura, setAltura] = useState(profile?.altura || '');
  const [idade, setIdade] = useState(profile?.idade || '');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const parsedAltura = parseFloat(altura);
    const parsedIdade = parseInt(idade);

    try {
      if (!apelido.trim()) {
        throw new Error('Por favor, informe seu apelido.');
      }
      if (isNaN(parsedAltura) || parsedAltura <= 0 || parsedAltura > 3) {
        throw new Error('Por favor, informe uma altura válida (ex: 1.85).');
      }
      if (isNaN(parsedIdade) || parsedIdade <= 0 || parsedIdade > 120) {
        throw new Error('Por favor, informe uma idade válida.');
      }

      const { data, error } = await profilesAPI.atualizar(profile.id, {
        apelido: apelido.trim(),
        altura: parsedAltura,
        idade: parsedIdade,
        cadastro_completo: true
      });

      if (error) throw error;
      onComplete(data); // atualiza o perfil no App.jsx
    } catch (err) {
      setErro(err.message || 'Erro ao salvar informações do perfil.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="app-shell" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          {profile?.foto_perfil ? (
            <img 
              src={profile.foto_perfil} 
              alt="Avatar" 
              style={{ 
                width: 72, 
                height: 72, 
                borderRadius: '50%', 
                border: '2px solid var(--accent-blue)', 
                margin: '0 auto 16px',
                display: 'block' 
              }} 
            />
          ) : (
            <div style={{ 
              width: 72, 
              height: 72, 
              background: 'var(--accent-blue-dim)', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: 28, 
              color: '#60a5fa',
              margin: '0 auto 16px',
              fontWeight: 800
            }}>
              {profile?.nome_completo?.charAt(0).toUpperCase()}
            </div>
          )}
          <h2 style={{ fontWeight: 800, fontSize: 24, marginBottom: 6 }}>Complete seu perfil</h2>
          <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
            Falta pouco! Preencha as informações obrigatórias para ter acesso completo ao Ranks Hoops.
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Nome completo
            </label>
            <input
              disabled
              type="text"
              value={profile?.nome_completo || ''}
              style={{ background: 'rgba(255,255,255,0.03)', color: '#64748b', cursor: 'not-allowed' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              E-mail
            </label>
            <input
              disabled
              type="text"
              value={profile?.email || ''}
              style={{ background: 'rgba(255,255,255,0.03)', color: '#64748b', cursor: 'not-allowed' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Apelido *
            </label>
            <input
              required
              type="text"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              placeholder="Ex: DD, Viel, etc."
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
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
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
                value={idade}
                onChange={(e) => setIdade(e.target.value)}
                placeholder="Ex: 25"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            disabled={carregando}
          >
            {carregando ? (
              <>
                <div className="spinner" /> Salvando...
              </>
            ) : (
              'Salvar e Continuar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
