import { useState, useEffect } from 'react';
import './styles/global.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';

import Home from './pages/Home';
import Ranking from './pages/Ranking';
import Jogadores from './pages/Jogadores';
import Jogos from './pages/Jogos';
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

function AppRoutes() {
  const { profile } = useAuth();
  const [page, setPage] = useState('inicio');
  const [pageProps, setPageProps] = useState({});

  useEffect(() => {
    const swVersion = 'v18';
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
      case 'ranking': return <Ranking profile={profile} />;
      case 'jogadores': return <Jogadores profile={profile} initialOpenAdd={pageProps.openAdd} />;
      case 'torneios': return <Jogos profile={profile} initialAba="torneios" />;
      case 'jogos': return <Jogos profile={profile} initialAba={pageProps.aba || 'jogos'} />;
      case 'perfil': return <Stats profile={profile} onNavigate={navigate} />;
      case 'destaques': return <Destaques profile={profile} onNavigate={navigate} />;
      case 'master': return <MasterDashboard onNavigate={navigate} />;
      case 'master-users': return <AdminUsers profile={profile} onNavigate={navigate} />;
      case 'master-cities': return <AdminCities profile={profile} onNavigate={navigate} />;
      case 'master-players': return <AdminPlayers profile={profile} onNavigate={navigate} />;
      case 'master-tournaments': return <AdminTournaments profile={profile} onNavigate={navigate} />;
      case 'master-notifications': return <AdminNotifications profile={profile} onNavigate={navigate} />;
      case 'master-reports': return <AdminReports profile={profile} onNavigate={navigate} />;
      case 'master-logs': return <AdminLogs profile={profile} onNavigate={navigate} />;
      default: return <Home profile={profile} onNavigate={navigate} />;
    }
  }

  return (
    <Layout page={page} onNavigate={(p) => navigate(p)}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
