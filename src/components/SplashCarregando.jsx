// src/components/SplashCarregando.jsx
//
// Capa mostrada enquanto o perfil do usuário logado está chegando (ex.: ao
// reabrir o app já logado). Usa a mesma linguagem visual da tela de login
// (fundo escuro + logo RH) para a entrada no app parecer contínua — em vez de
// uma tela em branco com um spinner solto no meio.

import { IconBasquete } from './Icons';

export default function SplashCarregando({ mensagem = 'Preparando sua quadra' }) {
  return (
    <div
      className="app-shell"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-primary, #0C0C14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes splashEntra {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes splashRespira {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
      `}</style>

      <div style={{ textAlign: 'center', animation: 'splashEntra 0.5s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
        <div
          style={{
            width: 64,
            height: 64,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            border: '1px solid rgba(200,241,53,0.3)',
            boxShadow: '0 0 30px rgba(200,241,53,0.1)',
          }}
        >
          <IconBasquete size={28} color="#C8F135" />
        </div>

        <h1
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontWeight: 800,
            fontSize: 22,
            color: '#FFFFFF',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            lineHeight: 1,
            marginBottom: 18,
          }}
        >
          Rank Hooper
        </h1>

        <div className="spinner" style={{ margin: '0 auto 12px' }} />

        <p
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            fontFamily: "'Inter',sans-serif",
            animation: 'splashRespira 1.8s ease-in-out infinite',
          }}
        >
          {mensagem}…
        </p>
      </div>
    </div>
  );
}
