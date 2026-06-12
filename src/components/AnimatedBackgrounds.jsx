import React from 'react';

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
export const HomeBackground = () => (
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
        <circle cx="200" cy="200" r="120" fill="none" stroke="var(--text-primary)" strokeWidth="4" />
        <path d="M80 200 Q200 260 320 200 M80 200 Q200 140 320 200" fill="none" stroke="var(--accent)" strokeWidth="2" />
        <path d="M200 80 Q260 200 200 320 M200 80 Q140 200 200 320" fill="none" stroke="var(--accent)" strokeWidth="2" />
      </g>
      <g style={{ animation: 'floatBall2 30s cubic-bezier(0.45, 0, 0.55, 1) infinite' }} transformOrigin="600px 600px">
        <circle cx="600" cy="600" r="180" fill="none" stroke="var(--text-primary)" strokeWidth="4" />
        <path d="M420 600 Q600 690 780 600 M420 600 Q600 510 780 600" fill="none" stroke="var(--accent)" strokeWidth="2" />
        <path d="M600 420 Q690 600 600 780 M600 420 Q510 600 600 780" fill="none" stroke="var(--accent)" strokeWidth="2" />
      </g>
    </svg>
  </BgWrapper>
);

// PÁGINA RANKING (Atletas - Aba Elite/Ranking)
export const RankingBackground = () => (
  <BgWrapper>
    <style>{`
      @keyframes rankShootArm {
        0% { transform: rotate(0deg); }
        15% { transform: rotate(-25deg); }
        30% { transform: rotate(160deg); }
        38% { transform: rotate(150deg); }
        45% { transform: rotate(155deg); }
        60% { transform: rotate(0deg); }
        100% { transform: rotate(0deg); }
      }
      @keyframes rankShootBall {
        0%, 15% { transform: translate(0, 0); opacity: 1; }
        30% { transform: translate(40px, -200px); opacity: 1; }
        45% { transform: translate(160px, -50px) scale(0.6); opacity: 0; }
        100% { transform: translate(0, 0); opacity: 0; }
      }
      @keyframes rankShootTorso {
        0%, 100% { transform: translateY(0); }
        15% { transform: translateY(12px); }
        30% { transform: translateY(-5px); }
        45% { transform: translateY(0); }
      }
    `}</style>
    <svg viewBox="0 0 600 600" width="100%" height="100%">
      <g strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(150, 150) scale(1.6)">
        <g style={{ animation: 'rankShootTorso 4.5s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}>
          <path d="M100 100 L110 180 L120 180 L130 100 Z" stroke="var(--text-primary)" />
          <path d="M110 180 L100 240 M120 180 L130 240" stroke="var(--text-primary)" />
          <circle cx="115" cy="70" r="18" stroke="var(--text-primary)" />
          <g style={{ animation: 'rankShootArm 4.5s cubic-bezier(0.34, 1.56, 0.64, 1) infinite' }} transformOrigin="100px 100px">
            <path d="M100 100 L70 120 L70 150" stroke="var(--text-primary)" />
            <g style={{ animation: 'rankShootBall 4.5s cubic-bezier(0.2, 0, 0, 1) infinite' }}>
              <circle cx="70" cy="165" r="12" stroke="var(--accent)" />
              <path d="M58 165 Q70 177 82 165 M58 165 Q70 153 82 165" strokeWidth="2" stroke="var(--accent)" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  </BgWrapper>
);

// PÁGINA JOGADORES (Atletas - Aba Todos/Recentes)
export const JogadoresBackground = () => (
  <BgWrapper>
    <style>{`
      @keyframes dribbleBall {
        0% { transform: translateY(0px) scale(1, 1); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
        45% { transform: translateY(80px) scale(1, 1); animation-timing-function: linear; }
        50% { transform: translateY(85px) scale(1.4, 0.6); animation-timing-function: cubic-bezier(0, 0, 0.5, 1); }
        100% { transform: translateY(0px) scale(1, 1); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
      }
      @keyframes dribbleArm {
        0% { transform: rotate(0deg); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        50% { transform: rotate(25deg); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        100% { transform: rotate(0deg); }
      }
      @keyframes dribbleBody {
        0% { transform: translateY(0); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        50% { transform: translateY(4px); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        100% { transform: translateY(0); }
      }
    `}</style>
    <svg viewBox="0 0 600 600" width="100%" height="100%">
      <g strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(150, 150) scale(1.5)">
        <g style={{ animation: 'dribbleBody 0.8s infinite' }}>
          <circle cx="100" cy="50" r="20" stroke="var(--text-primary)" />
          <path d="M100 70 L110 150 L90 150 Z" stroke="var(--text-primary)" />
          <path d="M110 150 L130 220 M90 150 L70 220" stroke="var(--text-primary)" />
          <path d="M100 85 L80 120 L90 140" stroke="var(--text-primary)" />
          <g style={{ animation: 'dribbleArm 0.8s infinite' }} transformOrigin="100px 85px">
            <path d="M100 85 L130 120 L120 160" stroke="var(--text-primary)" />
          </g>
        </g>
        <g style={{ animation: 'dribbleBall 0.8s infinite' }} transformOrigin="120px 175px">
          <circle cx="120" cy="175" r="15" stroke="var(--accent)" />
          <path d="M105 175 Q120 190 135 175 M105 175 Q120 160 135 175" strokeWidth="2" stroke="var(--accent)" />
        </g>
      </g>
    </svg>
  </BgWrapper>
);

// PÁGINA JOGOS (Aba Jogos)
export const JogosBackground = () => (
  <BgWrapper>
    <style>{`
      @keyframes courtLinesMove {
        0% { stroke-dashoffset: 400; }
        100% { stroke-dashoffset: 0; }
      }
      @keyframes courtBallBounce {
        0% { transform: translateY(180px) scale(1.4, 0.6); animation-timing-function: cubic-bezier(0, 0, 0.5, 1); }
        50% { transform: translateY(0) scale(1, 1); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
        100% { transform: translateY(180px) scale(1.4, 0.6); animation-timing-function: cubic-bezier(0, 0, 0.5, 1); }
      }
      @keyframes courtBallMove {
        0% { transform: translateX(-350px); }
        100% { transform: translateX(350px); }
      }
    `}</style>
    <svg viewBox="0 0 800 800" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <g strokeWidth="4" fill="none" opacity="0.7">
        <path d="M400 300 L100 800 M400 300 L700 800 M100 800 L700 800 M250 600 L550 600 M325 450 L475 450" 
              strokeDasharray="30 20" style={{ animation: 'courtLinesMove 4s linear infinite' }} stroke="var(--text-primary)" />
        <circle cx="400" cy="400" r="60" stroke="var(--text-primary)" />
        <path d="M200 800 Q400 500 600 800" stroke="var(--text-primary)" />
      </g>
      <g style={{ animation: 'courtBallMove 8s linear infinite alternate' }}>
        <g style={{ animation: 'courtBallBounce 0.9s infinite' }} transformOrigin="400px 500px">
          <circle cx="400" cy="500" r="30" stroke="var(--accent)" strokeWidth="5" />
          <path d="M370 500 Q400 530 430 500 M370 500 Q400 470 430 500" strokeWidth="2" stroke="var(--accent)" />
        </g>
      </g>
    </svg>
  </BgWrapper>
);

// PÁGINA TORNEIOS (Aba Torneios)
export const TorneiosBackground = () => (
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
        <circle cx="300" cy="300" r="20" fill="none" stroke="var(--accent)" strokeWidth="4" />
        <path d="M280 300 Q300 320 320 300 M280 300 Q300 280 320 300" stroke="var(--accent)" strokeWidth="2" fill="none" />
      </g>
    </svg>
  </BgWrapper>
);

// PÁGINA ESTATÍSTICAS / PERFIL
export const StatsBackground = () => (
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
        <circle cx="690" cy="200" r="25" fill="none" stroke="var(--accent)" strokeWidth="3" opacity="0.4" />
        <path d="M665 200 Q690 225 715 200 M665 200 Q690 175 715 200" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.4" />
      </g>
    </svg>
  </BgWrapper>
);
