import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, authAPI, profilesAPI, notificacoesAPI, masterAPI, PROFILE_SAFE_COLUMNS } from '../lib/supabase';
import { useEsporte } from './EsporteContext';
import { preloadBackgrounds } from '../lib/backgrounds';
import AuthScreen from '../components/AuthScreen';
import CompleteProfileScreen from '../components/CompleteProfileScreen';
import LocationGate from '../components/LocationGate';
import SplashCarregando from '../components/SplashCarregando';
import ContaSuspensa from '../components/ContaSuspensa';

// O Supabase guarda a sessão no aparelho numa chave "sb-<ref>-auth-token".
// Checar isso de forma síncrona evita piscar a tela de login para quem já
// está logado (a leitura da sessão em si é assíncrona).
function temSessaoSalva() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (chave && chave.startsWith('sb-') && chave.endsWith('-auth-token')) return true;
    }
  } catch (_) {
    /* sem localStorage: cai na tela de login normalmente */
  }
  return false;
}

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
  const perfilEmVoo = useRef(null);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [cityPrompt, setCityPrompt] = useState(null);
  const [pedirLocalizacao, setPedirLocalizacao] = useState(false);

  const [notificacoes, setNotificacoes] = useState([]);
  const [showNotificacoes, setShowNotificacoes] = useState(false);

  // ============================================================
  // Transição de entrada (login -> app)
  // A tela de login fica POR CIMA do app já montado e só sai quando o perfil
  // chegou. Assim o app aparece pronto (sem tela em branco, sem spinner solto
  // e sem montar tudo de uma vez, que era o que dava as travadas).
  // ============================================================
  const [bootOk, setBootOk] = useState(false);                 // já sabemos se há sessão?
  const [sessaoSalva] = useState(temSessaoSalva);              // havia sessão no aparelho?
  const [perfilDe, setPerfilDe] = useState(null);              // uid cujo perfil já foi resolvido
  const [entradaPorLogin, setEntradaPorLogin] = useState(false); // veio de um login (arremesso)
  const [arremessoAtivo, setArremessoAtivo] = useState(false);   // animação ainda rodando
  const [capaVisivel, setCapaVisivel] = useState(true);          // capa de entrada na tela?
  const [capaSaindo, setCapaSaindo] = useState(false);           // capa em fade-out

  const [editApelido, setEditApelido] = useState('');
  const [editPosicao, setEditPosicao] = useState('');
  const [editAltura, setEditAltura] = useState('');
  const [editIdade, setEditIdade] = useState('');
  const [editFoto, setEditFoto] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState(null);

  // Heartbeat de "último acesso": no máximo 1 escrita a cada 10 minutos por
  // dispositivo. Antes, cada abertura/refresh escrevia no banco e isso
  // disparava um evento Realtime em `jogadores` para TODOS os clientes.
  const CHAVE_PING = 'rh_ultimo_ping';
  function pingLastSeen(minutos = 10) {
    try {
      const agora = Date.now();
      const anterior = Number(localStorage.getItem(CHAVE_PING) || 0);
      if (anterior && agora - anterior < minutos * 60 * 1000) return;
      localStorage.setItem(CHAVE_PING, String(agora));
    } catch (_) {
      /* sem localStorage: segue e registra mesmo assim */
    }
    masterAPI.touchLastSeen().catch(() => {});
  }

  async function loadProfile(uid, retries = 0) {
    if (retries === 0) {
      // Na abertura do app, getSession() e onAuthStateChange disparam quase
      // juntos. Sem esta trava, o mesmo perfil era buscado duas vezes.
      if (perfilEmVoo.current === uid) return null;
      perfilEmVoo.current = uid;
    }
    try {
      const { data } = await profilesAPI.obterPerfil(uid);
      if (data) {
        setProfile(data);
        setEditApelido(data.apelido || '');
        setEditAltura(data.altura ? data.altura.toString().replace('.', ',') : '');
        setEditIdade(data.idade || '');
        setEditPosicao(data.posicao || cfg.posicoes[0]);
        setLoadingProfile(false);
        pingLastSeen();
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
          nome_completo: ((user?.user_metadata?.nome || user?.user_metadata?.full_name || '') + '').trim(),
          email: user?.email,
          foto_perfil: user?.user_metadata?.avatar_url || null,
          cadastro_completo: false
        };
        const { data: createdData } = await supabase
          .from('profiles')
          .insert([fallbackProfile])
          .select(PROFILE_SAFE_COLUMNS)
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
    } finally {
      if (retries === 0) {
        perfilEmVoo.current = null;
        // Marca que já sabemos o que mostrar para este usuário (mesmo se o
        // perfil não existir — aí cai na tela de completar cadastro).
        setPerfilDe(uid);
      }
    }
  }

  useEffect(() => {
    let ativo = true;

    // 1) Sessão salva no aparelho primeiro: é local (instantâneo) e evita
    //    piscar a tela de login para quem já está logado.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!ativo) return;
        const u = session?.user ?? null;
        setUser(u);
        setBootOk(true);
        if (u) {
          preloadBackgrounds();
          loadProfile(u.id);
        } else {
          setProfile(null);
          setPerfilDe(null);
          setLoadingProfile(false);
        }
      })
      .catch(() => {
        if (!ativo) return;
        setUser(null);
        setProfile(null);
        setPerfilDe(null);
        setLoadingProfile(false);
        setBootOk(true);
      });

    // 2) Em segundo plano, confirma com o servidor — mas não esperamos essa
    //    resposta para desenhar a tela (era daí que vinha o piscar do login).
    //    Se o token estiver expirado/revogado, o Supabase emite SIGNED_OUT e a
    //    tela de login volta sozinha.
    supabase.auth.getUser().catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u.id);
      } else {
        setProfile(null);
        setPerfilDe(null);
        setLoadingProfile(false);
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
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
      let authUserId = null;
      try {
        const { data: userData } = await supabase.auth.getUser();
        authUserId = userData?.user?.id || null;
      } catch (_) {}
      if (!authUserId) {
        try {
          const { data: sessData } = await supabase.auth.getSession();
          authUserId = sessData?.session?.user?.id || null;
        } catch (_) {}
      }
      if (!authUserId) authUserId = prof?.id || null;
      if (!authUserId) {
        console.error('Sem usuário autenticado para criar jogador');
        return;
      }

      const { data: newJogador, error: jogError } = await supabase
        .from('jogadores')
        .insert([{
          nome: (prof.nome_completo || '').trim() || (prof.apelido || '').trim() || 'Atleta',
          apelido: (prof.apelido || '').trim() || null,
          foto_url: prof.foto_perfil || null,
          criado_por: authUserId,
          cidade: prof.cidade_atual || prof.cidade || null,
          uf: prof.uf || 'PA',
          posicao: prof.posicao || cfg.posicoes[0],
          esporte: esporte,
          ativo: true,
          total_votos: 0,
          media_estrelas: 0.00
        }])
        .select()
        .maybeSingle();

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
    if (cityPrompt && profile) {
      localStorage.setItem(`rejeitou_${profile.id}_${cityPrompt.city}_${hojeISO()}`, 'true');
      marcarVerificadaHoje(profile);
    }
    setCityPrompt(null);
  }

  const hojeISO = () => new Date().toISOString().slice(0, 10);

  // Pede permissão de forma explícita (pelo app, antes do aviso do navegador)
  // e confere a cidade no máximo uma vez por dia por usuário.
  async function verificarLocalizacao(prof) {
    if (!navigator.geolocation || !prof?.cadastro_completo) return;
    try {
      if (localStorage.getItem(`loc_verificada_${prof.id}`) === hojeISO()) return;
    } catch { /* sem localStorage: segue */ }

    let estado = 'prompt';
    try {
      const r = await navigator.permissions?.query({ name: 'geolocation' });
      if (r?.state) estado = r.state;
    } catch { /* navegador sem Permissions API: trata como 'prompt' */ }

    if (estado === 'denied') return;
    if (estado === 'prompt') { setPedirLocalizacao(true); return; }
    conferirCidadePorGPS(prof);
  }

  function marcarVerificadaHoje(prof) {
    try { localStorage.setItem(`loc_verificada_${prof.id}`, hojeISO()); } catch { /* ignora */ }
  }

  function conferirCidadePorGPS(prof) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`, {
          headers: { 'Accept-Language': 'pt-BR' }
        });
        const data = await res.json();
        const address = data.address || {};
        const detectedCity = address.municipality || address.city || address.town || address.village || null;
        const stateName = (address.state || '').toLowerCase();
        const detectedUf = ESTADO_TO_UF[stateName] || null;
        if (!detectedCity || !detectedUf) return;

        const atual = (prof.cidade_atual || '').toLowerCase();
        if (detectedCity.toLowerCase() !== atual) {
          // Recusa vale só para o dia, para o app perguntar de novo se a pessoa mudar de lugar.
          const recusou = localStorage.getItem(`rejeitou_${prof.id}_${detectedCity}_${hojeISO()}`);
          if (!recusou) {
            setCityPrompt({ city: detectedCity, uf: detectedUf, latitude, longitude });
          }
        }
        marcarVerificadaHoje(prof);
      } catch (err) {
        console.error('Erro na geolocalização / geocodificação:', err);
      }
    }, (err) => {
      console.warn('Erro ao obter coordenadas de geolocalização:', err);
    });
  }

  // Chamado pelo botão "Permitir" no aviso do app.
  function pedirLocalizacaoAgora() {
    setPedirLocalizacao(false);
    if (profile) conferirCidadePorGPS(profile);
  }

  // Chamado pelo botão "Agora não": não pergunta de novo hoje.
  function dispensarPedidoLocalizacao() {
    setPedirLocalizacao(false);
    if (profile) marcarVerificadaHoje(profile);
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
        const detectedCity = address.municipality || address.city || address.town || address.village || null;
        const stateName = (address.state || '').toLowerCase();
        const detectedUf = ESTADO_TO_UF[stateName] || null;

        // Sem cidade ou UF identificados, não sugere troca nenhuma.
        if (!detectedCity || !detectedUf) return;
        const detectedCountry = address.country || 'Brasil';

        let authUserId = null;
        try {
          const { data: userData } = await supabase.auth.getUser();
          authUserId = userData?.user?.id || null;
        } catch (_) {}
        if (!authUserId) {
          try {
            const { data: sessData } = await supabase.auth.getSession();
            authUserId = sessData?.session?.user?.id || null;
          } catch (_) {}
        }
        if (!authUserId) authUserId = profile?.id || null;
        if (!authUserId) throw new Error('Não foi possível identificar seu usuário. Saia e entre novamente.');

        const { data: newJogador, error: jogError } = await supabase
          .from('jogadores')
          .insert([{
            nome: (profile.nome_completo || '').trim() || (profile.apelido || '').trim() || 'Atleta',
            apelido: (profile.apelido || '').trim() || null,
            foto_url: profile.foto_perfil || null,
            criado_por: authUserId,
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
    // Limpa o campo: assim dá para escolher o mesmo arquivo de novo se precisar.
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErroPerfil('Por favor, selecione uma imagem válida.');
      return;
    }
    // Foto acima de 5 MB não é recusada: o upload comprime no aparelho
    // (ver src/lib/imagens.js).

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

  async function handleExcluirNotificacao(id) {
    const { error } = await notificacoesAPI.excluir(id);
    if (!error) {
      setNotificacoes(prev => prev.filter(n => n.id !== id));
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

  // ---- transição de entrada ----
  // O app (ou a tela de completar perfil) é montado POR BAIXO da capa assim que
  // o perfil chega — então, quando a capa sai, o app já está pronto e pintado.
  // "Pronto" = sabemos quem é o usuário E já resolvemos o perfil dele (mesmo
  // que o perfil não exista ainda — aí cai na tela de completar cadastro).
  // Esse sinal explícito evita piscar telas ao sair e entrar de novo.
  const conteudoPronto = !!user && perfilDe === user.id;

  // Só revelamos depois que a animação de arremesso termina.
  const podeSair = conteudoPronto && !arremessoAtivo;

  // Qual capa fica por cima enquanto o app ainda não pode aparecer.
  const capaModo = entradaPorLogin
    ? 'auth'
    : user
      ? 'carregando'
      : (!bootOk && sessaoSalva) ? 'carregando' : 'auth';

  // 1) app pronto -> começa a revelar
  useEffect(() => {
    if (capaVisivel && podeSair) setCapaSaindo(true);
  }, [capaVisivel, podeSair]);

  // 2) terminado o fade, a capa sai de cena
  useEffect(() => {
    if (!capaSaindo) return;
    const t = setTimeout(() => {
      setCapaVisivel(false);
      setCapaSaindo(false);
      setEntradaPorLogin(false);
      setArremessoAtivo(false);
    }, 450);
    return () => clearTimeout(t);
  }, [capaSaindo]);

  // 3) saiu da conta -> a tela de login volta
  useEffect(() => {
    if (bootOk && !user && !capaVisivel) setCapaVisivel(true);
  }, [bootOk, user, capaVisivel]);

  // 4) se o perfil demorar depois do arremesso, avisamos que ainda estamos indo
  const [esperaLonga, setEsperaLonga] = useState(false);
  useEffect(() => {
    if (!entradaPorLogin || arremessoAtivo || conteudoPronto) {
      setEsperaLonga(false);
      return;
    }
    const t = setTimeout(() => setEsperaLonga(true), 1200);
    return () => clearTimeout(t);
  }, [entradaPorLogin, arremessoAtivo, conteudoPronto]);

  // 5) rede de segurança: se o perfil do usuário atual não foi resolvido,
  //    tenta de novo — sem isso a capa poderia ficar presa na tela.
  useEffect(() => {
    if (user && perfilDe !== user.id) loadProfile(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, perfilDe]);

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
    pedirLocalizacao,
    pedirLocalizacaoAgora,
    dispensarPedidoLocalizacao,
    solicitarLocalizacaoBanner,
    handleMarcarLida,
    handleMarcarTodasLidas,
    handleExcluirNotificacao,
    carregarNotificacoes,
    logout: async () => {
      await authAPI.logout();
      setShowUserMenu(false);
    },
  };

  // O app por baixo (monta assim que o perfil chega, ainda coberto pela capa)
  const precisaLocalizacao = !!(
    profile &&
    profile.cadastro_completo &&
    !(profile.cidade_atual || profile.cidade)
  );

  // Conta suspensa pelo Master (profiles.is_active = false).
  //
  // O master NUNCA é bloqueado aqui — se não, o dono poderia se trancar fora do
  // próprio painel. Suspender de verdade funciona: a pessoa cai nesta tela.
  const contaSuspensa = !!profile && profile.is_active === false && profile.role !== 'master';

  const conteudo = !conteudoPronto ? null : (
    contaSuspensa ? (
      <ContaSuspensa
        onSair={async () => {
          await authAPI.logout();
          setShowUserMenu(false);
        }}
      />
    ) : (!profile || !profile.cadastro_completo) ? (
      <CompleteProfileScreen
        profile={profile}
        onComplete={(updatedProfile) => {
          setProfile(updatedProfile);
          setEditApelido(updatedProfile.apelido || '');
          setEditAltura(updatedProfile.altura ? updatedProfile.altura.toString().replace('.', ',') : '');
          setEditIdade(updatedProfile.idade || '');
        }}
      />
    ) : precisaLocalizacao ? (
      <LocationGate
        profile={profile}
        onResolved={(updatedProfile) => {
          setProfile(updatedProfile);
        }}
      />
    ) : (
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    )
  );

  return (
    <>
      {conteudo}

      {capaVisivel && (
        <div
          style={{
            // Com o app montado por baixo, a capa flutua por cima. Sem app
            // (login puro), ela segue no fluxo normal — importante para o
            // teclado não cobrir o formulário no celular.
            ...(conteudo
              ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5000 }
              : { position: 'relative', width: '100%' }),
            pointerEvents: capaSaindo ? 'none' : 'auto',
            // Fade só com opacity: é o que roda na GPU, sem repintar a tela.
            opacity: capaSaindo ? 0 : 1,
            transition: capaSaindo ? 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }}
        >
          {capaModo === 'auth' ? (
            <AuthScreen
              aguardando={esperaLonga}
              onStartAnimation={() => {
                // Já sabemos que o usuário vem para o app: aproveita a
                // animação para baixar o fundo e montar o app por baixo.
                preloadBackgrounds();
                setEntradaPorLogin(true);
                setArremessoAtivo(true);
              }}
              onFinishAnimation={() => setArremessoAtivo(false)}
            />
          ) : (
            <SplashCarregando />
          )}
        </div>
      )}
    </>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
