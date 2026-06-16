import { memo } from 'react';
import { useEsporte } from '../contexts/EsporteContext';

export const PAGES = {
  inicio: { label: 'Início', icon: 'court' },
  atletas: { label: 'Atletas', icon: 'users' },
  jogos: { label: 'Jogos', icon: 'basketball' },
  perfil: { label: 'Perfil', icon: 'perfil' },
};

const NavIcon = memo(function NavIcon({ type, active }) {
  const color = active ? 'var(--nav-active-color)' : 'var(--nav-inactive-color)';
  const s = { width: 22, height: 22 };
  if (type === 'court') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M12 3v18"/>
      <path d="M3 12h18"/>
    </svg>
  );
  if (type === 'trophy') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;
  if (type === 'users') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (type === 'basketball') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a14.5 14.5 0 0 1 0 20"/>
      <path d="M2 12h20"/>
    </svg>
  );
  if (type === 'handball') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2c-2 3-3 7-3 10s1 7 3 10"/>
      <path d="M12 2c2 3 3 7 3 10s-1 7-3 10"/>
      <path d="M2 12h20"/>
    </svg>
  );
  if (type === 'perfil') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
  if (type === 'shield') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
  return null;
});

export default memo(function BottomNavigation({ page, onNavigate, isMaster }) {
  const { esporte } = useEsporte();

  const dynamicPages = {
    ...PAGES,
    jogos: { label: 'Jogos', icon: esporte === 'handebol' ? 'handball' : 'basketball' },
  };

  const allPages = isMaster
    ? { ...dynamicPages, master: { label: 'Admin', icon: 'shield' } }
    : dynamicPages;

  return (
    <nav className="bottom-nav premium-nav">
      {Object.entries(allPages).map(([key, cfg]) => (
        <button
          key={key}
          className={`nav-item premium-nav-item ${page === key || (key === 'master' && page.startsWith('master')) ? 'active' : ''}`}
          onClick={() => onNavigate(key)}
        >
          <NavIcon type={cfg.icon} active={page === key || (key === 'master' && page.startsWith('master'))} />
          <span>{cfg.label}</span>
        </button>
      ))}
    </nav>
  );
});
