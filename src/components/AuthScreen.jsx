import { useState, useEffect, useRef } from 'react';
import { authAPI } from '../lib/supabase';

export default function AuthScreen({ onStartAnimation, onFinishAnimation }) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});

  const [isShooting, setIsShooting] = useState(false);
  const [isShake, setIsShake] = useState(false);
  
  // 'idle' | 'css' (crouch & prep) | 'js' (flight)
  const [ballPhase, setBallPhase] = useState('idle');
  
  const ballRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (isShooting) {
      setBallPhase('css');
      
      const flightTimeout = setTimeout(() => {
        setBallPhase('js');
        
        let x = 0;
        let y = 0;
        let vx = 3;
        let vy = -12;
        let gravity = 0.6;
        let rot = 0;
        let scale = 1;

        const animate = () => {
          x += vx;
          y += vy;
          vy += gravity;
          rot += 4;
          
          if (scale > 0.3) scale -= 0.012; // Gradual scaling down

          if (ballRef.current) {
            // Squash & stretch in flight (scaleX 0.9, scaleY 1.1) + overall distance scale + rotation
            ballRef.current.setAttribute('transform', `translate(${x}, ${y}) scale(${scale * 0.9}, ${scale * 1.1}) rotate(${rot})`);
          }

          if (y < 400 && scale > 0) {
            rafRef.current = requestAnimationFrame(animate);
          }
        };
        
        rafRef.current = requestAnimationFrame(animate);
        
      }, 600); // 600ms corresponds to the exact moment the CSS arm reaches 180deg

      return () => {
        clearTimeout(flightTimeout);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    } else {
      setBallPhase('idle');
    }
  }, [isShooting]);

  async function handleSubmit(e) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    setSuccessMsg(null);

    try {
      if (tab === 'login') {
        const { error } = await authAPI.login(email, senha);
        if (error) throw error;
        
        if (onStartAnimation) onStartAnimation();
        setIsShooting(true);
        setTimeout(() => {
          if (onFinishAnimation) onFinishAnimation();
        }, 2200);

      } else if (tab === 'register') {
        if (!nome.trim()) throw new Error('Por favor, informe seu nome completo.');
        const { data, error } = await authAPI.registrar(email, senha, nome);
        if (error) throw error;
        if (data && !data.session) {
          setSuccessMsg('Cadastro realizado! Um e-mail de confirmação foi enviado.');
        }
        setCarregando(false);
      } else if (tab === 'forgot') {
        if (!email.trim()) throw new Error('Por favor, informe seu e-mail.');
        const { error } = await authAPI.recuperarSenha(email);
        if (error) throw error;
        setSuccessMsg('E-mail de recuperação enviado!');
        setTab('login');
        setCarregando(false);
      }
    } catch (err) {
      setErro(err.message || 'Erro ao processar a autenticação.');
      setCarregando(false);
      setIsShake(true);
      setTimeout(() => setIsShake(false), 300);
    }
  }

  async function handleGoogleLogin() {
    setCarregando(true);
    setErro(null);
    try {
      const { error } = await authAPI.loginGoogle();
      if (error) throw error;
      if (onStartAnimation) onStartAnimation();
      setIsShooting(true);
    } catch (err) {
      setErro(err.message || 'Erro ao conectar com o Google.');
      setCarregando(false);
      setIsShake(true);
      setTimeout(() => setIsShake(false), 300);
    }
  }

  const showHint = touched.senha && senha.length > 0 && senha.length < 6;

  // Stagger delays for particles
  const particles = Array.from({ length: 6 }).map((_, i) => ({
    id: i,
    delay: Math.random() * 0.2, // 0 to 200ms
    angle: (i * 60) + (Math.random() * 20 - 10),
  }));

  return (
    <div className={`app-shell auth-screen ${isShooting ? 'is-shooting' : ''}`} style={{ minHeight: '100dvh', background: 'var(--bg-primary, #0C0C14)', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        .auth-screen.is-shooting {
          animation: fadeOutApp 0.5s cubic-bezier(0.36, 0, 0.66, -0.56) 1.7s forwards;
        }

        /* IDLE ANIMATIONS (Cubic-bezier gerais) */
        .idle-breathe {
          animation: breathe 2.5s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .idle-sway {
          animation: sway 3s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          transform-origin: 200px 450px;
        }
        .idle-bounce {
          animation: bounce 0.8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }

        /* SQUASH & STRETCH BALL (IDLE) */
        @keyframes bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(20px) scale(0.85, 1.2); } /* Stretching down */
          50% { transform: translateY(22px) scale(1.4, 0.65); } /* Squash on ground */
          60% { transform: translateY(18px) scale(0.85, 1.2); } /* Stretching up */
        }

        @keyframes breathe {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes sway {
          0%, 100% { transform: rotateZ(-1deg); }
          50% { transform: rotateZ(1deg); }
        }

        /* DRAW LINES WITH STAGGER */
        .line-draw {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawLine 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .line-draw-delay-1 { animation-delay: 0.06s; }
        .line-draw-delay-2 { animation-delay: 0.12s; }
        .line-draw-delay-3 { animation-delay: 0.18s; }
        .line-draw-delay-4 { animation-delay: 0.24s; }
        .line-draw-delay-5 { animation-delay: 0.30s; }

        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }

        /* SHOOTING ANIMATIONS (Disney Principles) */
        
        .shot-torso {
          animation: shotTorso 2.2s forwards;
        }
        @keyframes shotTorso {
          0% { transform: translateY(0); }
          6.8% { transform: translateY(6px); animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1); } /* Anticipation (150ms) */
          25% { transform: translateY(-24px); animation-timing-function: cubic-bezier(0.2, 0, 0, 1); } /* Explosive Jump (400ms) */
          54.5% { transform: translateY(-24px); } /* Hold in air */
          59% { transform: translateY(8px); animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1); } /* Land & Squash */
          68% { transform: translateY(0); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); } /* Spring back */
          100% { transform: translateY(0); }
        }

        .shot-arm {
          animation: shotArm 2.2s forwards;
          transform-origin: 185px 225px;
        }
        @keyframes shotArm {
          0% { transform: rotate(0deg); }
          13.6% { transform: rotate(0deg); } /* Wait for jump to start */
          19% { transform: rotate(-15deg); animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1); } /* Anticipation back (120ms) */
          27.2% { transform: rotate(180deg); animation-timing-function: cubic-bezier(0.2, 0, 0, 1); } /* Explosive throw */
          35% { transform: rotate(170deg); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); } /* Follow-through spring */
          45.4% { transform: rotate(175deg); } /* Settles */
          100% { transform: rotate(175deg); }
        }

        /* Ball Compression before release */
        .shot-ball-compress {
          animation: ballCompress 2.2s forwards;
        }
        @keyframes ballCompress {
          0%, 23.6% { transform: scale(1); }
          27.2% { transform: scale(0.9); } /* Squash right before release at 600ms */
          100% { transform: scale(0.9); }
        }

        .shot-hoop {
          animation: shotHoop 2.2s forwards;
        }
        @keyframes shotHoop {
          0%, 63.6% { opacity: 0; transform: translateY(20px); }
          68% { opacity: 1; transform: translateY(-5px); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); } /* Spring entrance */
          77.2% { opacity: 1; transform: translateY(0) scaleX(0.8) scaleY(1.15); } /* Squash from ball */
          82% { opacity: 1; transform: translateY(0) scaleX(1) scaleY(1); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); } /* Spring back */
          100% { opacity: 1; }
        }

        @keyframes fadeOutApp {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.05); } /* Exit with Anticipation easing */
        }

        /* PARTICLE EXPLOSION */
        .particle {
          animation: explode 0.8s cubic-bezier(0.2, 0, 0, 1) forwards;
          opacity: 0;
        }
        @keyframes explode {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
        }

        /* FORM STYLES */
        .glass-form {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 0.5px solid rgba(255,255,255,0.12);
          border-radius: 20px;
          padding: 1.5rem;
          width: 100%;
          max-width: 400px;
          margin: 0 auto;
        }

        .glass-input {
          background: rgba(255,255,255,0.08);
          border: 0.5px solid rgba(255,255,255,0.15);
          border-radius: 12px;
          color: #FFFFFF;
          padding: 14px 16px 14px 40px;
          width: 100%;
          box-sizing: border-box;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .glass-input::placeholder {
          color: rgba(255,255,255,0.4);
        }
        .glass-input:focus {
          border-color: #C8F135;
        }

        .shake-animation {
          animation: shakeX 0.3s cubic-bezier(0.36, 0, 0.66, -0.56);
        }
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-4px); }
        }
      `}</style>

      {/* VIDEO BACKGROUND */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.6)' }}
        >
          <source src="/images/login-video.mp4" type="video/mp4" />
        </video>
      </div>

      {/* BACKGROUND SVG LINE ART (Desativado a pedido do vídeo) */}
      <div style={{ display: 'none', position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, justifyContent: 'center', alignItems: 'center' }}>
        <svg viewBox="0 0 400 600" style={{ width: '100%', height: '100%', maxWidth: '500px' }}>
          
          <g id="cesta" className={isShooting ? 'shot-hoop' : ''} opacity="0">
            {/* Hoop & Net */}
            <ellipse cx="300" cy="150" rx="30" ry="10" fill="none" stroke="#FF6B1A" strokeWidth="3" />
            <path d="M275 155 L285 190 L315 190 L325 155" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" strokeDasharray="2 2" />
            <path d="M285 155 L295 190 M315 155 L305 190 M300 155 L300 190" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" strokeDasharray="2 2" />
            {/* Flash */}
            <circle cx="300" cy="160" r="40" fill="#FF6B1A" opacity="0.2" filter="blur(10px)" />
            
            {/* Particles that explode around 1400ms */}
            {isShooting && particles.map(p => (
              <circle
                key={p.id}
                cx="300" cy="150" r="2.5" fill="#FF6B1A"
                className="particle"
                style={{
                  animationDelay: `${1.4 + p.delay}s`,
                  '--tx': `${Math.cos(p.angle * Math.PI / 180) * 40}px`,
                  '--ty': `${Math.sin(p.angle * Math.PI / 180) * 40}px`
                }}
              />
            ))}
          </g>

          <g id="jogador" className={!isShooting ? 'idle-sway' : ''}>
            <g id="torso" className={`torso ${isShooting ? 'shot-torso' : 'idle-breathe'}`}>
              
              {/* Cabeça */}
              <g id="cabeca">
                <circle cx="200" cy="200" r="18" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" className="line-draw" />
                <path d="M190 190 Q200 180 210 190" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" className="line-draw line-draw-delay-1" />
              </g>

              {/* Corpo / Tronco */}
              <g id="corpo">
                <path d="M185 220 L195 300 L205 300 L215 220 Z" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" className="line-draw line-draw-delay-2" />
                <path d="M190 220 L180 240 M210 220 L220 240" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" className="line-draw line-draw-delay-2" />
              </g>

              {/* Perna Esq */}
              <g id="perna-esq">
                <path d="M195 300 L185 360 L170 420" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" className="line-draw line-draw-delay-3" />
                <path d="M170 420 L185 425" fill="none" stroke="#FF6B1A" strokeWidth="2" className="line-draw line-draw-delay-4" />
              </g>

              {/* Perna Dir */}
              <g id="perna-dir">
                <path d="M205 300 L215 350 L230 420" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" className="line-draw line-draw-delay-3" />
                <path d="M230 420 L245 425" fill="none" stroke="#FF6B1A" strokeWidth="2" className="line-draw line-draw-delay-4" />
              </g>

              {/* Braço Esq */}
              <g id="braco-esq">
                <path d="M215 225 L235 260 L200 280" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" className="line-draw line-draw-delay-4" />
              </g>

              {/* Braço Dir (Arremesso) */}
              <g id="braco-dir" className={`braco-dir ${isShooting ? 'shot-arm' : ''}`}>
                <path d="M185 225 L160 250 L160 280" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" className="line-draw line-draw-delay-4" />
                
                {/* Bola pré-voo ancorada na mão */}
                {ballPhase === 'css' && (
                  <g className="shot-ball-compress" style={{ transformOrigin: '160px 290px' }}>
                    <circle cx="160" cy="290" r="14" fill="none" stroke="#FF6B1A" strokeWidth="2" />
                  </g>
                )}
              </g>

            </g>
          </g>

          {/* BOLA IDLE */}
          {ballPhase === 'idle' && (
            <g className="idle-bounce" style={{ transformOrigin: '160px 304px' }}>
              <circle cx="160" cy="290" r="14" fill="none" stroke="#FF6B1A" strokeWidth="2" className="line-draw line-draw-delay-5" />
              <path d="M150 280 Q160 290 170 300 M170 280 Q160 290 150 300" fill="none" stroke="#FF6B1A" strokeWidth="1" className="line-draw line-draw-delay-5" opacity="0.7" />
            </g>
          )}

          {/* BOLA JS FLIGHT */}
          {ballPhase === 'js' && (
            <g ref={ballRef} style={{ transformOrigin: '210px 160px' }}>
              <circle cx="210" cy="160" r="14" fill="none" stroke="#FF6B1A" strokeWidth="2" />
              <path d="M200 150 Q210 160 220 170 M220 150 Q210 160 200 170" fill="none" stroke="#FF6B1A" strokeWidth="1" opacity="0.7" />
            </g>
          )}

        </svg>
      </div>

      {/* CONTENT LAYER */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', padding: '10vh 20px 5vh' }}>
        
        {/* LOGO */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, background: 'rgba(255,255,255,0.05)', borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', border: '1px solid rgba(200,241,53,0.3)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 30px rgba(200,241,53,0.1)',
          }}>
            <span style={{
              fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
              fontSize: 24, color: '#C8F135', letterSpacing: '-0.02em',
            }}>RH</span>
          </div>
          <h1 style={{
            fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
            fontSize: '28px', color: '#FFFFFF',
            letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1, marginBottom: 4,
          }}>
            Rank Hooper
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, letterSpacing: '0.5px', fontFamily: "'Inter',sans-serif" }}>
            Ready to ball?
          </p>
        </div>

        {/* FORM CONTAINER */}
        <div className={`glass-form ${isShake ? 'shake-animation' : ''}`} style={{ marginTop: 'auto' }}>
          
          {erro && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#f87171', padding: '10px', fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
              {erro}
            </div>
          )}
          {successMsg && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, color: '#4ade80', padding: '10px', fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
              {successMsg}
            </div>
          )}

          {tab === 'forgot' ? (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 800, fontSize: 16, color: '#FFFFFF', fontFamily: "'Barlow Condensed',sans-serif" }}>Recuperar Senha</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4, fontFamily: "'Inter',sans-serif" }}>Digite seu e-mail para receber as instruções</p>
            </div>
          ) : (
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 4, gap: 4, marginBottom: 16 }}>
              {[
                { key: 'login', label: 'Entrar' },
                { key: 'register', label: 'Criar Conta' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setErro(null); setSuccessMsg(null); }}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none',
                    background: tab === t.key ? '#C8F135' : 'transparent',
                    color: tab === t.key ? '#0C0C14' : 'rgba(255,255,255,0.5)',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Inter',sans-serif", transition: 'all 0.2s',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tab === 'register' && (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <input
                  required type="text" value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome completo" className="glass-input"
                />
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </div>
              <input
                required type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="E-mail" className="glass-input"
              />
            </div>

            {tab !== 'forgot' && (
              <>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                  <input
                    required type={showPassword ? 'text' : 'password'} value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Senha" minLength={6} className="glass-input"
                    onBlur={() => setTouched(p => ({ ...p, senha: true }))}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.4)',
                  }}>
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                {showHint && <div style={{ fontSize: 11, color: '#f87171', paddingLeft: 4 }}>Use ao menos 6 caracteres</div>}
                
                {tab === 'login' && (
                  <div style={{ textAlign: 'right' }}>
                    <button type="button" onClick={() => { setTab('forgot'); setErro(null); setSuccessMsg(null); }} style={{ background: 'none', border: 'none', color: '#C8F135', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, fontFamily: "'Inter',sans-serif" }}>
                      Esqueci minha senha
                    </button>
                  </div>
                )}
              </>
            )}

            <button type="submit" disabled={carregando || isShooting} style={{
              width: '100%', height: 50, borderRadius: 12, border: 'none',
              background: '#C8F135', color: '#0C0C14', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif",
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 20px rgba(200,241,53,0.4)', transition: 'all 0.2s',
              marginTop: 4, opacity: (carregando || isShooting) ? 0.7 : 1
            }}>
              {carregando ? (
                <div className="spinner" />
              ) : isShooting ? (
                'Entrando...'
              ) : (
                tab === 'login' ? 'Entrar' : tab === 'register' ? 'Criar Conta' : 'Enviar'
              )}
            </button>

            {tab === 'login' && !isShooting && (
              <button type="button" onClick={handleGoogleLogin} disabled={carregando} style={{
                width: '100%', height: 50, borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)', color: '#FFFFFF', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.22-.67-.35-1.37-.35-2.09z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Google
              </button>
            )}

            {tab === 'forgot' && (
              <button type="button" onClick={() => { setTab('login'); setErro(null); setSuccessMsg(null); }} disabled={carregando} style={{
                width: '100%', height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              }}>
                Voltar ao Login
              </button>
            )}
          </form>
        </div>

      </div>
    </div>
  );
}
