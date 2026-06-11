import { useState, useEffect } from 'react';
import { supabase, profilesAPI } from '../lib/supabase';

const ESTADO_TO_UF = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amazonas': 'AM', 'bahia': 'BA',
  'ceará': 'CE', 'distrito federal': 'DF', 'espírito santo': 'ES', 'goiás': 'GO',
  'maranhão': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  'pará': 'PA', 'paraíba': 'PB', 'paraná': 'PR', 'pernambuco': 'PE', 'piauí': 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  'rondônia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC', 'são paulo': 'SP',
  'sergipe': 'SE', 'tocantins': 'TO'
};

export default function CompleteProfileScreen({ profile, onComplete }) {
  const [apelido, setApelido] = useState(profile?.apelido || '');
  const [posicao, setPosicao] = useState(profile?.posicao || 'Ala');
  const [altura, setAltura] = useState(profile?.altura ? profile.altura.toString().replace('.', ',') : '');
  const [idade, setIdade] = useState(profile?.idade || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.foto_perfil || '');
  const [uploading, setUploading] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  // Estados de Localização Automática
  const [locationStatus, setLocationStatus] = useState('prompt'); // 'prompt', 'requesting', 'success', 'denied', 'error'
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [pais, setPais] = useState('');
  const [coords, setCoords] = useState(null); // { latitude, longitude }

  useEffect(() => {
    obterLocalizacao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function obterLocalizacao() {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }

    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });
        
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

          setCidade(detectedCity);
          setUf(detectedUf);
          setPais(detectedCountry);
          setLocationStatus('success');
        } catch (err) {
          console.error(err);
          setLocationStatus('error');
        }
      },
      (err) => {
        console.warn(err);
        setLocationStatus('denied');
      }
    );
  }

  const handleAlturaChange = (e) => {
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
    setAltura(formatted);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setErro('Por favor, selecione uma imagem válida.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErro('A imagem de perfil deve ter no máximo 2MB.');
      return;
    }
    
    setUploading(true);
    setErro(null);
    try {
      const { publicUrl, error } = await profilesAPI.uploadAvatar(profile.id, file);
      if (error) throw error;
      setAvatarUrl(publicUrl);
    } catch (err) {
      setErro('Erro ao carregar imagem: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const parsedAltura = parseFloat(altura.toString().replace(',', '.'));
    const parsedIdade = parseInt(idade);

    try {
      if (!apelido.trim()) {
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
        .eq('apelido', apelido.trim())
        .maybeSingle();
      
      if (dupApelido && dupApelido.id !== profile.id) {
        throw new Error('Este apelido já está em uso por outro jogador.');
      }

      let player_id = null;
      let is_player = false;

      // Se a localização foi obtida com sucesso, criamos o jogador
      if (locationStatus === 'success' && cidade && uf) {
        // Verificar se já existe jogador para este usuário (busca preventiva)
        const { data: existingJogador } = await supabase
          .from('jogadores')
          .select('id')
          .eq('criado_por', profile.id)
          .maybeSingle();

        if (existingJogador) {
          player_id = existingJogador.id;
          is_player = true;
          // Atualizar jogador existente
          await supabase
            .from('jogadores')
            .update({
              nome: profile.nome_completo || 'Jogador',
              apelido: apelido.trim(),
              foto_url: avatarUrl || null,
              cidade: cidade,
              uf: uf,
              posicao: posicao
            })
            .eq('id', player_id);
        } else {
          // Criar novo jogador
          const { data: newJogador, error: jogError } = await supabase
            .from('jogadores')
            .insert([{
              nome: profile.nome_completo || 'Jogador',
              apelido: apelido.trim(),
              foto_url: avatarUrl || null,
              criado_por: profile.id,
              cidade: cidade,
              uf: uf,
              pais: pais,
              posicao: posicao,
              ativo: true,
              total_votos: 0,
              media_estrelas: 0.00
            }])
            .select()
            .single();

          if (jogError) {
            console.error('Erro ao cadastrar jogador:', jogError);
            throw new Error('Erro ao salvar jogador no banco: ' + jogError.message);
          }
          if (newJogador) {
            player_id = newJogador.id;
            is_player = true;
          }
        }
      }

      const { data, error } = await profilesAPI.atualizar(profile.id, {
        apelido: apelido.trim(),
        altura: parsedAltura,
        idade: parsedIdade,
        foto_perfil: avatarUrl,
        posicao: posicao,
        cadastro_completo: true,
        player_id: player_id,
        is_player: is_player,
        cidade: is_player ? cidade : null,
        cidade_atual: is_player ? cidade : null,
        uf: is_player ? uf : null,
        pais: is_player ? pais : null,
        latitude: is_player ? coords?.latitude : null,
        longitude: is_player ? coords?.longitude : null,
        latitude_atual: is_player ? coords?.latitude : null,
        longitude_atual: is_player ? coords?.longitude : null,
      });

      if (error) throw error;
      onComplete(data); // atualiza o perfil no App.jsx
    } catch (err) {
      setErro(err.message || 'Erro ao salvar informações do perfil.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="app-shell" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
      <div style={{ padding: '0 clamp(14px, 4vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 16px' }}>
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Avatar" 
                style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                   border: '2px solid var(--accent)',
                  display: 'block',
                  objectFit: 'cover'
                }} 
              />
            ) : (
              <div style={{ 
                width: 80, 
                height: 80, 
                background: 'var(--accent-dim)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: 32, 
                color: '#60a5fa',
                fontWeight: 800
              }}>
                {profile?.nome_completo?.charAt(0).toUpperCase()}
              </div>
            )}
            
            <input 
              type="file" 
              accept="image/*" 
              id="avatar-upload-file" 
              onChange={handleFileChange} 
              style={{ display: 'none' }}
              disabled={uploading}
            />
            <label 
              htmlFor="avatar-upload-file" 
              style={{ 
                position: 'absolute', 
                bottom: 0, 
                right: 0, 
                background: 'var(--accent)', 
                color: 'white', 
                width: 26, 
                height: 26, 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                border: '2px solid var(--bg-primary)' 
              }}
              title="Carregar Foto"
            >
              {uploading ? (
                <div className="spinner" style={{ width: 12, height: 12, borderTopColor: 'white' }} />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              )}
            </label>
          </div>
          <h2 style={{ fontWeight: 800, fontSize: 'clamp(20px, 5vw, 24px)', marginBottom: 6 }}>Complete seu perfil</h2>
          <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
            Falta pouco! Preencha as informações obrigatórias para ter acesso completo ao Rank Hooper.
          </p>
        </div>

        {erro && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
            color: '#f87171',
            padding: '12px 16px',
            fontSize: 13,
            lineHeight: 1.4
          }}>
            ⚠️ {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Nome completo
            </label>
            <input
              disabled
              type="text"
              value={profile?.nome_completo || ''}
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              E-mail
            </label>
            <input
              disabled
              type="text"
              value={profile?.email || ''}
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Apelido *
            </label>
            <input
              required
              type="text"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              placeholder="Ex: DD, Viel, etc."
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Posição de Jogo *
            </label>
            <select
              required
              value={posicao}
              onChange={(e) => setPosicao(e.target.value)}
            >
              <option value="Armador">Armador</option>
              <option value="Ala-Armador">Ala-Armador</option>
              <option value="Ala">Ala</option>
              <option value="Ala-Pivô">Ala-Pivô</option>
              <option value="Pivô">Pivô</option>
            </select>
          </div>

          {/* Status da Localização Automática */}
          {locationStatus === 'requesting' && (
            <div style={{ padding: '12px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 8, fontSize: 13, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Obtendo localização atual...
            </div>
          )}

          {locationStatus === 'success' && (
            <div style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 13, color: '#a7f3d0' }}>
              ✓ Localização identificada: <strong>{cidade} - {uf}</strong> (Ranking Municipal liberado)
            </div>
          )}

          {locationStatus === 'denied' && (
            <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>
              ⚠️ Acesso à localização negado. Você poderá usar o aplicativo, mas não participará dos rankings.
            </div>
          )}

          {locationStatus === 'error' && (
            <div style={{ padding: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 13, color: '#fde047' }}>
              ⚠️ Não foi possível obter sua localização. Você poderá usar o aplicativo, mas não participará dos rankings.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Altura (m) *
              </label>
              <input
                required
                type="text"
                inputMode="decimal"
                value={altura}
                onChange={handleAlturaChange}
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
                value={idade}
                onChange={(e) => setIdade(e.target.value)}
                placeholder="Ex: 25"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            disabled={carregando}
          >
            {carregando ? (
              <>
                <div className="spinner" /> Salvando...
              </>
            ) : (
              'Salvar e Continuar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
