import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Variáveis de ambiente do Supabase ausentes. ' +
    'Copie .env.example para .env.local e defina ' +
    'REACT_APP_SUPABASE_URL e REACT_APP_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Colunas de `profiles` seguras para expor no cliente.
// `email` e as colunas de GPS NÃO estão aqui de propósito: o banco
// revoga o SELECT dessas colunas de `authenticated` (ver
// supabase/migration_rls_hardening.sql). Sempre que consultar `profiles`,
// use esta lista — nunca `'*'` — ou a requisição falha por permissão.
export const PROFILE_SAFE_COLUMNS = [
  'id',
  'nome_completo',
  'apelido',
  'foto_perfil',
  'altura',
  'idade',
  'cadastro_completo',
  'is_player',
  'player_id',
  'posicao',
  'cidade',
  'uf',
  'pais',
  'reputacao',
  'cidade_atual',
  'tema_preferido',
  'role',
  'is_active',
  'created_at',
  'updated_at',
].join(', ');

// ============================================================
// API helpers
// ============================================================

export const jogadoresAPI = {
  listar: async (esporte = 'basquete') => {
    const { data, error } = await supabase
      .from('jogadores')
      .select('*')
      .eq('ativo', true)
      .eq('esporte', esporte)
      .order('media_estrelas', { ascending: false })
      .order('total_votos', { ascending: false });
    return { data, error };
  },

  listarPorEstado: async (uf, esporte = 'basquete') => {
    const { data, error } = await supabase
      .from('jogadores')
      .select('*')
      .eq('ativo', true)
      .eq('uf', uf)
      .eq('esporte', esporte)
      .order('media_estrelas', { ascending: false })
      .order('total_votos', { ascending: false });
    return { data, error };
  },

  /** Atletas ativos de uma cidade (modo Explorar — consulta). */
  listarPorCidade: async (cidade, uf = null, esporte = 'basquete') => {
    let q = supabase
      .from('jogadores')
      .select('*')
      .eq('ativo', true)
      .eq('esporte', esporte)
      .eq('cidade', cidade);
    if (uf) q = q.eq('uf', uf);
    const { data, error } = await q
      .order('media_estrelas', { ascending: false })
      .order('total_votos', { ascending: false })
      .limit(80);
    return { data: data || [], error };
  },

  /**
   * Cidades com atletas ativos (para busca do Explorar).
   * Agrega no cliente: evita RPC nova e funciona com RLS atual.
   */

  /** Nomes que NÃO são município IBGE (povoado/rua/erro de GPS) */
  const CIDADES_INVALIDAS = new Set([
    'leste', 'betel', 'leste para', 'leste pará', 'betel para', 'betel pará',
  ]);
  function cidadeInvalida(nome) {
    const n = String(nome || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!n) return true;
    if (CIDADES_INVALIDAS.has(n)) return true;
    // só "leste" ou "betel" como palavra única
    if (/^(leste|betel)$/.test(n)) return true;
    return false;
  }

  listarCidades: async (esporte = 'basquete') => {
    const { data, error } = await supabase
      .from('jogadores')
      .select('cidade, uf, total_votos, media_estrelas, updated_at, created_at')
      .eq('ativo', true)
      .eq('esporte', esporte)
      .not('cidade', 'is', null)
      .neq('cidade', '')
      .limit(2000);
    if (error) return { data: [], error };
    const map = new Map();
    for (const j of data || []) {
      const cidade = String(j.cidade || '').trim();
      if (!cidade || cidadeInvalida(cidade)) continue;
      const uf = String(j.uf || '').trim().toUpperCase();
      const key = `${cidade.toLowerCase()}|${uf}`;
      let row = map.get(key);
      if (!row) {
        row = {
          cidade,
          uf,
          player_count: 0,
          total_votos: 0,
          with_votes: 0,
          last_activity: null,
        };
        map.set(key, row);
      }
      row.player_count += 1;
      row.total_votos += Number(j.total_votos) || 0;
      if ((Number(j.total_votos) || 0) >= 1) row.with_votes += 1;
      const ts = j.updated_at || j.created_at;
      if (ts && (!row.last_activity || ts > row.last_activity)) row.last_activity = ts;
    }
    const list = [...map.values()]
      .filter((c) => c.player_count >= 1)
      .sort((a, b) => b.player_count - a.player_count || a.cidade.localeCompare(b.cidade));
    return { data: list, error: null };
  },

};

export const rankingAPI = {
  get: async (cidade, uf, limit = 50, esporte = 'basquete') => {
    const { data, error } = await supabase.rpc('get_ranking', {
      p_cidade: cidade || null,
      p_uf: uf || null,
      p_limit: limit,
      p_esporte: esporte
    });
    return { data, error };
  },

  getTop5: async (cidade, uf, esporte = 'basquete') => {
    const { data, error } = await supabase.rpc('get_ranking', {
      p_cidade: cidade || null,
      p_uf: uf || null,
      p_limit: 5,
      p_esporte: esporte
    });
    return { data, error };
  },
};

export const votacaoAPI = {
  votar: async (jogadorId, avaliacao, metadata = {}) => {
    const { data, error } = await supabase.rpc('registrar_avaliacao', {
      p_jogador_id: jogadorId,
      p_arremesso: avaliacao.arremesso,
      p_finalizacao: avaliacao.finalizacao,
      p_controle_de_bola: avaliacao.controle_de_bola,
      p_passe_visao: avaliacao.passe_visao,
      p_defesa_perimetral: avaliacao.defesa_perimetral,
      p_defesa_garrafao: avaliacao.defesa_garrafao,
      p_rebote: avaliacao.rebote,
      p_velocidade_agilidade: avaliacao.velocidade_agilidade,
      p_explosao_forca: avaliacao.explosao_forca,
      p_hustle_equipe: avaliacao.hustle_equipe,
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

// ============================================================
// NOTAS DE JOGO (rachão / competição) — avaliação anônima da partida
// Tudo passa por RPC: a tabela é fechada e ninguém vê quem avaliou.
// ============================================================
export const notasJogoAPI = {
  salvar: async ({ jogadorId, nota, partidaId = null, racaoId = null, torneioJogoId = null, comentario = null }) => {
    const { data, error } = await supabase.rpc('salvar_nota_jogo', {
      p_jogador_id: jogadorId,
      p_nota: nota,
      p_partida_id: partidaId,
      p_racao_id: racaoId,
      p_torneio_jogo_id: torneioJogoId,
      p_comentario: comentario,
    });
    return { data, error };
  },

  minhas: async ({ partidaId = null, racaoId = null, torneioJogoId = null } = {}) => {
    const { data, error } = await supabase.rpc('minhas_notas_jogo', {
      p_partida_id: partidaId,
      p_racao_id: racaoId,
      p_torneio_jogo_id: torneioJogoId,
    });
    return { data: data || [], error };
  },

  resumo: async ({ partidaId = null, racaoId = null, torneioJogoId = null } = {}) => {
    const { data, error } = await supabase.rpc('resumo_notas_jogo', {
      p_partida_id: partidaId,
      p_racao_id: racaoId,
      p_torneio_jogo_id: torneioJogoId,
    });
    return { data: data || [], error };
  },
};

export const jogosAPI = {
  listar: async (esporte = 'basquete') => {
    const { data, error } = await supabase
      .from('jogos')
      .select('*')
      .eq('esporte', esporte)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  criar: async (jogo) => {
    const user = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase
      .from('jogos')
      .insert([{ ...jogo, esporte: jogo.esporte || 'basquete', criado_por: user?.id }])
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
  obterMinhas: async (esporte = 'basquete') => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: [], error: new Error("Usuário não autenticado") };
    
    const { data, error } = await supabase
      .from('estatisticas_pessoais')
      .select('*')
      .eq('usuario_id', user.id)
      .eq('esporte', esporte)
      .order('data_partida', { ascending: false })
      .order('created_at', { ascending: false });
    return { data, error };
  },

  registrar: async (stats) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: null, error: new Error("Usuário não autenticado") };

    const { data, error } = await supabase
      .from('estatisticas_pessoais')
      .insert([{ ...stats, esporte: stats.esporte || 'basquete', usuario_id: user.id }])
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

function authRedirectUrl() {
  // Sempre a origem atual do app (Vercel / domínio real).
  // Evita link de confirmação apontando para localhost ou URL errada.
  if (typeof window === 'undefined') return undefined;
  const origin = window.location.origin;
  return origin.endsWith('/') ? origin : `${origin}/`;
}

export const authAPI = {
  login: async (email, senha) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(),
      password: senha,
    });
    return { data, error };
  },

  registrar: async (email, senha, nome) => {
    const redirectTo = authRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email: String(email || '').trim().toLowerCase(),
      password: senha,
      options: {
        data: { nome: String(nome || '').trim() },
        emailRedirectTo: redirectTo,
      },
    });
    return { data, error };
  },

  /** Reenvia o e-mail de confirmação de cadastro. */
  reenviarConfirmacao: async (email) => {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: String(email || '').trim().toLowerCase(),
      options: { emailRedirectTo: authRedirectUrl() },
    });
    return { data, error };
  },

  loginGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectUrl() },
    });
    return { data, error };
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  recuperarSenha: async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      String(email || '').trim().toLowerCase(),
      { redirectTo: authRedirectUrl() }
    );
    return { data, error };
  },

  // Exclusao de conta pelo proprio usuario (exigencia da Play Store).
  // 1) tenta apagar os arquivos do usuario no Storage (melhor esforco)
  // 2) chama a RPC que remove o profile + o login (auth.users) no servidor
  excluirConta: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userId) {
      try {
        const { data: arquivos } = await supabase.storage
          .from('avatars')
          .list('', { limit: 1000 });
        const meus = (arquivos || [])
          .filter((f) => (f.name || '').startsWith(`${userId}-`))
          .map((f) => f.name);
        if (meus.length) await supabase.storage.from('avatars').remove(meus);
      } catch {
        // sem permissao de listagem: segue (o SQL ainda remove o resto)
      }
    }

    const { data, error } = await supabase.rpc('excluir_minha_conta');
    if (error) return { error };
    if (data && data.sucesso === false) {
      return { error: new Error(data.erro || 'Nao foi possivel excluir a conta.') };
    }
    return { data };
  },
};

export const profilesAPI = {
  obterPerfil: async (id) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SAFE_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  },

  atualizar: async (id, updates) => {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    let { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select(PROFILE_SAFE_COLUMNS)
      .maybeSingle();

    // Se update não retornou linha (RLS/sessão), tenta upsert
    if (!error && !data) {
      const retry = await supabase
        .from('profiles')
        .upsert({ id, ...payload }, { onConflict: 'id' })
        .select(PROFILE_SAFE_COLUMNS)
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }
    return { data, error };
  },

  listarPorEstado: async (uf) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SAFE_COLUMNS)
      .eq('uf', uf)
      .eq('cadastro_completo', true)
      .order('nome_completo');
    return { data, error };
  },

  uploadAvatar: async (userId, file) => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

    const tipoOk = ALLOWED_TYPES.includes(file.type)
      || (!file.type && /\.(jpe?g|png|webp|gif)$/i.test(file.name || ''));

    if (!file || !tipoOk) {
      return { error: new Error('Formato inválido. Envie uma imagem JPG, PNG, WEBP ou GIF.') };
    }
    if (file.size > MAX_BYTES) {
      return { error: new Error('A imagem deve ter no máximo 5 MB.') };
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const filePath = `avatars/${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

    // O bucket `avatars` deve ser criado UMA vez pelo administrador no painel
    // do Supabase — nunca pelo cliente (isso era um vetor de abuso).
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
  listar: async (esporte = 'basquete') => {
    const { data, error } = await supabase
      .from('partidas')
      .select('*')
      .eq('esporte', esporte)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  buscar: async (id) => {
    const { data, error } = await supabase
      .from('partidas')
      .select('*')
      .eq('id', id)
      .single();
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
      .insert([{ ...partida, esporte: partida.esporte || 'basquete' }])
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
  },

  // ---- Placar compartilhado (pedido + aceite do criador) ----
  // A tabela `partida_operadores` é fechada: só se lê, e só as RPCs escrevem.
  // Ver supabase/migration_placar_compartilhado.sql.
  listarOperadores: async (partidaId) => {
    const { data, error } = await supabase
      .from('partida_operadores')
      .select('usuario_id, nome, aprovado, pedido_em')
      .eq('partida_id', partidaId)
      .order('pedido_em', { ascending: true });
    return { data, error };
  },

  pedirOperar: async (partidaId) => {
    const { data, error } = await supabase.rpc('pedir_operar_partida', { p_partida_id: partidaId });
    return { data, error };
  },

  // Pedidos que EU preciso responder: a RLS devolve só os das partidas que eu
  // criei (mais os meus próprios, que o app filtra fora).
  listarPedidosPendentes: async () => {
    const { data, error } = await supabase
      .from('partida_operadores')
      .select('partida_id, usuario_id, nome, pedido_em')
      .eq('aprovado', false)
      .order('pedido_em', { ascending: true });
    return { data, error };
  },

  responderPedidoOperador: async (partidaId, usuarioId, aceitar) => {
    const { data, error } = await supabase.rpc('responder_pedido_operador', {
      p_partida_id: partidaId,
      p_usuario_id: usuarioId,
      p_aceitar: aceitar
    });
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
      .select('*, jogador:profiles(id, nome_completo, apelido, foto_perfil)')
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

async function resolveAuthUserId() {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch (_) {}
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) return data.session.user.id;
  } catch (_) {}
  return null;
}

export const notificacoesAPI = {
  listar: async () => {
    const userId = await resolveAuthUserId();
    if (!userId) return { data: [], error: new Error('Usuário não autenticado') };

    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return { data: data || [], error };
  },

  marcarComoLida: async (id) => {
    const { data, error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', id)
      .select()
      .maybeSingle();
    return { data, error };
  },

  marcarTodasComoLidas: async () => {
    const userId = await resolveAuthUserId();
    if (!userId) return { data: null, error: new Error('Usuário não autenticado') };

    const { data, error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('usuario_id', userId)
      .eq('lida', false)
      .select();
    return { data, error };
  },

  excluir: async (id) => {
    const { error } = await supabase
      .from('notificacoes')
      .delete()
      .eq('id', id);
    return { error };
  },
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
    const { data, error } = await supabase
      .from('jogadores')
      .select('*, match_count:partida_jogadores(count)');
    if (data) {
      const mapped = data.map(p => ({
        ...p,
        match_count: p.match_count?.[0]?.count || 0,
        total_partidas: p.match_count?.[0]?.count || 0
      }));
      return { data: mapped, error: null };
    }
    return { data: null, error };
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

// ============================================================
// RACHÕES (pickup games)
// ============================================================

export const racoesAPI = {
  listar: async ({ cidade, uf, status } = {}) => {
    let q = supabase
      .from('racoes')
      .select('*, racao_participantes(id, usuario_id, jogador_id, status, perfil:profiles(nome_completo, apelido, foto_perfil, player_id), jogador:jogadores(nome, apelido, foto_url))')
      .order('data_hora', { ascending: true });
    if (cidade) q = q.eq('cidade', cidade);
    if (uf) q = q.eq('uf', uf);
    if (status) q = q.eq('status', status);
    else q = q.in('status', ['aberto', 'lotado', 'em_andamento', 'finalizado']);
    const { data, error } = await q.limit(40);
    return { data: data || [], error };
  },

  obter: async (id) => {
    const { data, error } = await supabase
      .from('racoes')
      .select('*, racao_participantes(id, usuario_id, jogador_id, status, perfil:profiles(nome_completo, apelido, foto_perfil, player_id), jogador:jogadores(nome, apelido, foto_url))')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  },

  criar: async (payload) => {
    const { data, error } = await supabase
      .from('racoes')
      .insert([payload])
      .select()
      .maybeSingle();
    if (error) return { data: null, error };
    // auto-join creator
    if (data?.id && payload.criado_por) {
      await supabase.from('racao_participantes').insert([{
        racao_id: data.id,
        usuario_id: payload.criado_por,
        jogador_id: payload.jogador_id || null,
        status: 'confirmado',
      }]);
    }
    return { data, error: null };
  },

  entrar: async ({ racaoId, usuarioId, jogadorId }) => {
    const { data, error } = await supabase
      .from('racao_participantes')
      .upsert({
        racao_id: racaoId,
        usuario_id: usuarioId,
        jogador_id: jogadorId || null,
        status: 'confirmado',
      }, { onConflict: 'racao_id,usuario_id' })
      .select()
      .maybeSingle();
    return { data, error };
  },

  sair: async ({ racaoId, usuarioId }) => {
    const { error } = await supabase
      .from('racao_participantes')
      .delete()
      .eq('racao_id', racaoId)
      .eq('usuario_id', usuarioId);
    return { error };
  },

  finalizar: async (racaoId) => {
    const { data, error } = await supabase
      .from('racoes')
      .update({ status: 'finalizado', updated_at: new Date().toISOString() })
      .eq('id', racaoId)
      .select()
      .maybeSingle();
    return { data, error };
  },

  participantesConfirmados: async (racaoId) => {
    const { data, error } = await supabase
      .from('racao_participantes')
      .select('*, profiles:usuario_id(id, nome_completo, apelido, foto_perfil, player_id)')
      .eq('racao_id', racaoId)
      .eq('status', 'confirmado');
    return { data: data || [], error };
  },
};
