import { createClient } from '@supabase/supabase-js';
import { comprimirImagem, LIMITE_FOTO_PERFIL } from './imagens';

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

/** Nomes que NÃO são município IBGE (povoado/rua/erro de GPS) */
const CIDADES_INVALIDAS = new Set([
  'leste', 'betel', 'bethel',
  'leste para', 'leste pa',
  'betel para', 'betel pa',
  'bethel para', 'bethel pa',
  'betel-pa', 'bethel-pa', 'leste-pa',
]);
function cidadeInvalida(nome) {
  const n = String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!n) return true;
  if (CIDADES_INVALIDAS.has(n)) return true;
  if (/^(leste|betel|bethel)(\s|-|$)/.test(n)) return true;
  return false;
}

// Padrão ILIKE que casa a cidade com ou sem acento e sem diferenciar maiúsculas:
// "Pacajá" -> "Pacaj_" (o "_" aceita "á" ou "a"). Caracteres de LIKE são escapados.
function padraoCidadeIlike(nome) {
  const base = String(nome || '').normalize('NFC');
  let out = '';
  for (const ch of base) {
    const decomposto = ch.normalize('NFD');
    if (decomposto.length > 1) out += '_';
    else if (ch === '%' || ch === '_' || ch === String.fromCharCode(92)) out += String.fromCharCode(92) + ch;
    else out += ch;
  }
  return out;
}

export const jogadoresAPI = {
  // Só os jogadores da cidade (no banco), e não o estado inteiro.
  listarDaCidade: async (cidade, uf, esporte = 'basquete') => {
    if (!cidade) return { data: [], error: null };
    let q = supabase
      .from('jogadores')
      .select('*')
      .eq('ativo', true)
      .eq('esporte', esporte)
      .ilike('cidade', padraoCidadeIlike(cidade))
      .order('media_estrelas', { ascending: false })
      .order('total_votos', { ascending: false });
    if (uf) q = q.eq('uf', uf);
    return q;
  },

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
    // Até 5 MB a foto vai como está. Acima disso é comprimida no aparelho
    // (ver src/lib/imagens.js) em vez de recusar o upload.
    const MAX_BYTES = LIMITE_FOTO_PERFIL;

    if (!file) {
      return { error: new Error('Escolha uma imagem para enviar.') };
    }

    const tipoOk = ALLOWED_TYPES.includes(file.type)
      || (!file.type && /\.(jpe?g|png|webp|gif)$/i.test(file.name || ''));

    if (!tipoOk) {
      return { error: new Error('Formato inválido. Envie uma imagem JPG, PNG, WEBP ou GIF.') };
    }

    let arquivo = file;
    if (file.size > MAX_BYTES) {
      try {
        arquivo = await comprimirImagem(file, { maxBytes: MAX_BYTES });
      } catch (err) {
        return {
          error: new Error(`Não foi possível reduzir essa imagem no aparelho (${err.message}). Tente outra foto.`)
        };
      }
      if (arquivo.size > MAX_BYTES) {
        return { error: new Error('Essa foto continua acima de 5 MB mesmo depois de comprimida. Tente outra foto.') };
      }
    }

    const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const filePath = `avatars/${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

    // O bucket `avatars` deve ser criado UMA vez pelo administrador no painel
    // do Supabase — nunca pelo cliente (isso era um vetor de abuso).
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, arquivo, { upsert: true });

    if (uploadError) return { error: uploadError };

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return { publicUrl: data?.publicUrl, error: null };
  }
};

export const midiaAPI = {
  MAX_FOTOS: 5,
  MAX_VIDEOS: 1,
  MAX_VIDEO_BYTES: 20 * 1024 * 1024, // 20 MB
  MAX_VIDEO_SEGUNDOS: 20,

  listarPorUsuario: async (usuarioId, tipo = 'foto') => {
    if (!usuarioId) return { data: [], error: null };
    let q = supabase
      .from('midia_jogador')
      .select('id, usuario_id, url, storage_path, tipo, ordem, created_at')
      .eq('usuario_id', usuarioId)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });
    if (tipo) q = q.eq('tipo', tipo);
    const { data, error } = await q;
    return { data: data || [], error };
  },

  /** Resolve usuario_id a partir do jogador (player_id do perfil ou criado_por). */
  listarPorJogador: async (jogador) => {
    if (!jogador) return { data: [], error: null };
    let uid = jogador.usuario_id || jogador.user_id || null;
    if (!uid && jogador.id) {
      const { data: j } = await supabase
        .from('jogadores')
        .select('criado_por, id')
        .eq('id', jogador.id)
        .maybeSingle();
      if (j?.criado_por) uid = j.criado_por;
      if (!uid) {
        const { data: pr } = await supabase
          .from('profiles')
          .select('id')
          .eq('player_id', jogador.id)
          .maybeSingle();
        if (pr?.id) uid = pr.id;
      }
    }
    if (!uid) return { data: [], error: null };
    return midiaAPI.listarPorUsuario(uid);
  },

  adicionarFoto: async (userId, file) => {
    if (!userId || !file) return { data: null, error: new Error('Dados incompletos') };

    const { data: atuais } = await midiaAPI.listarPorUsuario(userId);
    if ((atuais || []).length >= midiaAPI.MAX_FOTOS) {
      return { data: null, error: new Error(`Máximo de ${midiaAPI.MAX_FOTOS} fotos na galeria.`) };
    }

    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_BYTES = LIMITE_FOTO_PERFIL;
    const tipoOk = ALLOWED.includes(file.type)
      || (!file.type && /\.(jpe?g|png|webp|gif)$/i.test(file.name || ''));
    if (!tipoOk) {
      return { data: null, error: new Error('Envie JPG, PNG, WEBP ou GIF.') };
    }

    let arquivo = file;
    if (file.size > MAX_BYTES) {
      try {
        arquivo = await comprimirImagem(file, { maxBytes: MAX_BYTES });
      } catch (err) {
        return { data: null, error: new Error(`Não foi possível comprimir: ${err.message}`) };
      }
    }

    const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const filePath = `galeria/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(filePath, arquivo, { upsert: false });
    if (upErr) return { data: null, error: upErr };

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const ordem = (atuais || []).length;

    const { data, error } = await supabase
      .from('midia_jogador')
      .insert([{
        usuario_id: userId,
        url: pub?.publicUrl,
        storage_path: filePath,
        tipo: 'foto',
        ordem,
      }])
      .select()
      .single();

    if (error) {
      try { await supabase.storage.from('avatars').remove([filePath]); } catch (_) {}
      return { data: null, error };
    }
    return { data, error: null };
  },

  obterVideo: async (usuarioId) => {
    const { data, error } = await midiaAPI.listarPorUsuario(usuarioId, 'video');
    return { data: (data && data[0]) || null, error };
  },

  adicionarVideo: async (userId, file) => {
    if (!userId || !file) return { data: null, error: new Error('Dados incompletos') };

    const { data: atuais } = await midiaAPI.listarPorUsuario(userId, 'video');
    if ((atuais || []).length >= midiaAPI.MAX_VIDEOS) {
      return { data: null, error: new Error('Já existe um vídeo no perfil. Remova o atual para enviar outro.') };
    }

    const ALLOWED = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
    const tipoOk = ALLOWED.includes(file.type)
      || (!file.type && /\.(mp4|webm|mov|m4v)$/i.test(file.name || ''));
    if (!tipoOk) {
      return { data: null, error: new Error('Envie MP4, WEBM ou MOV.') };
    }
    if (file.size > midiaAPI.MAX_VIDEO_BYTES) {
      return { data: null, error: new Error('Vídeo acima de 20 MB. Grave mais curto ou em qualidade menor.') };
    }

    // Duração no aparelho (se o navegador permitir)
    try {
      const dur = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => {
          const d = v.duration;
          URL.revokeObjectURL(url);
          resolve(d);
        };
        v.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        v.src = url;
      });
      if (dur != null && Number.isFinite(dur) && dur > midiaAPI.MAX_VIDEO_SEGUNDOS + 0.5) {
        return {
          data: null,
          error: new Error(`Vídeo com ${Math.round(dur)}s. Máximo ${midiaAPI.MAX_VIDEO_SEGUNDOS} segundos.`),
        };
      }
    } catch (_) {
      /* segue sem checagem de duração */
    }

    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const filePath = `galeria/${userId}/video-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: false, contentType: file.type || 'video/mp4' });
    if (upErr) return { data: null, error: upErr };

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);

    const { data, error } = await supabase
      .from('midia_jogador')
      .insert([{
        usuario_id: userId,
        url: pub?.publicUrl,
        storage_path: filePath,
        tipo: 'video',
        ordem: 0,
      }])
      .select()
      .single();

    if (error) {
      try { await supabase.storage.from('avatars').remove([filePath]); } catch (_) {}
      return { data: null, error };
    }
    return { data, error: null };
  },

  remover: async (id, storagePath) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { error: new Error('Não autenticado') };

    const { error } = await supabase
      .from('midia_jogador')
      .delete()
      .eq('id', id)
      .eq('usuario_id', user.id);
    if (error) return { error };

    if (storagePath) {
      try { await supabase.storage.from('avatars').remove([storagePath]); } catch (_) {}
    }
    return { error: null };
  },
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

  /** Box score / modo mesa: grava direto em partida_jogadores (sem depender de RPC). */
  ajustarStat: async (partidaId, jogadorId, campo, delta) => {
    const allowed = ['pontos', 'assistencias', 'rebotes', 'turnovers', 'faltas'];
    if (!allowed.includes(campo)) {
      return { data: null, error: { message: 'Campo invalido: ' + campo } };
    }

    // 1) Leitura atual
    const { data: cur, error: errRead } = await supabase
      .from('partida_jogadores')
      .select('jogador_id, time, pontos, assistencias, rebotes, turnovers, faltas')
      .eq('partida_id', partidaId)
      .eq('jogador_id', jogadorId)
      .maybeSingle();

    if (errRead) return { data: null, error: errRead };
    if (!cur) return { data: null, error: { message: 'Jogador nao esta na partida' } };

    const next = {
      pontos: Math.max(0, (Number(cur.pontos) || 0) + (campo === 'pontos' ? delta : 0)),
      assistencias: Math.max(0, (Number(cur.assistencias) || 0) + (campo === 'assistencias' ? delta : 0)),
      rebotes: Math.max(0, (Number(cur.rebotes) || 0) + (campo === 'rebotes' ? delta : 0)),
      turnovers: Math.max(0, (Number(cur.turnovers) || 0) + (campo === 'turnovers' ? delta : 0)),
      faltas: Math.max(0, (Number(cur.faltas) || 0) + (campo === 'faltas' ? delta : 0)),
    };

    // 2) Update stats
    const { data: updated, error: errUp } = await supabase
      .from('partida_jogadores')
      .update(next)
      .eq('partida_id', partidaId)
      .eq('jogador_id', jogadorId)
      .select('jogador_id, time, pontos, assistencias, rebotes, turnovers, faltas')
      .maybeSingle();

    if (errUp) return { data: null, error: errUp };

    // 3) Se mudou pontos, ajusta placar do time
    if (campo === 'pontos' && delta !== 0 && cur.time) {
      const { data: part } = await supabase
        .from('partidas')
        .select('placar_time_a, placar_time_b')
        .eq('id', partidaId)
        .maybeSingle();
      if (part) {
        const patch = cur.time === 'A'
          ? { placar_time_a: Math.max(0, (Number(part.placar_time_a) || 0) + delta) }
          : { placar_time_b: Math.max(0, (Number(part.placar_time_b) || 0) + delta) };
        await supabase
          .from('partidas')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', partidaId);
      }
    }

    const row = updated || { ...cur, ...next };
    return {
      data: {
        ...row,
        lado_time: row.time,
        out_jogador_id: row.jogador_id,
      },
      error: null,
    };
  },

  listarStats: async (partidaId) => {
    const { data, error } = await supabase
      .from('partida_jogadores')
      .select('jogador_id, time, pontos, assistencias, rebotes, turnovers, faltas, jogador:jogadores(nome, apelido)')
      .eq('partida_id', partidaId);
    return { data: data || [], error };
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

export const timesAPI = {
  cidadeDoProfile(profile) {
    return (profile?.cidade_atual || profile?.cidade || '').trim();
  },

  listarPorCidade: async (cidade, esporte = 'basquete') => {
    const c = (cidade || '').trim();
    if (!c) return { data: [], error: null };
    const { data, error } = await supabase
      .from('times')
      .select('*')
      .eq('ativo', true)
      .eq('esporte', esporte)
      .ilike('cidade', c)
      .order('nome');
    if (error || !data?.length) return { data: data || [], error };

    // Busca capitão separado para não depender do schema cache do PostgREST
    const ids = [...new Set(data.map((t) => t.capitao_id).filter(Boolean))];
    let map = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, nome_completo, apelido, foto_perfil')
        .in('id', ids);
      map = Object.fromEntries((profs || []).map((p) => [p.id, p]));
    }
    const withCap = data.map((t) => ({ ...t, capitao: map[t.capitao_id] || null }));
    return { data: withCap, error: null };
  },

  buscar: async (id) => {
    const { data, error } = await supabase
      .from('times')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return { data, error };
    if (data.capitao_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, nome_completo, apelido, foto_perfil')
        .eq('id', data.capitao_id)
        .maybeSingle();
      data.capitao = prof || null;
    }
    return { data, error: null };
  },

  criar: async ({ nome, cidade, uf, descricao, esporte = 'basquete' }) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: null, error: new Error('Não autenticado') };
    if (!nome?.trim()) return { data: null, error: new Error('Informe o nome do time') };
    if (!cidade?.trim()) return { data: null, error: new Error('Cidade obrigatória') };

    const { data: ja } = await timesAPI.meuTimeNaCidade(cidade);
    if (ja) {
      return { data: null, error: new Error('Você já está em um time nesta cidade.') };
    }

    const { data, error } = await supabase
      .from('times')
      .insert([{
        nome: nome.trim(),
        cidade: cidade.trim(),
        uf: (uf || 'PA').trim(),
        descricao: descricao?.trim() || null,
        capitao_id: user.id,
        esporte: esporte || 'basquete',
      }])
      .select()
      .single();
    if (error) return { data: null, error };

    const { error: memErr } = await supabase
      .from('time_membros')
      .insert([{ time_id: data.id, usuario_id: user.id, status: 'ativo' }]);
    if (memErr) {
      try { await supabase.from('times').delete().eq('id', data.id); } catch (_) {}
      return { data: null, error: memErr };
    }
    return { data, error: null };
  },

  listarMembros: async (timeId) => {
    const { data, error } = await supabase
      .from('time_membros')
      .select('*')
      .eq('time_id', timeId)
      .eq('status', 'ativo')
      .order('entrou_em');
    if (error || !data?.length) return { data: data || [], error };

    const ids = [...new Set(data.map((m) => m.usuario_id).filter(Boolean))];
    let map = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, nome_completo, apelido, foto_perfil, cidade_atual, cidade')
        .in('id', ids);
      map = Object.fromEntries((profs || []).map((p) => [p.id, p]));
    }
    const withP = data.map((m) => ({ ...m, perfil: map[m.usuario_id] || null }));
    return { data: withP, error: null };
  },

  meuTimeNaCidade: async (cidade) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: null, error: null };
    const { data: mem } = await supabase
      .from('time_membros')
      .select('time_id, times!inner(id, nome, cidade, ativo, capitao_id)')
      .eq('usuario_id', user.id)
      .eq('status', 'ativo')
      .eq('times.ativo', true);
    const c = (cidade || '').toLowerCase().trim();
    const row = (mem || []).find((m) => (m.times?.cidade || '').toLowerCase().trim() === c);
    return { data: row?.times || null, error: null };
  },

  convidar: async (timeId, convidadoId) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: null, error: new Error('Não autenticado') };

    const { data: time } = await supabase.from('times').select('id, nome, capitao_id, cidade').eq('id', timeId).maybeSingle();
    if (!time || time.capitao_id !== user.id) {
      return { data: null, error: new Error('Só o capitão pode convidar') };
    }

    const { data: ja } = await supabase
      .from('time_membros')
      .select('id')
      .eq('time_id', timeId)
      .eq('usuario_id', convidadoId)
      .eq('status', 'ativo')
      .maybeSingle();
    if (ja) return { data: null, error: new Error('Já é membro deste time') };

    const { data, error } = await supabase
      .from('time_convites')
      .insert([{
        time_id: timeId,
        convidado_id: convidadoId,
        convidado_por: user.id,
        status: 'pendente',
      }])
      .select()
      .single();
    if (error) {
      // Tabela ou RLS pode não existir ainda
      return { data: null, error: new Error(error.message || 'Não foi possível enviar o convite') };
    }

    // Notificação (não bloqueia se falhar)
    try {
      await supabase.from('notificacoes').insert([{
        usuario_id: convidadoId,
        titulo: 'Convite para time',
        mensagem: `Você foi convidado para o time "${time.nome}". Abra Times para aceitar ou recusar.`,
        lida: false,
        tipo: 'time_convite',
        referencia_id: data.id,
      }]);
    } catch (_) {}

    return { data, error: null };
  },

  meusConvitesPendentes: async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase
      .from('time_convites')
      .select('*, time:times(id, nome, cidade, capitao_id)')
      .eq('convidado_id', user.id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  responderConvite: async (conviteId, aceitar) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { error: new Error('Não autenticado') };

    const { data: conv } = await supabase
      .from('time_convites')
      .select('*')
      .eq('id', conviteId)
      .eq('convidado_id', user.id)
      .eq('status', 'pendente')
      .maybeSingle();
    if (!conv) return { error: new Error('Convite não encontrado') };

    const { error: upErr } = await supabase
      .from('time_convites')
      .update({ status: aceitar ? 'aceito' : 'recusado' })
      .eq('id', conviteId);
    if (upErr) return { error: upErr };

    if (aceitar) {
      const { error: mErr } = await supabase
        .from('time_membros')
        .upsert({
          time_id: conv.time_id,
          usuario_id: user.id,
          status: 'ativo',
          entrou_em: new Date().toISOString(),
        }, { onConflict: 'time_id,usuario_id' });
      if (mErr) return { error: mErr };
    }
    return { error: null };
  },

  desafiar: async ({ timeAId, timeBId, cidade, local, dataHora, mensagem }) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { data: null, error: new Error('Não autenticado') };

    const { data: ta } = await supabase.from('times').select('id, nome, capitao_id').eq('id', timeAId).maybeSingle();
    if (!ta || ta.capitao_id !== user.id) {
      return { data: null, error: new Error('Só o capitão do seu time pode desafiar') };
    }

    const { data, error } = await supabase
      .from('amistosos')
      .insert([{
        time_a_id: timeAId,
        time_b_id: timeBId,
        cidade: (cidade || '').trim(),
        local_quadra: local?.trim() || null,
        data_hora: dataHora || null,
        status: 'pendente',
        desafiado_por: user.id,
        mensagem: mensagem?.trim() || null,
      }])
      .select()
      .single();
    if (error) return { data: null, error };

    const { data: tb } = await supabase.from('times').select('capitao_id, nome').eq('id', timeBId).maybeSingle();
    if (tb?.capitao_id) {
      try {
        await supabase.from('notificacoes').insert([{
          usuario_id: tb.capitao_id,
          titulo: 'Desafio de amistoso',
          mensagem: `O time "${ta.nome}" desafiou "${tb.nome}". Abra Times para responder.`,
          lida: false,
          tipo: 'amistoso',
          referencia_id: data.id,
        }]);
      } catch (_) {}
    }
    return { data, error: null };
  },

  listarAmistososCidade: async (cidade) => {
    const c = (cidade || '').trim();
    if (!c) return { data: [], error: null };
    const { data, error } = await supabase
      .from('amistosos')
      .select('*, time_a:times!time_a_id(id, nome), time_b:times!time_b_id(id, nome)')
      .ilike('cidade', c)
      .order('created_at', { ascending: false })
      .limit(40);
    return { data: data || [], error };
  },

  responderAmistoso: async (amistosoId, aceitar) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return { error: new Error('Não autenticado') };

    const { data: am } = await supabase.from('amistosos').select('*').eq('id', amistosoId).maybeSingle();
    if (!am || am.status !== 'pendente') return { error: new Error('Amistoso inválido') };

    const { data: tb } = await supabase.from('times').select('capitao_id').eq('id', am.time_b_id).maybeSingle();
    if (!tb || tb.capitao_id !== user.id) {
      return { error: new Error('Só o capitão do time desafiado pode responder') };
    }

    const { error } = await supabase
      .from('amistosos')
      .update({ status: aceitar ? 'aceito' : 'recusado' })
      .eq('id', amistosoId);
    return { error };
  },
};
