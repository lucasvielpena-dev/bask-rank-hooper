import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://rmqloznmfalxhujvwywl.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_6sC3nyq5WABhB3Jmf8tYQg_K8HT_lTs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// API helpers
// ============================================================

export const jogadoresAPI = {
  listar: async () => {
    const { data, error } = await supabase
      .from('jogadores')
      .select('*')
      .eq('ativo', true)
      .order('media_estrelas', { ascending: false })
      .order('total_votos', { ascending: false });
    return { data, error };
  },

  listarPorEstado: async (uf) => {
    const { data, error } = await supabase
      .from('jogadores')
      .select('*')
      .eq('ativo', true)
      .eq('uf', uf)
      .order('media_estrelas', { ascending: false })
      .order('total_votos', { ascending: false });
    return { data, error };
  },

};

export const rankingAPI = {
  get: async (cidade, uf, limit = 50) => {
    const { data, error } = await supabase.rpc('get_ranking', {
      p_cidade: cidade || null,
      p_uf: uf || null,
      p_limit: limit
    });
    return { data, error };
  },

  getTop5: async (cidade, uf) => {
    const { data, error } = await supabase.rpc('get_ranking', {
      p_cidade: cidade || null,
      p_uf: uf || null,
      p_limit: 5
    });
    return { data, error };
  },
};

export const votacaoAPI = {
  votar: async (jogadorId, avaliacao, metadata = {}) => {
    const { data, error } = await supabase.rpc('registrar_avaliacao', {
      p_jogador_id: jogadorId,
      p_arremesso: avaliacao.arremesso,
      p_defesa: avaliacao.defesa,
      p_controle_de_bola: avaliacao.controle_de_bola,
      p_explosao_fisica: avaliacao.explosao_fisica,
      p_visao_de_jogo: avaliacao.visao_de_jogo,
      p_ip: metadata.ip || null,
      p_device_id: metadata.deviceId || null,
      p_localizacao: metadata.localizacao || null,
      p_comentario: avaliacao.comentario || null
    });
    return { data, error };
  },

  getStatusHoje: async () => {
    const { data, error } = await supabase.rpc('get_status_voto_hoje');
    return { data, error };
  },
};

export const jogosAPI = {
  listar: async () => {
    const { data, error } = await supabase
      .from('jogos')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  criar: async (jogo) => {
    const user = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase
      .from('jogos')
      .insert([{ ...jogo, criado_por: user?.id }])
      .select()
      .single();
    return { data, error };
  },

  atualizar: async (id, updates) => {
    const { data, error } = await supabase
      .from('jogos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },
};

export const estatisticasPessoaisAPI = {
  obterMinhas: async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: [], error: new Error("Usuário não autenticado") };
    
    const { data, error } = await supabase
      .from('estatisticas_pessoais')
      .select('*')
      .eq('usuario_id', user.id)
      .order('data_partida', { ascending: false })
      .order('created_at', { ascending: false });
    return { data, error };
  },

  registrar: async (stats) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: null, error: new Error("Usuário não autenticado") };

    const { data, error } = await supabase
      .from('estatisticas_pessoais')
      .insert([{ ...stats, usuario_id: user.id }])
      .select()
      .single();
    return { data, error };
  },

  excluir: async (id) => {
    const { data, error } = await supabase
      .from('estatisticas_pessoais')
      .delete()
      .eq('id', id);
    return { data, error };
  }
};

export const authAPI = {
  login: async (email, senha) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return { data, error };
  },

  registrar: async (email, senha, nome) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });
    return { data, error };
  },

  loginGoogle: async () => {
    const redirectUrl = window.location.origin.endsWith('/') 
      ? window.location.origin 
      : `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    return { data, error };
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  recuperarSenha: async (email) => {
    const redirectUrl = window.location.origin.endsWith('/') 
      ? window.location.origin 
      : `${window.location.origin}/`;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { data, error };
  },
};

export const profilesAPI = {
  obterPerfil: async (id) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  },

  atualizar: async (id, updates) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  listarPorEstado: async (uf) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('uf', uf)
      .eq('cadastro_completo', true)
      .order('nome_completo');
    return { data, error };
  },

  uploadAvatar: async (userId, file) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `avatars/${userId}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    
    // Tenta criar o bucket 'avatars' caso ele não exista (fallback de segurança)
    try {
      await supabase.storage.createBucket('avatars', { public: true });
    } catch (e) {
      console.warn('Erro ou permissão insuficiente para criar bucket:', e);
    }
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });
      
    if (uploadError) return { error: uploadError };
    
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
      
    return { publicUrl: data?.publicUrl, error: null };
  }
};

export const denunciasAPI = {
  criar: async (denuncia) => {
    const user = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase
      .from('denuncias')
      .insert([{
        ...denuncia,
        denunciante_id: user?.id
      }])
      .select()
      .single();
    return { data, error };
  }
};

export const partidasAPI = {
  listar: async () => {
    const { data, error } = await supabase
      .from('partidas')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  obterJogadoresDaPartida: async (partidaId) => {
    const { data, error } = await supabase
      .from('partida_jogadores')
      .select('*, jogador:jogadores(nome, apelido)')
      .eq('partida_id', partidaId);
    return { data, error };
  },

  criar: async (partida) => {
    const { data, error } = await supabase
      .from('partidas')
      .insert([partida])
      .select()
      .single();
    return { data, error };
  },

  adicionarJogadores: async (jogadores) => {
    const { data, error } = await supabase
      .from('partida_jogadores')
      .insert(jogadores)
      .select();
    return { data, error };
  },

  atualizar: async (id, updates) => {
    const { data, error } = await supabase
      .from('partidas')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  }
};

export const torneiosAPI = {
  listar: async (cidade) => {
    let query = supabase.from('torneios').select('*, organizador:profiles(nome_completo)');
    if (cidade) {
      query = query.eq('cidade', cidade);
    }
    const { data, error } = await query.order('data_inicio', { ascending: false });
    return { data, error };
  },

  obterPorId: async (id) => {
    const { data, error } = await supabase
      .from('torneios')
      .select('*, organizador:profiles(nome_completo)')
      .eq('id', id)
      .single();
    return { data, error };
  },

  criar: async (torneio) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: null, error: new Error('Usuário não autenticado') };
    
    const { data, error } = await supabase
      .from('torneios')
      .insert([{ ...torneio, organizador_id: user.id }])
      .select()
      .single();
    return { data, error };
  },

  atualizarStatus: async (id, status) => {
    const { data, error } = await supabase
      .from('torneios')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  excluir: async (id) => {
    const { data, error } = await supabase
      .from('torneios')
      .delete()
      .eq('id', id);
    return { data, error };
  }
};

export const equipesAPI = {
  listarPorTorneio: async (torneioId) => {
    const { data, error } = await supabase
      .from('equipes')
      .select('*, capitao:profiles(nome_completo)')
      .eq('torneio_id', torneioId)
      .order('nome');
    return { data, error };
  },

  criar: async (equipe) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: null, error: new Error('Usuário não autenticado') };

    const { data, error } = await supabase
      .from('equipes')
      .insert([{ ...equipe, capitao_id: user.id }])
      .select()
      .single();
    return { data, error };
  },

  aprovar: async (id, aprovado) => {
    const { data, error } = await supabase
      .from('equipes')
      .update({ aprovado })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  adicionarJogador: async (equipeId, jogadorId, aprovado = false) => {
    const { data, error } = await supabase
      .from('equipe_jogadores')
      .insert([{ equipe_id: equipeId, jogador_id: jogadorId, aprovado }])
      .select();
    return { data, error };
  },

  removerJogador: async (equipeId, jogadorId) => {
    const { data, error } = await supabase
      .from('equipe_jogadores')
      .delete()
      .eq('equipe_id', equipeId)
      .eq('jogador_id', jogadorId);
    return { data, error };
  },

  obterJogadores: async (equipeId) => {
    const { data, error } = await supabase
      .from('equipe_jogadores')
      .select('*, jogador:profiles(*)')
      .eq('equipe_id', equipeId);
    return { data, error };
  },

  aprovarJogador: async (id, aprovado) => {
    const { data, error } = await supabase
      .from('equipe_jogadores')
      .update({ aprovado })
      .eq('id', id)
      .select();
    return { data, error };
  }
};

export const torneioJogosAPI = {
  listarPorTorneio: async (torneioId) => {
    const { data, error } = await supabase
      .from('torneio_jogos')
      .select('*, equipe_a:equipes!torneio_jogos_equipe_a_id_fkey(nome), equipe_b:equipes!torneio_jogos_equipe_b_id_fkey(nome)')
      .eq('torneio_id', torneioId)
      .order('created_at');
    return { data, error };
  },

  criarJogo: async (jogo) => {
    const { data, error } = await supabase
      .from('torneio_jogos')
      .insert([jogo])
      .select()
      .single();
    return { data, error };
  },

  sincronizarJogo: async (id, updates) => {
    const { data, error } = await supabase
      .from('torneio_jogos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  registrarEstatisticas: async (estatisticas) => {
    const { data, error } = await supabase
      .from('torneio_estatisticas_jogadores')
      .insert(estatisticas)
      .select();
    return { data, error };
  },

  removerEstatisticasJogo: async (jogoId) => {
    const { data, error } = await supabase
      .from('torneio_estatisticas_jogadores')
      .delete()
      .eq('jogo_id', jogoId);
    return { data, error };
  },

  obterEstatisticasJogo: async (jogoId) => {
    const { data, error } = await supabase
      .from('torneio_estatisticas_jogadores')
      .select('*, jogador:profiles(nome_completo, apelido)')
      .eq('jogo_id', jogoId);
    return { data, error };
  },

  obterEstatisticasAcumuladas: async (torneioId) => {
    const { data, error } = await supabase
      .from('torneio_estatisticas_jogadores')
      .select('*, jogador:profiles(nome_completo, apelido), jogo:torneio_jogos(torneio_id)');
    return { data, error };
  }
};

export const notificacoesAPI = {
  listar: async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: [], error: new Error('Usuário não autenticado') };
    
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  marcarComoLida: async (id) => {
    const { data, error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', id)
      .select();
    return { data, error };
  },

  marcarTodasComoLidas: async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: null, error: new Error('Usuário não autenticado') };
    
    const { data, error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('usuario_id', user.id)
      .eq('lida', false)
      .select();
    return { data, error };
  }
};

// ============================================================
// MASTER / ADMIN APIs
// ============================================================

export const masterAPI = {
  getStats: async () => {
    const { data, error } = await supabase.rpc('get_master_stats');
    return { data, error };
  },

  getCityStats: async () => {
    const { data, error } = await supabase.rpc('get_city_stats');
    return { data, error };
  },

  getUsers: async (search = '') => {
    const { data, error } = await supabase.rpc('admin_get_users', { p_search: search || null });
    return { data, error };
  },

  setRole: async (userId, role) => {
    const { data, error } = await supabase.rpc('admin_set_user_role', {
      p_user_id: userId, p_new_role: role
    });
    return { data, error };
  },

  toggleActive: async (userId, active) => {
    const { data, error } = await supabase.rpc('admin_toggle_user_active', {
      p_user_id: userId, p_active: active
    });
    return { data, error };
  },

  deleteUser: async (userId) => {
    const { data, error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
    return { data, error };
  },

  getPlayers: async () => {
    const { data, error } = await supabase.rpc('admin_get_players');
    return { data, error };
  },

  togglePlayer: async (playerId, active) => {
    const { data, error } = await supabase.rpc('admin_toggle_player', {
      p_player_id: playerId, p_active: active
    });
    return { data, error };
  },

  sendGlobalNotification: async (titulo, mensagem) => {
    const { data, error } = await supabase.rpc('admin_send_global_notification', {
      p_titulo: titulo, p_mensagem: mensagem
    });
    return { data, error };
  },

  deleteTournament: async (torneioId) => {
    const { data, error } = await supabase.rpc('admin_delete_tournament', { p_torneio_id: torneioId });
    return { data, error };
  },

  closeTournament: async (torneioId) => {
    const { data, error } = await supabase.rpc('admin_close_tournament', { p_torneio_id: torneioId });
    return { data, error };
  },

  getReports: async () => {
    const { data, error } = await supabase.rpc('get_master_reports');
    return { data, error };
  },

  getLogs: async (limit = 50) => {
    const { data, error } = await supabase.rpc('admin_get_logs', { p_limit: limit });
    return { data, error };
  },

  touchLastSeen: async () => {
    const { error } = await supabase.rpc('touch_last_seen');
    return { error };
  },
};
