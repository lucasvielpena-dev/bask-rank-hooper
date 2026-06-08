import { useState, useEffect } from 'react';
import { supabase, authAPI, profilesAPI, notificacoesAPI } from './lib/supabase';
import './styles/global.css';
import { IconMenu, IconSino, IconVoltar, IconClose, IconEditar, IconCamera, IconEnviar, IconCheck, IconLocalizacao } from './components/Icons';

import Home from './pages/Home';
import Ranking from './pages/Ranking';
import Jogadores from './pages/Jogadores';
import Jogos from './pages/Jogos';
import Stats from './pages/Stats';

import AuthScreen from './components/AuthScreen';
import CompleteProfileScreen from './components/CompleteProfileScreen';

const ESTADO_TO_UF = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amazonas': 'AM', 'bahia': 'BA',
  'ceará': 'CE', 'distrito federal': 'DF', 'espírito santo': 'ES', 'goiás': 'GO',
  'maranhão': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  'pará': 'PA', 'paraíba': 'PB', 'paraná': 'PR', 'pernambuco': 'PE', 'piauí': 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  'rondônia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC', 'são paulo': 'SP',
  'sergipe': 'SE', 'tocantins': 'TO'
};

const PAGES = {
  inicio: { label: 'Início', icon: 'court' },
  ranking: { label: 'Ranking', icon: 'trophy' },
  jogos: { label: 'Jogos', icon: 'basketball' },
  jogadores: { label: 'Jogadores', icon: 'users' },
  perfil: { label: 'Perfil', icon: 'perfil' },
};

function NavIcon({ type, active }) {
  const color = active ? 'var(--nav-active-color)' : 'var(--nav-inactive-color)';
  const s = { width: 22, height: 22 };
  if (type === 'court') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <circle cx="12" cy="12" r="3" />
      <path d="M2 9a3 3 0 0 1 3 3 3 3 0 0 1-3 3" />
      <path d="M22 9a3 3 0 0 0-3 3 3 3 0 0 0 3 3" />
    </svg>
  );
  if (type === 'trophy') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;
  if (type === 'users') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (type === 'basketball') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 1 0 20" />
      <path d="M2 12h20" />
      <path d="M6.2 6.2a8.5 8.5 0 0 0 0 11.6" />
      <path d="M17.8 6.2a8.5 8.5 0 0 1 0 11.6" />
    </svg>
  );
  if (type === 'perfil') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
  return null;
}

export default function App() {
  // Garantir a limpeza de cache do Service Worker na mudança de versão do app
  useEffect(() => {
    const swVersion = 'v15';
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

  const [page, setPage] = useState('inicio');
  const [pageProps, setPageProps] = useState({});
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [themePref, setThemePref] = useState('system');
  const [cityPrompt, setCityPrompt] = useState(null);

  // States de notificações
  const [notificacoes, setNotificacoes] = useState([]);
  const [showNotificacoes, setShowNotificacoes] = useState(false);

  // States para edição do perfil
  const [editApelido, setEditApelido] = useState('');
  const [editPosicao, setEditPosicao] = useState('');
  const [editAltura, setEditAltura] = useState('');
  const [editIdade, setEditIdade] = useState('');
  const [editFoto, setEditFoto] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState(null);

  const handleEditFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setErroPerfil('Por favor, selecione uma imagem válida.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErroPerfil('A imagem de perfil deve ter no máximo 2MB.');
      return;
    }
    
    setUploadingFoto(true);
    setErroPerfil(null);
    try {
      const { publicUrl, error } = await profilesAPI.uploadAvatar(profile.id, file);
      if (error) throw error;
      setEditFoto(publicUrl);
    } catch (err) {
      setErroPerfil('Erro ao carregar imagem: ' + err.message);
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleEditAlturaChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    let formatted = '';
    if (digits.length > 0) {
      if (digits.length === 1) {
        formatted = digits;
      } else if (digits.length === 2) {
        formatted = `${digits[0]},${digits[1]}`;
      } else {
        formatted = `${digits[0]},${digits.substring(1, 3)}`;
      }
    }
    setEditAltura(formatted);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        loadProfile(user.id);
      } else {
        setProfile(null);
        setLoadingProfile(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u.id);
      } else {
        setProfile(null);
        setLoadingProfile(false);
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile && profile.id) {
      verificarLocalizacao(profile);
      verificarEAutoCriarJogador(profile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function verificarEAutoCriarJogador(prof) {
    if (prof.cadastro_completo && !prof.player_id) {
      console.log('Detectado perfil completo sem player_id. Iniciando auto-correção...');
      try {
        const { data: existingJogador } = await supabase
          .from('jogadores')
          .select('id')
          .eq('criado_por', prof.id)
          .maybeSingle();

        let player_id = existingJogador?.id;

        if (!player_id) {
          const { data: newJogador, error: jogError } = await supabase
            .from('jogadores')
            .insert([{
              nome: prof.nome_completo || 'Jogador',
              apelido: prof.apelido || 'Jogador',
              foto_url: prof.foto_perfil || null,
              criado_por: prof.id,
              cidade: prof.cidade_atual || prof.cidade || 'Altamira',
              uf: prof.uf || 'PA',
              ativo: true,
              total_votos: 0,
              media_estrelas: 0.00
            }])
            .select()
            .single();

          if (jogError) throw jogError;
          if (newJogador) {
            player_id = newJogador.id;
          }
        }

        if (player_id) {
          const { data: updatedProfile, error: profError } = await profilesAPI.atualizar(prof.id, {
            player_id: player_id,
            is_player: true
          });
          if (!profError && updatedProfile) {
            setProfile(updatedProfile);
            console.log('Perfil corrigido com sucesso! player_id vinculado:', player_id);
          }
        }
      } catch (err) {
        console.error('Erro na auto-correção do jogador:', err);
      }
    }
  }

  async function handleConfirmCityUpdate() {
    if (!cityPrompt || !profile) return;
    try {
      const updates = {
        cidade: cityPrompt.city,
        cidade_atual: cityPrompt.city,
        uf: cityPrompt.uf,
        latitude: cityPrompt.latitude,
        longitude: cityPrompt.longitude,
        latitude_atual: cityPrompt.latitude,
        longitude_atual: cityPrompt.longitude,
        ultima_mudanca_cidade: new Date().toISOString()
      };

      const { data: updatedProfile, error } = await profilesAPI.atualizar(profile.id, updates);
      if (!error && updatedProfile) {
        if (updatedProfile.player_id) {
          await supabase
            .from('jogadores')
            .update({
              cidade: cityPrompt.city,
              uf: cityPrompt.uf
            })
            .eq('id', updatedProfile.player_id);
        }
        setProfile(updatedProfile);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCityPrompt(null);
    }
  }

  function handleRejectCityUpdate() {
    if (cityPrompt) {
      localStorage.setItem(`rejected_city_update_${cityPrompt.city}`, 'true');
    }
    setCityPrompt(null);
  }

  async function solicitarLocalizacaoBanner() {
    if (!navigator.geolocation) {
      alert('Seu dispositivo não suporta geolocalização.');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`, {
          headers: { 'Accept-Language': 'pt-BR' }
        });
        const data = await res.json();
        const address = data.address || {};
        const detectedCity = address.city || address.town || address.village || address.municipality || 'Altamira';
        const stateName = (address.state || '').toLowerCase();
        const detectedUf = ESTADO_TO_UF[stateName] || 'PA';
        const detectedCountry = address.country || 'Brasil';

        // 1. Criar novo jogador diretamente
        const { data: newJogador, error: jogError } = await supabase
          .from('jogadores')
          .insert([{
            nome: profile.nome_completo || 'Jogador',
            apelido: profile.apelido || 'Jogador',
            foto_url: profile.foto_perfil || null,
            criado_por: profile.id,
            cidade: detectedCity,
            uf: detectedUf,
            pais: detectedCountry,
            ativo: true,
            total_votos: 0,
            media_estrelas: 0.00
          }])
          .select()
          .single();

        if (jogError) throw jogError;

        if (newJogador) {
          // 2. Atualizar perfil
          const { data: updatedProfile, error: profError } = await profilesAPI.atualizar(profile.id, {
            player_id: newJogador.id,
            is_player: true,
            cidade: detectedCity,
            cidade_atual: detectedCity,
            uf: detectedUf,
            pais: detectedCountry,
            latitude: latitude,
            longitude: longitude,
            latitude_atual: latitude,
            longitude_atual: longitude,
          });

          if (!profError && updatedProfile) {
            setProfile(updatedProfile);
            alert(`Sucesso! Seu perfil de jogador foi criado em ${detectedCity} - ${detectedUf}.`);
          }
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao obter localização ou registrar: ' + err.message);
      }
    }, (err) => {
      console.warn(err);
      alert('Acesso à localização negado. Permita o acesso nas configurações do seu navegador para participar.');
    });
  }

  async function verificarLocalizacao(prof) {
    if (!navigator.geolocation || !prof.player_id) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`, {
          headers: { 'Accept-Language': 'pt-BR' }
        });
        const data = await res.json();
        const address = data.address || {};
        const detectedCity = address.city || address.town || address.village || address.municipality || 'Altamira';
        const stateName = (address.state || '').toLowerCase();
        const detectedUf = ESTADO_TO_UF[stateName] || 'PA';

        // Se detectou uma cidade diferente da cadastrada atualmente
        if (detectedCity.toLowerCase() !== (prof.cidade_atual || '').toLowerCase()) {
          const alreadyRejected = localStorage.getItem(`rejected_city_update_${detectedCity}`);
          if (!alreadyRejected) {
            setCityPrompt({
              city: detectedCity,
              uf: detectedUf,
              latitude,
              longitude
            });
          }
        }
      } catch (err) {
        console.error('Erro na geolocalização / geocodificação:', err);
      }
    }, (err) => {
      console.warn('Erro ao obter coordenadas de geolocalização:', err);
    });
  }

  async function carregarNotificacoes() {
    const { data } = await notificacoesAPI.listar();
    if (data) {
      setNotificacoes(data);
    }
  }

  async function handleMarcarLida(id) {
    const { error } = await notificacoesAPI.marcarComoLida(id);
    if (!error) {
      setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    }
  }

  async function handleMarcarTodasLidas() {
    const { error } = await notificacoesAPI.marcarTodasComoLidas();
    if (!error) {
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    }
  }

  useEffect(() => {
    if (user) {
      carregarNotificacoes();

      const channel = supabase
        .channel(`notificacoes_user_${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notificacoes'
        }, (payload) => {
          if ((payload.new && payload.new.usuario_id === user.id) || (payload.old && payload.old.usuario_id === user.id)) {
            carregarNotificacoes();
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setNotificacoes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const applyTheme = () => {
      let currentTheme = themePref;
      if (themePref === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        currentTheme = isDark ? 'dark' : 'light';
      }
      
      if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
    };

    applyTheme();

    if (themePref === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [themePref]);

  async function handleUpdateTheme(theme) {
    setThemePref(theme);
    if (profile && profile.id) {
      try {
        const { data, error } = await profilesAPI.atualizar(profile.id, {
          tema_preferido: theme
        });
        if (!error && data) {
          setProfile(data);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function loadProfile(uid, retries = 0) {
    try {
      const { data } = await profilesAPI.obterPerfil(uid);
      if (data) {
        setProfile(data);
        setEditApelido(data.apelido || '');
        setEditAltura(data.altura ? data.altura.toString().replace('.', ',') : '');
        setEditIdade(data.idade || '');
        setEditPosicao(data.posicao || 'Ala');
        setThemePref(data.tema_preferido || 'system');
        setLoadingProfile(false);
      } else if (retries < 3) {
        // Se o trigger do Supabase ainda não completou a inserção, tenta novamente em 1s
        setTimeout(() => loadProfile(uid, retries + 1), 1000);
      } else {
        // Fallback: criar perfil no front-end caso o trigger do banco não tenha rodado
        const fallbackProfile = {
          id: uid,
          nome_completo: user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email || 'Jogador',
          email: user?.email,
          foto_perfil: user?.user_metadata?.avatar_url || null,
          cadastro_completo: false
        };
        
        const { data: createdData } = await supabase
          .from('profiles')
          .insert([fallbackProfile])
          .select()
          .single();

        if (createdData) {
          setProfile(createdData);
          setEditApelido(createdData.apelido || '');
          setEditAltura(createdData.altura || '');
          setEditIdade(createdData.idade || '');
          setEditPosicao(createdData.posicao || 'Ala');
          setThemePref(createdData.tema_preferido || 'system');
        } else {
          setProfile(fallbackProfile);
        }
        setLoadingProfile(false);
      }
    } catch (e) {
      console.error(e);
      setLoadingProfile(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSalvandoPerfil(true);
    setErroPerfil(null);

    const parsedAltura = parseFloat(editAltura.toString().replace(',', '.'));
    const parsedIdade = parseInt(editIdade);

    try {
      if (!editApelido.trim()) {
        throw new Error('Por favor, informe seu apelido.');
      }
      if (isNaN(parsedAltura) || parsedAltura <= 0 || parsedAltura > 3) {
        throw new Error('Por favor, informe uma altura válida (ex: 1.85).');
      }
      if (isNaN(parsedIdade) || parsedIdade <= 0 || parsedIdade > 120) {
        throw new Error('Por favor, informe uma idade válida.');
      }

      // Validar apelido duplicado no banco
      const { data: dupApelido } = await supabase
        .from('profiles')
        .select('id')
        .eq('apelido', editApelido.trim())
        .maybeSingle();
      
      if (dupApelido && dupApelido.id !== profile.id) {
        throw new Error('Este apelido já está em uso por outro jogador.');
      }

      const { data, error } = await profilesAPI.atualizar(profile.id, {
        apelido: editApelido.trim(),
        altura: parsedAltura,
        idade: parsedIdade,
        foto_perfil: editFoto,
        posicao: editPosicao
      });

      if (error) throw error;

      // Sincronizar com a tabela jogadores diretamente (fallback robusto para triggers do banco)
      if (data && data.player_id) {
        await supabase
          .from('jogadores')
          .update({
            apelido: editApelido.trim(),
            foto_url: editFoto,
            posicao: editPosicao
          })
          .eq('id', data.player_id);
      }

      setProfile(data);
      setIsEditingProfile(false);
    } catch (err) {
      setErroPerfil(err.message || 'Erro ao salvar alterações.');
    } finally {
      setSalvandoPerfil(false);
    }
  }

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
      default: return <Home profile={profile} onNavigate={navigate} />;
    }
  }

  // 1. Fluxo de Carregamento
  if (user && loadingProfile) {
    return (
      <div className="app-shell" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="loading"><div className="spinner" />Carregando perfil...</div>
      </div>
    );
  }

  // 2. Fluxo: Sem autenticação -> Bloquear acesso total
  if (!user) {
    return <AuthScreen />;
  }

  // 3. Fluxo: Autenticado mas sem cadastro completo -> Bloquear e exigir preenchimento
  if (!profile || !profile.cadastro_completo) {
    return (
      <CompleteProfileScreen 
        profile={profile} 
        onComplete={(updatedProfile) => {
          setProfile(updatedProfile);
          setEditApelido(updatedProfile.apelido || '');
          setEditAltura(updatedProfile.altura ? updatedProfile.altura.toString().replace('.', ',') : '');
          setEditIdade(updatedProfile.idade || '');
        }} 
      />
    );
  }

  // 4. Fluxo: Acesso total liberado
  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)'
      }}>
        {/* Hamburger Menu Icon */}
        <button 
          onClick={() => setShowUserMenu(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <IconMenu size={22} color="var(--text-primary)" />
        </button>

        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 900,
            fontSize: '15px',
            letterSpacing: '0.08em',
            color: 'var(--text-primary)',
            textTransform: 'uppercase'
          }}>
            RANKS <span style={{ color: '#60A5FA' }}>HOOPS</span>
          </div>
        </div>

        {/* Right Actions: Notification Bell + Profile Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Bell Icon with Badge */}
          <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setShowNotificacoes(true)}>
            <IconSino size={22} color="#F8FAFC" />
            {notificacoes.filter(n => !n.lida).length > 0 && (
              <span style={{
                position: 'absolute',
                top: -2,
                right: -2,
                background: '#F97316',
                color: '#FFF',
                fontSize: '8px',
                fontWeight: 800,
                width: 13,
                height: 13,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #080F1A'
              }}>
                {notificacoes.filter(n => !n.lida).length}
              </span>
            )}
          </div>

          {/* Profile Avatar */}
          <div 
            onClick={() => setShowUserMenu(true)}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            {profile.foto_perfil ? (
              <img 
                src={profile.foto_perfil} 
                alt="Avatar" 
                style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', objectFit: 'cover' }} 
              />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>
                {profile.nome_completo?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Banner de Solicitação de Localização */}
      {profile && profile.cadastro_completo && !profile.player_id && (
        <div style={{
          background: 'rgba(245,158,11,0.12)',
          borderBottom: '1px solid rgba(245,158,11,0.2)',
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          textAlign: 'center'
        }}>
          <span style={{ fontSize: 13, color: '#fde047', fontWeight: 600 }}>
            Para participar dos rankings municipais, é necessário permitir acesso à localização.
          </span>
          <button 
            onClick={solicitarLocalizacaoBanner}
            style={{
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Permitir Localização
          </button>
        </div>
      )}

      {/* Page */}
      <div key={page} className="page-transition">
        {renderPage()}
      </div>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        {Object.entries(PAGES).map(([key, cfg]) => (
          <button
            key={key}
            className={`nav-item ${page === key ? 'active' : ''}`}
            onClick={() => { setPage(key); setPageProps({}); }}
          >
            <NavIcon type={cfg.icon} active={page === key} />
            <span>{cfg.label}</span>
          </button>
        ))}
      </nav>

      {/* Modal Menu Usuário / Meu Perfil */}
      {showUserMenu && user && profile && (
        <div className="modal-overlay" onClick={() => { if (!salvandoPerfil) { setShowUserMenu(false); setIsEditingProfile(false); } }}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, textAlign: 'center' }}>
              {isEditingProfile ? 'Editar Perfil' : 'Meu Perfil'}
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              {isEditingProfile ? 'Atualize suas informações pessoais' : 'Informações do seu perfil de atleta'}
            </p>

            {erroPerfil && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                color: '#f87171',
                padding: '10px 14px',
                fontSize: 13,
                marginBottom: 16
              }}>
                ⚠️ {erroPerfil}
              </div>
            )}

            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Foto de Perfil
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {editFoto ? (
                      <img src={editFoto} alt="Preview" style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border)', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue-light)', fontWeight: 700, fontSize: 18 }}>
                        {profile.nome_completo?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditFileChange}
                      style={{ display: 'none' }}
                      id="edit-profile-file"
                      disabled={uploadingFoto}
                    />
                    <label htmlFor="edit-profile-file" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, width: 'auto' }}>
                      {uploadingFoto ? <div className="spinner" style={{ width: 12, height: 12 }} /> : 'Alterar Foto'}
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Apelido *
                  </label>
                  <input
                    required
                    type="text"
                    value={editApelido}
                    onChange={(e) => setEditApelido(e.target.value)}
                    placeholder="Ex: DD, Viel..."
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Posição de Jogo *
                  </label>
                  <select
                    required
                    value={editPosicao}
                    onChange={(e) => setEditPosicao(e.target.value)}
                  >
                    <option value="Armador">Armador</option>
                    <option value="Ala-Armador">Ala-Armador</option>
                    <option value="Ala">Ala</option>
                    <option value="Ala-Pivô">Ala-Pivô</option>
                    <option value="Pivô">Pivô</option>
                  </select>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Altura (m) *
                    </label>
                    <input
                      required
                      type="text"
                      inputMode="decimal"
                      value={editAltura}
                      onChange={handleEditAlturaChange}
                      placeholder="Ex: 1,85"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Idade *
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="120"
                      value={editIdade}
                      onChange={(e) => setEditIdade(e.target.value)}
                      placeholder="Ex: 25"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => { setIsEditingProfile(false); setErroPerfil(null); }}
                    style={{ flex: 1 }}
                    disabled={salvandoPerfil}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ flex: 2 }}
                    disabled={salvandoPerfil}
                  >
                    {salvandoPerfil ? <div className="spinner" /> : 'Salvar'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)' }}>
                  {profile.foto_perfil ? (
                    <img 
                      src={profile.foto_perfil} 
                      alt="Avatar" 
                      style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border)' }} 
                    />
                  ) : (
                    <div className="avatar">
                      {profile.nome_completo?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <div style={{ fontWeight: 700 }}>{profile.nome_completo}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{profile.email}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="card" style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>APELIDO</div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14 }}>{profile.apelido}</div>
                  </div>
                  <div className="card" style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>ALTURA</div>
                    <div style={{ fontWeight: 800, color: '#60a5fa', fontSize: 14 }}>{Number(profile.altura).toFixed(2)}m</div>
                  </div>
                  <div className="card" style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>IDADE</div>
                    <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: 14 }}>{profile.idade} anos</div>
                  </div>
                </div>

                {/* Seleção de Tema */}
                <div style={{ marginTop: 8, marginBottom: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 8, textAlign: 'center' }}>
                    Tema do Aplicativo
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { key: 'light', label: '☀️ Claro' },
                      { key: 'dark', label: '🌙 Escuro' },
                      { key: 'system', label: '📱 Sistema' }
                    ].map(t => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => handleUpdateTheme(t.key)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: 8,
                          border: themePref === t.key ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                          background: themePref === t.key ? 'rgba(59,130,246,0.15)' : 'none',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditApelido(profile.apelido || '');
                      setEditAltura(profile.altura ? profile.altura.toString().replace('.', ',') : '');
                      setEditIdade(profile.idade || '');
                      setEditFoto(profile.foto_perfil || '');
                      setEditPosicao(profile.posicao || 'Ala');
                      setIsEditingProfile(true);
                    }}
                    style={{ flex: 1 }}
                  >
                    Editar Perfil
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={async () => {
                      await authAPI.logout();
                      setShowUserMenu(false);
                    }}
                    style={{ flex: 1, color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
                  >
                    Sair da Conta
                  </button>
                </div>

                <button className="btn btn-primary" onClick={() => setShowUserMenu(false)}>
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Mudança de Cidade */}
      {cityPrompt && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-sheet" style={{ maxWidth: 400, padding: 24, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <IconLocalizacao size={40} color="var(--accent-blue-light)" />
            </div>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Mudar cidade de competição?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Detectamos que você está em <strong>{cityPrompt.city} - {cityPrompt.uf}</strong>. Deseja atualizar sua cidade de competição?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button 
                onClick={handleConfirmCityUpdate}
                style={{
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 50,
                  padding: '12px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Atualizar
              </button>
              <button 
                onClick={handleRejectCityUpdate}
                style={{
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 50,
                  padding: '12px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Manter Atual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Notificações */}
      {showNotificacoes && (
        <div className="modal-overlay" onClick={() => setShowNotificacoes(false)} style={{ zIndex: 1000 }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 900, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}><IconSino size={20} color="var(--text-primary)" /> Notificações</h3>
              {notificacoes.filter(n => !n.lida).length > 0 && (
                <button 
                  onClick={handleMarcarTodasLidas}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#60A5FA',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: 0
                  }}
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
              {notificacoes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ marginBottom: 12, opacity: 0.5, display: 'flex', justifyContent: 'center' }}>
                    <IconSino size={40} color="currentColor" />
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 600 }}>Nenhuma notificação por aqui</p>
                  <p style={{ fontSize: '11px', marginTop: 4 }}>Você será avisado sempre que receber avaliações de outros jogadores.</p>
                </div>
              ) : (
                notificacoes.map(n => (
                  <div 
                    key={n.id} 
                    style={{
                      background: n.lida ? 'rgba(255,255,255,0.01)' : 'rgba(249, 115, 22, 0.04)',
                      border: n.lida ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(249, 115, 22, 0.15)',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      gap: 12,
                      position: 'relative',
                      alignItems: 'flex-start',
                      transition: 'all 0.2s'
                    }}
                  >
                    {!n.lida && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        background: '#F97316',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '16px',
                        right: '16px'
                      }} />
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {n.titulo}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: 8 }}>
                        {n.mensagem}
                      </p>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {new Date(n.created_at).toLocaleDateString('pt-BR')} às {new Date(n.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {!n.lida && (
                      <button
                        onClick={() => handleMarcarLida(n.id)}
                        style={{
                          background: 'rgba(249, 115, 22, 0.12)',
                          color: '#F97316',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '9px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          alignSelf: 'center'
                        }}
                      >
                        Lida
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={() => setShowNotificacoes(false)} 
              style={{ width: '100%', marginTop: 10 }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
