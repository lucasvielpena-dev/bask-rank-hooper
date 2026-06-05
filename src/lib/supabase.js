import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Variáveis de ambiente do Supabase não configuradas. Verifique .env.local');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// ============================================================
// API helpers
// ============================================================

export const jogadoresAPI = {
  listar: async () => {
    const { data, error } = await supabase
      .from('jogadores')
      .select('*')
      .eq('ativo', true)
      .order('nome');
    return { data, error };
  },

  buscar: async (termo) => {
    const { data, error } = await supabase
      .from('jogadores')
      .select('*')
      .eq('ativo', true)
      .ilike('nome', `%${termo}%`)
      .order('nome');
    return { data, error };
  },

  adicionar: async (jogador) => {
    const { data, error } = await supabase
      .from('jogadores')
      .insert([{ ...jogador, criado_por: (await supabase.auth.getUser()).data.user?.id }])
      .select()
      .single();
    return { data, error };
  },
};

export const rankingAPI = {
  get: async (limit = 20) => {
    const { data, error } = await supabase.rpc('get_ranking', { p_limit: limit });
    return { data, error };
  },

  // Buscar todos para o pódio (top 3)
  getPodio: async () => {
    const { data, error } = await supabase.rpc('get_ranking', { p_limit: 3 });
    return { data, error };
  },

  // Buscar top 5 para home
  getTop5: async () => {
    const { data, error } = await supabase.rpc('get_ranking', { p_limit: 5 });
    return { data, error };
  },
};

export const votacaoAPI = {
  sortearJogadores: async () => {
    const { data, error } = await supabase.rpc('sortear_jogadores_para_voto');
    return { data, error };
  },

  votar: async (jogadorId, estrelas) => {
    const { data, error } = await supabase.rpc('registrar_voto', {
      p_jogador_id: jogadorId,
      p_estrelas: estrelas,
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

export const statsAPI = {
  getMinhas: async (jogadorId) => {
    const { data, error } = await supabase
      .from('estatisticas_partida')
      .select('*, jogos(data, titulo)')
      .eq('jogador_id', jogadorId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  registrar: async (stats) => {
    const { data, error } = await supabase
      .from('estatisticas_partida')
      .insert([stats])
      .select()
      .single();
    return { data, error };
  },
};

export const campoesAPI = {
  historico: async () => {
    const { data, error } = await supabase
      .from('campeoes_semana')
      .select('*')
      .order('semana_fim', { ascending: false })
      .limit(10);
    return { data, error };
  },
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

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },
};
