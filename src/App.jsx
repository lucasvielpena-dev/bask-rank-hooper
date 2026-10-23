import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import './styles/global.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { EsporteProvider } from './contexts/EsporteContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

import Home from './pages/Home';
import Atletas from './pages/Atletas';
const Explorar = lazy(() => import('./pages/Explorar'));
const Jogos = lazy(() => import('./pages/Jogos'));
const Racoes = lazy(() => import('./pages/Racoes'));
const Stats = lazy(() => import('./pages/Stats'));
const MasterDashboard = lazy(() => import('./pages/MasterDashboard'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminCities = lazy(() => import('./pages/AdminCities'));
const AdminPlayers = lazy(() => import('./pages/AdminPlayers'));
const AdminNotifications = lazy(() => import('./pages/AdminNotifications'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminLogs = lazy(() => import('./pages/AdminLogs'));
const AdminActivity = lazy(() => import('./pages/AdminActivity'));

// ============================================================
// TROCA DE ABA SEM REMONTAR A TELA
// ============================================================
// Antes, cada toque no menu de baixo DESMONTAVA a tela atual e montava a nova do
// zero. Montar de novo custa caro no celular: recria a lista inteira (centenas
// de elementos), recria os avatares (que piscam até a imagem voltar), reavalia o
// CSS e trava o fio principal por um instante — e enquanto ele está travado, o
// toque do usuário é engolido ("toque e não responde").
//
// Agora as abas de baixo ficam MONTADAS depois da primeira visita e a troca é só
// mostrar/esconder. A rolagem de cada aba é preservada e nada é recriado.
// Telas de admin/detalhe continuam montando na hora, como sempre foram.
const ABAS_FIXAS = ['inicio', 'atletas', 'racoes', 'jogos', 'perfil'];

function chaveDaTela(p, props) {
  return `${p}|${props?.aba || ''}|${props?.openAdd ? 'a' : ''}|${props?.filtro || ''}`;
}

function AppRoutes() {
  const { profile } = useAuth();
  const [page, setPage] = useState('inicio');
  const [pageProps, setPageProps] = useState({});

  const chave = chaveDaTela(page, pageProps);

  // Lista de telas que ficam vivas (as abas de baixo). A chave muda quando a
  // navegação pede algo específico (aba do torneios, abrir "adicionar atleta"),
  // e nesse caso a tela é montada de novo com o pedido certo.
  const abasRef = useRef([{ chave: chaveDaTela('inicio', {}), page: 'inicio', props: {} }]);

  const abas = useMemo(() => {
    if (!ABAS_FIXAS.includes(page)) return abasRef.current;
    if (abasRef.current.some((t) => t.chave === chave)) return abasRef.current;
    const semMesmaPagina = abasRef.current.filter((t) => t.page !== page);
    const lista = [...semMesmaPagina, { chave, page, props: pageProps }].slice(-ABAS_FIXAS.length);
    abasRef.current = lista;
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useEffect(() => {
    // Deploy novo: limpa o service worker/cache antigo e SEGUE, sem recarregar.
    // O app já está rodando o pacote novo, então recarregar aqui só dava a
    // sensação de "o app recarregou sozinho". Atualização forçada (com reload)
    // fica só no botão da faixa "Nova versão disponível".
    const swVersion = 'v39';
    try {
      if (localStorage.getItem('sw_version') === swVersion) return;
      localStorage.setItem('sw_version', swVersion);
    } catch (_) {
      /* sem localStorage: segue mesmo assim, sem travar o app */
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
    }
  }, []);

  function navigate(to, props = {}) {
    setPage(to);
    setPageProps(props);
  }

  function renderPage(t) {
    const props = t.props || {};
    switch (t.page) {
      case 'inicio': return <Home profile={profile} onNavigate={navigate} />;
      case 'atletas': return <Atletas profile={profile} initialOpenAdd={props.openAdd} initialFiltro={props.filtro} onNavigate={navigate} />;
      case 'explorar': return <Explorar profile={profile} onNavigate={navigate} />;
      case 'torneios': return <Jogos profile={profile} initialAba="torneios" />;
      case 'jogos': return <Jogos profile={profile} initialAba={props.aba || 'jogos'} />;
      case 'racoes': return <Racoes profile={profile} onNavigate={navigate} />;
      case 'perfil': return <Stats profile={profile} onNavigate={navigate} />;
      case 'master': return <MasterDashboard onNavigate={navigate} />;
      case 'master-users': return <AdminUsers profile={profile} onNavigate={navigate} />;
      case 'master-cities': return <AdminCities profile={profile} onNavigate={navigate} />;
      case 'master-players': return <AdminPlayers profile={profile} onNavigate={navigate} />;
      case 'master-activity': return <AdminActivity profile={profile} onNavigate={navigate} />;
      case 'master-notifications': return <AdminNotifications profile={profile} onNavigate={navigate} />;
      case 'master-reports': return <AdminReports profile={profile} onNavigate={navigate} />;
      case 'master-logs': return <AdminLogs profile={profile} onNavigate={navigate} />;
      default: return <Home profile={profile} onNavigate={navigate} />;
    }
  }

  const ehAbaFixa = ABAS_FIXAS.includes(page);
  const estiloTela = (visivel) => ({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    zIndex: visivel ? 1 : 0,
    visibility: visivel ? 'visible' : 'hidden',
    pointerEvents: visivel ? 'auto' : 'none',
    // Cada tela rola dentro de si mesma. Sem isto, a altura das telas escondidas
    // se somaria e daria para rolar "para dentro do vazio" na tela que está na
    // frente. Assim cada aba tem a sua rolagem, independente e preservada.
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
  });

  return (
    <Layout page={page} onNavigate={navigate}>
      {/* Abas de baixo já visitadas: ficam aqui, escondidas quando não são a atual */}
      {abas.map((t) => {
        const visivel = t.chave === chave;
        return (
          <div key={t.chave} style={estiloTela(visivel)}>
            {/* Se UMA tela quebrar, o header e o menu continuam de pé. */}
            <ErrorBoundary compacto><Suspense fallback={<div className="loading"><div className="spinner" /></div>}>{renderPage(t)}</Suspense></ErrorBoundary>
          </div>
        );
      })}

      {/* Telas fora do menu (admin, explorar, torneios...): montam e desmontam como antes */}
      {!ehAbaFixa && (
        <div key={chave} style={estiloTela(true)}>
          <ErrorBoundary compacto><Suspense fallback={<div className="loading"><div className="spinner" /></div>}>{renderPage({ page, props: pageProps })}</Suspense></ErrorBoundary>
        </div>
      )}
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
