import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, authAPI, profilesAPI, notificacoesAPI, masterAPI } from '../lib/supabase';
import { useEsporte } from './EsporteContext';
import AuthScreen from '../components/AuthScreen';
import CompleteProfileScreen from '../components/CompleteProfileScreen';

const ESTADO_TO_UF = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amazonas': 'AM', 'bahia': 'BA',
  'ceará': 'CE', 'distrito federal': 'DF', 'espírito santo': 'ES', 'goiás': 'GO',
  'maranhão': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  'pará': 'PA', 'paraíba': 'PB', 'paraná': 'PR', 'pernambuco': 'PE', 'piauí': 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  'rondônia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC', 'são paulo': 'SP',
  'sergipe': 'SE', 'tocantins': 'TO'
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { esporte, cfg } = useEsporte();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const playerCreationLock = useRef(false);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [cityPrompt, setCityPrompt] = useState(null);

  const [notificacoes, setNotificacoes] = useState([]);
  const [showNotificacoes, setShowNotificacoes] = useState(false);

  const [isLoginAnimating, setIsLoginAnimating] = useState(false);

  const [editApelido, setEditApelido] = useState('');
  const [editPosicao, setEditPosicao] = useState('');
  const [editAltura, setEditAltura] = useState('');
  const [editIdade, setEditIdade] = useState('');
  const [editFoto, setEditFoto] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState(null);

  async function loadProfile(uid, retries = 0) {
    try {
      const { data } = await profilesAPI.obterPerfil(uid);
      if (data) {
        setProfile(data);
        setEditApelido(data.apelido || '');
        setEditAltura(data.altura ? data.altura.toString().replace('.', ',') : '');
        setEditIdade(data.idade || '');
        setEditPosicao(data.posicao || cfg.posicoes[0]);
        setLoadingProfile(false);
        masterAPI.touchLastSeen().catch(() => {});
        return data;
      } else if (retries < 3) {
        const loaded = await new Promise((resolve) => {
          setTimeout(async () => {
            const result = await loadProfile(uid, retries + 1);
            resolve(result);
          }, 1000);
        });
        return loaded;
      } else {
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
          setEditPosicao(createdData.posicao || cfg.posicoes[0]);
        } else {
          setProfile(fallbackProfile);
        }
        setLoadingProfile(false);
        return createdData || fallbackProfile;
      }
    } catch (e) {
      console.error(e);
      setLoadingProfile(false);
      return null;
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        console.warn('Auth getUser error:', error.message);
        supabase.auth.getSession().then(({ data: { session } }) => {
          setUser(session?.user ?? null);
          if (session?.user) {
            loadProfile(session.user.id);
          } else {
            setProfile(null);
            setLoadingProfile(false);
          }
        }).catch(() => {
          setUser(null);
          setProfile(null);
          setLoadingProfile(false);
        });
        return;
      }
      setUser(user);
      if (user) {
        loadProfile(user.id);
      } else {
        setProfile(null);
        setLoadingProfile(false);
      }
    }).catch((err) => {
      console.warn('Auth init error:', err);
      setUser(null);
      setProfile(null);
      setLoadingProfile(false);
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
  }, []);

  useEffect(() => {
    if (profile && profile.id) {
      verificarLocalizacao(profile);
      verificarEAutoCriarJogador(profile);
    }
  }, [profile?.id, esporte]);

  async function verificarEAutoCriarJogador(prof) {
    if (!prof.cadastro_completo) return;
    if (playerCreationLock.current) return;
    playerCreationLock.current = true;

    try {
      // 1. Verificar se já existe um jogador associado a este usuário e modalidade/esporte ativa
      const { data: existingJogador } = await supabase
        .from('jogadores')
        .select('id')
        .eq('criado_por', prof.id)
        .eq('esporte', esporte)
        .maybeSingle();

      if (existingJogador) {
        // Se existe mas o perfil aponta para outro ID (por exemplo, de outra modalidade), atualiza a referência
        if (prof.player_id !== existingJogador.id) {
          console.log(`Atualizando player_id do profile para o jogador de ${esporte}...`);
          const { data: updatedProfile, error: profError } = await profilesAPI.atualizar(prof.id, {
            player_id: existingJogador.id,
            is_player: true
          });
          if (!profError && updatedProfile) {
            setProfile(updatedProfile);
          }
        }
        return;
      }

      // 2. Se não existir jogador para esta modalidade/esporte, criamos um novo
      console.log(`Criando jogador de ${esporte} para o perfil...`, prof.nome_completo, prof.id);
      const { data: newJogador, error: jogError } = await supabase
        .from('jogadores')
        .insert([{
          nome: prof.nome_completo || 'Jogador',
          apelido: prof.apelido || 'Jogador',
          foto_url: prof.foto_perfil || null,
          criado_por: prof.id,
          cidade: prof.cidade_atual || prof.cidade || 'Altamira',
          uf: prof.uf || 'PA',
          posicao: prof.posicao || cfg.posicoes[0],
          esporte: esporte,
          ativo: true,
          total_votos: 0,
          media_estrelas: 0.00
        }])
        .select()
        .single();

      if (jogError) {
        console.error('Erro ao criar jogador:', jogError);
        throw jogError;
      }

      if (newJogador) {
        console.log(`Jogador de ${esporte} criado:`, newJogador.id);
        const { data: updatedProfile, error: profError } = await profilesAPI.atualizar(prof.id, {
          player_id: newJogador.id,
          is_player: true
        });
        if (!profError && updatedProfile) {
          setProfile(updatedProfile);
          console.log('Perfil atualizado com player_id:', newJogador.id);
        } else {
          console.error('Erro ao atualizar profile:', profError);
        }
      }
    } catch (err) {
      console.error('Erro na auto-correção do jogador:', err);
    } finally {
      playerCreationLock.current = false;
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

  function verificarLocalizacao(prof) {
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
            esporte: esporte,
            ativo: true,
            total_votos: 0,
            media_estrelas: 0.00
          }])
          .select()
          .single();

        if (jogError) throw jogError;

        if (newJogador) {
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

  async function handleUpdateTheme(theme) {
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
  }, [user]);

  if (!user || isLoginAnimating) {
    return <AuthScreen 
      onStartAnimation={() => setIsLoginAnimating(true)} 
      onFinishAnimation={() => setIsLoginAnimating(false)} 
    />;
  }

  if (user && loadingProfile) {
    return (
      <div className="app-shell" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="loading" style={{ position: 'relative', zIndex: 1 }}><div className="spinner" />Carregando perfil...</div>
      </div>
    );
  }

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

  const value = {
    user,
    profile,
    setProfile,
    loadingProfile,
    isMaster: profile?.role === 'master',
    isAdmin: profile?.role === 'master' || profile?.role === 'admin',
    showUserMenu,
    setShowUserMenu,
    isEditingProfile,
    setIsEditingProfile,
    cityPrompt,
    setCityPrompt,
    notificacoes,
    showNotificacoes,
    setShowNotificacoes,
    editApelido,
    setEditApelido,
    editPosicao,
    setEditPosicao,
    editAltura,
    setEditAltura,
    editIdade,
    setEditIdade,
    editFoto,
    setEditFoto,
    uploadingFoto,
    salvandoPerfil,
    erroPerfil,
    setErroPerfil,
    handleEditFileChange,
    handleEditAlturaChange,
    handleSaveProfile,
    handleUpdateTheme,
    handleConfirmCityUpdate,
    handleRejectCityUpdate,
    solicitarLocalizacaoBanner,
    handleMarcarLida,
    handleMarcarTodasLidas,
    logout: async () => {
      await authAPI.logout();
      setShowUserMenu(false);
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
