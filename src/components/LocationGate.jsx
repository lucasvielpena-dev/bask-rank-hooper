import { useState } from 'react';
import { profilesAPI, supabase } from '../lib/supabase';

const ESTADO_TO_UF = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amazonas': 'AM', 'bahia': 'BA',
  'ceará': 'CE', 'distrito federal': 'DF', 'espírito santo': 'ES', 'goiás': 'GO',
  'maranhão': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  'pará': 'PA', 'paraíba': 'PB', 'paraná': 'PR', 'pernambuco': 'PE', 'piauí': 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  'rondônia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC', 'são paulo': 'SP',
  'sergipe': 'SE', 'tocantins': 'TO',
};

/**
 * Bloqueia o app até o usuário autorizar localização e gravar cidade/UF.
 * Usado para quem já completou o perfil sem cidade (ou perdeu o dado).
 */
export default function LocationGate({ profile, onResolved }) {
  const [status, setStatus] = useState('idle'); // idle | requesting | success | denied | error
  const [info, setInfo] = useState(null); // { cidade, uf, lat, lon }
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function pedirLocalizacao() {
    setErro(null);
    if (!navigator.geolocation) {
      setStatus('error');
      setErro('Este dispositivo não suporta geolocalização.');
      return;
    }
    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          const data = await res.json();
          const address = data.address || {};
          const cidade =
            address.municipality || address.city || address.town || address.village || null;
          const stateName = (address.state || '').toLowerCase();
          const uf = ESTADO_TO_UF[stateName] || null;
          if (!cidade || !uf) {
            setStatus('error');
            setErro('Não identificamos a cidade. Tente de novo ao ar livre.');
            return;
          }
          setInfo({ cidade, uf, lat: latitude, lon: longitude, pais: address.country || 'Brasil' });
          setStatus('success');
        } catch (e) {
          setStatus('error');
          setErro(e.message || 'Erro ao identificar a cidade.');
        }
      },
      (err) => {
        setStatus(err?.code === 1 ? 'denied' : 'error');
        setErro(
          err?.code === 1
            ? 'Permissão negada. Ative a localização nas configurações do celular e tente de novo.'
            : 'Não foi possível obter a localização. Verifique o GPS.'
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  async function confirmar() {
    if (!info || !profile?.id) return;
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        cidade: info.cidade,
        cidade_atual: info.cidade,
        uf: info.uf,
        pais: info.pais,
        latitude: info.lat,
        longitude: info.lon,
        latitude_atual: info.lat,
        longitude_atual: info.lon,
      };
      const { data, error } = await profilesAPI.atualizar(profile.id, payload);
      if (error) throw error;

      // Atualiza o jogador vinculado, se existir
      if (profile.player_id) {
        await supabase
          .from('jogadores')
          .update({ cidade: info.cidade, uf: info.uf })
          .eq('id', profile.player_id);
      } else if (profile.id) {
        await supabase
          .from('jogadores')
          .update({ cidade: info.cidade, uf: info.uf })
          .eq('criado_por', profile.id);
      }

      onResolved(data || { ...profile, ...payload });
    } catch (e) {
      setErro(e.message || 'Erro ao salvar localização.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="app-shell" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
      <div style={{ padding: '24px 18px', maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            margin: '0 auto 16px',
            background: 'var(--accent-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28 }}
        >
                  </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Localização obrigatória</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
          O Rank Hooper mostra só atletas da <strong>sua cidade</strong>. Precisamos da sua
          localização para classificar você no ranking municipal certo.
        </p>

        {status === 'success' && info && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.25)',
              marginBottom: 16,
              fontSize: 14,
              color: 'var(--text-primary)' }}
          >
            Identificamos: <strong>{info.cidade} - {info.uf}</strong>
          </div>
        )}

        {erro && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              marginBottom: 16,
              fontSize: 13,
              color: '#fca5a5',
              textAlign: 'left' }}
          >
            {erro}
          </div>
        )}

        {status !== 'success' ? (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={pedirLocalizacao}
            disabled={status === 'requesting'}
          >
            {status === 'requesting' ? 'Obtendo localização...' : 'Permitir localização'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={confirmar}
            disabled={salvando}
          >
            {salvando ? 'Salvando...' : `Confirmar ${info.cidade} - ${info.uf}`}
          </button>
        )}

        {status === 'success' && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 10 }}
            onClick={pedirLocalizacao}
            disabled={salvando}
          >
            Detectar de novo
          </button>
        )}
      </div>
    </div>
  );
}
