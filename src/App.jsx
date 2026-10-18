import { useState, useEffect } from 'react';
import './styles/global.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { EsporteProvider } from './contexts/EsporteContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

import Home from './pages/Home';
import Atletas from './pages/Atletas';
import Explorar from './pages/Explorar';
import Jogos from './pages/Jogos';
import Racoes from './pages/Racoes';
import Stats from './pages/Stats';
import Destaques from './pages/Destaques';
import MasterDashboard from './pages/MasterDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminCities from './pages/AdminCities';
import AdminPlayers from './pages/AdminPlayers';
import AdminTournaments from './pages/AdminTournaments';
import AdminNotifications from './pages/AdminNotifications';
import AdminReports from './pages/AdminReports';
import AdminLogs from './pages/AdminLogs';
import AdminActivity from './pages/AdminActivity';

function AppRoutes() {
  const { profile } = useAuth();
  const [page, setPage] = useState('inicio');
  const [pageProps, setPageProps] = useState({});

  useEffect(() => {
    const swVersion = 'v31';
    const currentVersion = localStorage.getItem('sw_version');
    if (currentVersion !== swVersion) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          if (registrations.length > 0) {
            for (let registration of registrations) {
              registration.unregister();
            }
            localStorage.setItem('sw_version', swVersion);
            window.location.reload();
          } else {
            localStorage.setItem('sw_version', swVersion);
          }
        });
      } else {
        localStorage.setItem('sw_version', swVersion);
      }
    }
  }, []);

  function navigate(to, props = {}) {
    setPage(to);
    setPageProps(props);
  }

  function renderPage() {
    switch (page) {
      case 'inicio': return <Home profile={profile} onNavigate={navigate} />;
      case 'atletas': return <Atletas profile={profile} initialOpenAdd={pageProps.openAdd} onNavigate={navigate} />;
      case 'explorar': return <Explorar profile={profile} onNavigate={navigate} />;
      case 'torneios': return <Jogos profile={profile} initialAba="torneios" />;
      case 'jogos': return <Jogos profile={profile} initialAba={pageProps.aba || 'jogos'} />;
      case 'racoes': return <Racoes profile={profile} onNavigate={navigate} />;
      case 'perfil': return <Stats profile={profile} onNavigate={navigate} />;
      case 'destaques': return <Destaques profile={profile} onNavigate={navigate} />;
      case 'master': return <MasterDashboard onNavigate={navigate} />;
      case 'master-users': return <AdminUsers profile={profile} onNavigate={navigate} />;
      case 'master-cities': return <AdminCities profile={profile} onNavigate={navigate} />;
      case 'master-players': return <AdminPlayers profile={profile} onNavigate={navigate} />;
      case 'master-activity': return <AdminActivity profile={profile} onNavigate={navigate} />;
      case 'master-tournaments': return <AdminTournaments profile={profile} onNavigate={navigate} />;
      case 'master-notifications': return <AdminNotifications profile={profile} onNavigate={navigate} />;
      case 'master-reports': return <AdminReports profile={profile} onNavigate={navigate} />;
      case 'master-logs': return <AdminLogs profile={profile} onNavigate={navigate} />;
      default: return <Home profile={profile} onNavigate={navigate} />;
    }
  }

  return (
    <Layout page={page} onNavigate={(p) => navigate(p)}>
      {/* Se UMA tela quebrar, o header e o menu continuam de pé. */}
      <ErrorBoundary compacto key={page}>
        {renderPage()}
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <EsporteProvider>
        {/* Última linha de defesa: nada de tela escura muda. Fica fora do
            AuthProvider para também cobrir a lógica de entrada no app. */}
        <ErrorBoundary>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ErrorBoundary>
      </EsporteProvider>
    </ThemeProvider>
  );
}
