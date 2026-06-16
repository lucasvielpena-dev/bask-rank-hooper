import React from 'react';
import { useEsporte } from '../contexts/EsporteContext';

const BgWrapper = ({ children }) => (
  <div style={{
    position: 'absolute', // absolute instead of fixed to stay inside page containers properly if needed, but fixed is fine if it covers the viewport. Let's use absolute to respect Layout.
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 0, // Behind page content
    pointerEvents: 'none', // No touch interference
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    opacity: 0.05, // Discreet
  }}>
    {children}
  </div>
);

// PÁGINA INÍCIO
export const HomeBackground = () => {
  const { esporte } = useEsporte();
  const isHandebol = esporte === 'handebol';

  return (
    <BgWrapper>
      <style>{`
        @keyframes floatBall1 {
          0% { transform: translate(0px, 0px) rotate(0deg); }
          33% { transform: translate(30px, 40px) rotate(45deg); }
          66% { transform: translate(-20px, 60px) rotate(90deg); }
          100% { transform: translate(0px, 0px) rotate(120deg); }
        }
        @keyframes floatBall2 {
          0% { transform: translate(0px, 0px) rotate(0deg) scale(0.8); }
          33% { transform: translate(-40px, 30px) rotate(-45deg) scale(0.85); }
          66% { transform: translate(20px, -40px) rotate(-90deg) scale(0.75); }
          100% { transform: translate(0px, 0px) rotate(-120deg) scale(0.8); }
        }
      `}</style>
      <svg viewBox="0 0 800 800" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <g style={{ animation: 'floatBall1 25s cubic-bezier(0.45, 0, 0.55, 1) infinite' }} transformOrigin="200px 200px">
          {isHandebol ? (
            <>
              <circle cx="200" cy="200" r="100" fill="none" stroke="var(--text-primary)" strokeWidth="4" />
              <path d="M200 100 a80 80 0 0 0 80 80" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M200 300 a80 80 0 0 0-80-80" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M100 200 a80 80 0 0 0 80 80" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M300 200 a80 80 0 0 0-80-80" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M145 145 c25 0 45 20 45 45 s-20 45-45 45" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M255 255 c-25 0-45-20-45-45 s20-45 45-45" fill="none" stroke="var(--accent)" strokeWidth="2" />
            </>
          ) : (
            <>
              <circle cx="200" cy="200" r="120" fill="none" stroke="var(--text-primary)" strokeWidth="4" />
              <path d="M80 200 Q200 260 320 200 M80 200 Q200 140 320 200" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M200 80 Q260 200 200 320 M200 80 Q140 200 200 320" fill="none" stroke="var(--accent)" strokeWidth="2" />
            </>
          )}
        </g>
        <g style={{ animation: 'floatBall2 30s cubic-bezier(0.45, 0, 0.55, 1) infinite' }} transformOrigin="600px 600px">
          {isHandebol ? (
            <>
              <circle cx="600" cy="600" r="140" fill="none" stroke="var(--text-primary)" strokeWidth="4" />
              <path d="M600 460 a112 112 0 0 0 112 112" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M600 740 a112 112 0 0 0-112-112" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M460 600 a112 112 0 0 0 112 112" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M740 600 a112 112 0 0 0-112-112" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M523 523 c35 0 63 28 63 63 s-28 63-63 63" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M677 677 c-35 0-63-28-63-63 s28-63 63-63" fill="none" stroke="var(--accent)" strokeWidth="2" />
            </>
          ) : (
            <>
              <circle cx="600" cy="600" r="180" fill="none" stroke="var(--text-primary)" strokeWidth="4" />
              <path d="M420 600 Q600 690 780 600 M420 600 Q600 510 780 600" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M600 420 Q690 600 600 780 M600 420 Q510 600 600 780" fill="none" stroke="var(--accent)" strokeWidth="2" />
            </>
          )}
        </g>
      </svg>
    </BgWrapper>
  );
};

// PÁGINA RANKING (Atletas - Aba Elite/Ranking)
export const RankingBackground = () => {
  const { esporte } = useEsporte();
  const isHandebol = esporte === 'handebol';

  return (
    <BgWrapper>
      {isHandebol ? (
        <>
          <style>{`
            @keyframes handballJump {
              0%, 100% { transform: translateY(0) rotate(0deg); }
              30% { transform: translateY(-35px) rotate(-8deg); }
              50% { transform: translateY(-40px) rotate(5deg); }
              70% { transform: translateY(-15px) rotate(2deg); }
            }
            @keyframes handballArm {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(-40deg); }
              45% { transform: rotate(50deg); }
              60% { transform: rotate(0deg); }
            }
            @keyframes handballBall {
              0%, 25% { transform: translate(0, 0) scale(1); opacity: 1; }
              45% { transform: translate(240px, 30px) scale(0.5); opacity: 0; }
              55% { transform: translate(0, 0) scale(1); opacity: 0; }
              65%, 100% { transform: translate(0, 0) scale(1); opacity: 1; }
            }
          `}</style>
          <svg viewBox="0 0 600 600" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <g strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(130, 130) scale(1.6)">
              <g style={{ animation: 'handballJump 4.5s cubic-bezier(0.4, 0, 0.2, 1) infinite' }} transformOrigin="100px 140px">
                {/* Head */}
                <circle cx="100" cy="65" r="15" stroke="var(--text-primary)" />
                {/* Torso (diagonal jumping position) */}
                <path d="M 100 80 L 90 150" stroke="var(--text-primary)" />
                {/* Left Leg (bent backwards for jump) */}
                <path d="M 90 150 L 60 175 L 65 205" stroke="var(--text-primary)" />
                {/* Right Leg (bent in front) */}
                <path d="M 90 150 L 110 200 L 95 235" stroke="var(--text-primary)" />
                {/* Left Arm (non-shooting hand, balancing out front) */}
                <path d="M 97 90 L 70 95 L 55 80" stroke="var(--text-primary)" />
                
                {/* Right Arm (throwing hand) */}
                <g style={{ animation: 'handballArm 4.5s cubic-bezier(0.34, 1.56, 0.64, 1) infinite' }} transformOrigin="98px 90px">
                  <path d="M 98 90 L 125 110 L 155 75" stroke="var(--text-primary)" />
                  {/* Handball Ball */}
                  <g style={{ animation: 'handballBall 4.5s cubic-bezier(0.2, 0, 0, 1) infinite' }} transformOrigin="165px 65px">
                    <circle cx="165" cy="65" r="10" stroke="var(--accent)" />
                    <path d="M 158 60 Q 165 72 172 60 M 158 70 Q 165 58 172 70" strokeWidth="1.5" stroke="var(--accent)" />
                  </g>
                </g>
              </g>
            </g>
          </svg>
        </>
      ) : (
        <>
          <style>{`
            @keyframes rankShootArm {
              0%, 100% { transform: rotate(0deg); }
              15% { transform: rotate(15deg); }
              30% { transform: rotate(-50deg); }
              40% { transform: rotate(-40deg); }
              60% { transform: rotate(0deg); }
            }
            @keyframes rankShootTorso {
              0%, 100% { transform: translateY(0); }
              15% { transform: translateY(15px); }
              30% { transform: translateY(-10px); }
              45% { transform: translateY(0); }
            }
            @keyframes rankShootBall {
              0%, 30% { transform: translate(0, 0) scale(1); opacity: 1; }
              50% { transform: translate(250px, 50px) scale(0.6); opacity: 0; }
              60% { transform: translate(0, 0) scale(1); opacity: 0; }
              70%, 100% { transform: translate(0, 0) scale(1); opacity: 1; }
            }
          `}</style>
          <svg viewBox="0 0 600 600" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <g strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(150, 150) scale(1.6)">
              <g style={{ animation: 'rankShootTorso 4.5s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}>
                {/* Head */}
                <circle cx="100" cy="70" r="15" stroke="var(--text-primary)" />
                {/* Torso */}
                <path d="M 100 85 L 100 160" stroke="var(--text-primary)" />
                {/* Left Leg */}
                <path d="M 100 160 L 90 200 L 110 240" stroke="var(--text-primary)" />
                {/* Right Leg */}
                <path d="M 100 160 L 130 240" stroke="var(--text-primary)" />
                {/* Left Arm (Balance) */}
                <path d="M 100 100 L 70 120 L 60 100" stroke="var(--text-primary)" />
                
                {/* Right Arm (Shooting) */}
                <g style={{ animation: 'rankShootArm 4.5s cubic-bezier(0.34, 1.56, 0.64, 1) infinite' }} transformOrigin="100px 100px">
                  <path d="M 100 100 L 130 130 L 150 90" stroke="var(--text-primary)" />
                  {/* Ball */}
                  <g style={{ animation: 'rankShootBall 4.5s cubic-bezier(0.2, 0, 0, 1) infinite' }} transformOrigin="160px 80px">
                    <circle cx="160" cy="80" r="12" stroke="var(--accent)" />
                    <path d="M 148 80 Q 160 92 172 80 M 148 80 Q 160 68 172 80" strokeWidth="2" stroke="var(--accent)" />
                  </g>
                </g>
              </g>
            </g>
          </svg>
        </>
      )}
    </BgWrapper>
  );
};

// PÁGINA JOGADORES (Atletas - Aba Todos/Recentes)
export const JogadoresBackground = () => {
  const { esporte } = useEsporte();
  const isHandebol = esporte === 'handebol';

  return (
    <BgWrapper>
      {isHandebol ? (
        <>
          <style>{`
            @keyframes handballRunBody {
              0% { transform: translateY(0); }
              50% { transform: translateY(6px); }
              100% { transform: translateY(0); }
            }
            @keyframes handballPassArm {
              0%, 100% { transform: rotate(-25deg); }
              50% { transform: rotate(15deg); }
            }
            @keyframes handballPassBall {
              0%, 100% { transform: translate(0, 0); }
              50% { transform: translate(30px, -20px); }
            }
          `}</style>
          <svg viewBox="0 0 600 600" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <g strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(150, 150) scale(1.5)">
              <g style={{ animation: 'handballRunBody 0.8s infinite' }}>
                {/* Head */}
                <circle cx="100" cy="50" r="15" stroke="var(--text-primary)" />
                {/* Torso (running pose) */}
                <path d="M 100 65 L 105 130" stroke="var(--text-primary)" />
                {/* Left Leg (moving forward) */}
                <path d="M 105 130 L 85 175 L 105 215" stroke="var(--text-primary)" />
                {/* Right Leg (pushed back) */}
                <path d="M 105 130 L 125 180 L 150 205" stroke="var(--text-primary)" />
                {/* Left Arm (forward/guarding) */}
                <path d="M 100 80 L 70 95 L 60 115" stroke="var(--text-primary)" />
                
                {/* Right Arm (passing) */}
                <g style={{ animation: 'handballPassArm 0.8s infinite' }} transformOrigin="100px 80px">
                  <path d="M 100 80 L 125 100 L 145 80" stroke="var(--text-primary)" />
                  {/* Handball Ball */}
                  <g style={{ animation: 'handballPassBall 0.8s infinite' }} transformOrigin="155px 70px">
                    <circle cx="155" cy="70" r="10" stroke="var(--accent)" />
                    <path d="M 148 65 Q 155 77 162 65 M 148 75 Q 155 63 162 75" strokeWidth="1.5" stroke="var(--accent)" />
                  </g>
                </g>
              </g>
            </g>
          </svg>
        </>
      ) : (
        <>
          <style>{`
            @keyframes dribbleBall {
              0% { transform: translateY(0px) scale(1, 1); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
              45% { transform: translateY(50px) scale(1, 1); animation-timing-function: linear; }
              50% { transform: translateY(55px) scale(1.4, 0.6); animation-timing-function: cubic-bezier(0, 0, 0.5, 1); }
              100% { transform: translateY(0px) scale(1, 1); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
            }
            @keyframes dribbleArm {
              0% { transform: rotate(-30deg); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
              50% { transform: rotate(10deg); animation-timing-function: cubic-bezier(0, 0, 0.5, 1); }
              100% { transform: rotate(-30deg); }
            }
            @keyframes dribbleBody {
              0% { transform: translateY(0); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
              50% { transform: translateY(4px); animation-timing-function: cubic-bezier(0, 0, 0.5, 1); }
              100% { transform: translateY(0); }
            }
          `}</style>
          <svg viewBox="0 0 600 600" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <g strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(150, 150) scale(1.5)">
              <g style={{ animation: 'dribbleBody 0.8s infinite' }}>
                {/* Head */}
                <circle cx="100" cy="50" r="15" stroke="var(--text-primary)" />
                {/* Torso (leaning forward) */}
                <path d="M 100 65 L 120 130" stroke="var(--text-primary)" />
                {/* Left Leg (back) */}
                <path d="M 120 130 L 90 180 L 110 220" stroke="var(--text-primary)" />
                {/* Right Leg (front) */}
                <path d="M 120 130 L 140 180 L 130 220" stroke="var(--text-primary)" />
                {/* Left Arm (guarding) */}
                <path d="M 100 80 L 130 90 L 150 70" stroke="var(--text-primary)" />
                
                {/* Right Arm (dribbling) */}
                <g style={{ animation: 'dribbleArm 0.8s infinite' }} transformOrigin="100px 80px">
                  <path d="M 100 80 L 110 120 L 140 140" stroke="var(--text-primary)" />
                </g>
              </g>
              {/* Ball */}
              <g style={{ animation: 'dribbleBall 0.8s infinite' }} transformOrigin="140px 150px">
                <circle cx="140" cy="150" r="14" stroke="var(--accent)" />
                <path d="M 126 150 Q 140 164 154 150 M 126 150 Q 140 136 154 150" strokeWidth="2" stroke="var(--accent)" />
              </g>
            </g>
          </svg>
        </>
      )}
    </BgWrapper>
  );
};

// PÁGINA JOGOS / PARTIDAS ATIVAS
export const JogosBackground = () => {
  const { esporte } = useEsporte();
  const isHandebol = esporte === 'handebol';

  return (
    <BgWrapper>
      <style>{`
        @keyframes courtBallBounce {
          0% { transform: translateY(220px) scale(1.4, 0.6); animation-timing-function: cubic-bezier(0, 0, 0.5, 1); }
          50% { transform: translateY(0px) scale(1, 1); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
          100% { transform: translateY(220px) scale(1.4, 0.6); animation-timing-function: cubic-bezier(0, 0, 0.5, 1); }
        }
        @keyframes courtBallMove {
          0% { transform: translateX(-300px); }
          100% { transform: translateX(300px); }
        }
      `}</style>
      <svg viewBox="0 0 800 800" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        {isHandebol ? (
          <>
            {/* Quadra de Handebol Line Art */}
            <g opacity="0.22" stroke="var(--text-primary)" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
              {/* Limites da Quadra */}
              <rect x="230" y="100" width="340" height="600" rx="2" />
              
              {/* Linha do Meio e Ponto Central */}
              <line x1="230" y1="400" x2="570" y2="400" />
              <circle cx="400" cy="400" r="10" fill="var(--text-primary)" />
              
              {/* Baliza/Gol Superior */}
              <rect x="360" y="70" width="80" height="30" stroke="var(--accent)" strokeWidth="3" />
              <path d="M360 70 L380 100 M380 70 L400 100 M400 70 L420 100 M420 70 L440 100 M380 70 L360 100 M400 70 L380 100 M420 70 L400 100 M440 70 L420 100" strokeWidth="1" opacity="0.5" />
              
              {/* Área do Goleiro (6m) Superior */}
              <path d="M 230 100 A 130 130 0 0 0 360 230 L 440 230 A 130 130 0 0 0 570 100" />
              
              {/* Linha de Tiro Livre (9m) Superior - Tracejada */}
              <path d="M 230 100 A 170 170 0 0 0 340 270 L 460 270 A 170 170 0 0 0 570 100" strokeDasharray="10 10" />
              
              {/* Marca do Penalti (7m) Superior */}
              <line x1="385" y1="250" x2="415" y2="250" strokeWidth="5" />
              
              {/* Baliza/Gol Inferior */}
              <rect x="360" y="700" width="80" height="30" stroke="var(--accent)" strokeWidth="3" />
              <path d="M360 700 L380 730 M380 700 L400 730 M400 700 L420 730 M420 700 L440 730 M380 700 L360 730 M400 700 L380 730 M420 700 L400 730 M440 700 L420 730" strokeWidth="1" opacity="0.5" />

              {/* Área do Goleiro (6m) Inferior */}
              <path d="M 230 700 A 130 130 0 0 1 360 570 L 440 570 A 130 130 0 0 1 570 700" />
              
              {/* Linha de Tiro Livre (9m) Inferior - Tracejada */}
              <path d="M 230 700 A 170 170 0 0 1 340 530 L 460 530 A 170 170 0 0 1 570 700" strokeDasharray="10 10" />
              
              {/* Marca do Penalti (7m) Inferior */}
              <line x1="385" y1="550" x2="415" y2="550" strokeWidth="5" />
            </g>
            
            {/* Bola de Handebol Quicando */}
            <g style={{ animation: 'courtBallMove 7s linear infinite alternate' }}>
              <g style={{ animation: 'courtBallBounce 0.8s infinite' }} transformOrigin="400px 400px">
                <circle cx="400" cy="400" r="14" stroke="var(--accent)" strokeWidth="4" fill="none" />
                <path d="M388 393 a11 11 0 0 0 11 11" strokeWidth="1.5" stroke="var(--accent)" fill="none" />
                <path d="M400 414 a11 11 0 0 0-11-11" strokeWidth="1.5" stroke="var(--accent)" fill="none" />
                <path d="M386 400 a11 11 0 0 0 11 11" strokeWidth="1.5" stroke="var(--accent)" fill="none" />
                <path d="M414 400 a11 11 0 0 0-11-11" strokeWidth="1.5" stroke="var(--accent)" fill="none" />
              </g>
            </g>
          </>
        ) : (
          <>
            {/* Quadra de Basquete Line Art */}
            <g opacity="0.25" stroke="var(--text-primary)" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
              {/* Limites da Quadra */}
              <rect x="150" y="100" width="500" height="600" rx="4" />
              
              {/* Linha do Meio e Círculo Central */}
              <line x1="150" y1="400" x2="650" y2="400" />
              <circle cx="400" cy="400" r="80" />
              
              {/* Garrafão Superior */}
              <rect x="310" y="100" width="180" height="160" />
              {/* Arco Lance Livre Superior */}
              <path d="M310 260 A 90 90 0 0 0 490 260" />
              <path d="M490 260 A 90 90 0 0 0 310 260" strokeDasharray="12 12" />
              {/* Linha de 3 Superior */}
              <path d="M200 100 L200 160 A 200 200 0 0 0 600 160 L600 100" />
              {/* Tabela e Aro Superior */}
              <line x1="360" y1="120" x2="440" y2="120" strokeWidth="6" />
              <circle cx="400" cy="135" r="15" stroke="var(--accent)" strokeWidth="3" />

              {/* Garrafão Inferior */}
              <rect x="310" y="540" width="180" height="160" />
              {/* Arco Lance Livre Inferior */}
              <path d="M490 540 A 90 90 0 0 0 310 540" />
              <path d="M310 540 A 90 90 0 0 0 490 540" strokeDasharray="12 12" />
              {/* Linha de 3 Inferior */}
              <path d="M200 700 L200 640 A 200 200 0 0 1 600 640 L600 700" />
              {/* Tabela e Aro Inferior */}
              <line x1="360" y1="680" x2="440" y2="680" strokeWidth="6" />
              <circle cx="400" cy="665" r="15" stroke="var(--accent)" strokeWidth="3" />
            </g>
            
            {/* Bola Quicando Pela Quadra */}
            <g style={{ animation: 'courtBallMove 7s linear infinite alternate' }}>
              <g style={{ animation: 'courtBallBounce 0.8s infinite' }} transformOrigin="400px 400px">
                <circle cx="400" cy="400" r="18" stroke="var(--accent)" strokeWidth="4" fill="none" />
                <path d="M382 400 Q400 418 418 400 M382 400 Q400 382 418 400" strokeWidth="2" stroke="var(--accent)" fill="none" />
              </g>
            </g>
          </>
        )}
      </svg>
    </BgWrapper>
  );
};

// PÁGINA TORNEIOS (Aba Torneios)
export const TorneiosBackground = () => {
  const { esporte } = useEsporte();
  const isHandebol = esporte === 'handebol';

  return (
    <BgWrapper>
      <style>{`
        @keyframes trophyFloatBig {
          0%, 100% { transform: translateY(-12px); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
          50% { transform: translateY(12px); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        }
        @keyframes ballOrbitBig {
          0% { transform: rotate(0deg) translateX(180px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(180px) rotate(-360deg); }
        }
      `}</style>
      <svg viewBox="0 0 600 600" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <g stroke="var(--text-primary)" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" 
           style={{ animation: 'trophyFloatBig 6s infinite' }} transformOrigin="300px 300px">
          <path d="M220 180 L380 180 L360 320 Q300 380 240 320 Z" />
          <path d="M300 350 L300 450" />
          <path d="M230 450 L370 450" />
          <path d="M220 210 Q160 210 180 270 Q200 290 230 290" />
          <path d="M380 210 Q440 210 420 270 Q400 290 370 290" />
        </g>
        <g style={{ animation: 'ballOrbitBig 7s linear infinite' }} transformOrigin="300px 300px">
          {isHandebol ? (
            <>
              <circle cx="300" cy="300" r="16" fill="none" stroke="var(--accent)" strokeWidth="4" />
              <path d="M286 293 a12 12 0 0 0 12 12" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
              <path d="M300 314 a12 12 0 0 0-12-12" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
              <path d="M284 300 a12 12 0 0 0 12 12" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
              <path d="M316 300 a12 12 0 0 0-12-12" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
            </>
          ) : (
            <>
              <circle cx="300" cy="300" r="20" fill="none" stroke="var(--accent)" strokeWidth="4" />
              <path d="M280 300 Q300 320 320 300 M280 300 Q300 280 320 300" stroke="var(--accent)" strokeWidth="2" fill="none" />
            </>
          )}
        </g>
      </svg>
    </BgWrapper>
  );
};

// PÁGINA ESTATÍSTICAS / PERFIL
export const StatsBackground = () => {
  const { esporte } = useEsporte();
  const isHandebol = esporte === 'handebol';

  return (
    <BgWrapper>
      <style>{`
        @keyframes barGrow1 { 0%, 100% { transform: scaleY(0.2); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); } 50% { transform: scaleY(0.9); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); } }
        @keyframes barGrow2 { 0%, 100% { transform: scaleY(0.6); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); } 50% { transform: scaleY(0.3); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); } }
        @keyframes barGrow3 { 0%, 100% { transform: scaleY(0.4); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); } 50% { transform: scaleY(0.8); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); } }
        @keyframes lineChartPulse { 0%, 100% { stroke-dashoffset: 400; opacity: 0.3; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); } 50% { stroke-dashoffset: 0; opacity: 0.8; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); } }
        @keyframes statsBallSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
      <svg viewBox="0 0 800 800" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <g stroke="var(--text-primary)" fill="none" opacity="0.6">
          <rect x="250" y="300" width="40" height="300" strokeWidth="4" transformOrigin="250px 600px" style={{ animation: 'barGrow1 5s infinite' }} />
          <rect x="350" y="300" width="40" height="300" strokeWidth="4" transformOrigin="350px 600px" style={{ animation: 'barGrow2 6s infinite' }} />
          <rect x="450" y="300" width="40" height="300" strokeWidth="4" transformOrigin="450px 600px" style={{ animation: 'barGrow3 5.5s infinite' }} />
          <rect x="550" y="300" width="40" height="300" strokeWidth="4" transformOrigin="550px 600px" style={{ animation: 'barGrow1 6.5s infinite' }} />
          
          <path d="M150 550 L270 420 L370 480 L470 320 L570 380 L690 200" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" 
                strokeDasharray="400" style={{ animation: 'lineChartPulse 8s infinite' }} stroke="var(--accent)" />
                
          <circle cx="690" cy="200" r="12" strokeWidth="4" stroke="var(--accent)" />
          <circle cx="470" cy="320" r="12" strokeWidth="4" stroke="var(--text-primary)" />
          <circle cx="270" cy="420" r="12" strokeWidth="4" stroke="var(--text-primary)" />
        </g>
        {/* Spinning ball inside graph */}
        <g style={{ animation: 'statsBallSpin 10s linear infinite' }} transformOrigin="690px 200px">
          {isHandebol ? (
            <>
              <circle cx="690" cy="200" r="20" fill="none" stroke="var(--accent)" strokeWidth="3" opacity="0.4" />
              <path d="M676 193 a15 15 0 0 0 15 15" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.4" />
              <path d="M690 214 a15 15 0 0 0-15-15" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.4" />
              <path d="M674 200 a15 15 0 0 0 15 15" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.4" />
              <path d="M706 200 a15 15 0 0 0-15-15" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.4" />
            </>
          ) : (
            <>
              <circle cx="690" cy="200" r="25" fill="none" stroke="var(--accent)" strokeWidth="3" opacity="0.4" />
              <path d="M665 200 Q690 225 715 200 M665 200 Q690 175 715 200" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.4" />
            </>
          )}
        </g>
      </svg>
    </BgWrapper>
  );
};
