import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, rankingAPI, estatisticasPessoaisAPI } from '../lib/supabase';
import { useEsporte } from '../contexts/EsporteContext';
import LinhaEvolucao from '../components/LinhaEvolucao';
import { lerCache, salvarCache } from '../lib/pageCache';
import { meusAvaliados } from '../lib/avaliacaoPendente';
import { compartilharApp } from '../lib/compartilhar';



export default function Stats({ profile, onNavigate }) {
  const { esporte, cfg } = useEsporte();
  const fundamentos = cfg.habilidades;
  const _cache = lerCache('stats');
  const [aba, setAba] = useState('sobre'); // 'sobre' | 'estatisticas' | 'historico'
  const [subAbaHistorico, setSubAbaHistorico] = useState('pessoal'); // 'pessoal' | 'quadra'
  const [historicoPrivado, setHistoricoPrivado] = useState(_cache?.historicoPrivado || []);
  const [historicoQuadra, setHistoricoQuadra] = useState(_cache?.historicoQuadra || []);
  const [loading, setLoading] = useState(!_cache);
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [showAvancado, setShowAvancado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);

  // States de estatísticas calculadas privadas
  const [mediasPrivadas, setMediasPrivadas] = useState(_cache?.mediasPrivadas || null);

  // States do jogador público
  const [myPlayerInfo, setMyPlayerInfo] = useState(_cache?.myPlayerInfo || null);
  const [myRank, setMyRank] = useState(_cache?.myRank || '--');
  const [evolucao, setEvolucao] = useState(_cache?.evolucao || []);
  const [loadingEvolucao, setLoadingEvolucao] = useState(!_cache);
  // Contribuição da própria pessoa (quantos atletas ela já avaliou). É só
  // informação dela — de propósito, não existe ranking de quem mais avalia.
  const [avaliouQtd, setAvaliouQtd] = useState(null);

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';
  const uf = profile?.uf || 'PA';

  // Form State para partidas pessoais
  const formInicial = {
    data_partida: new Date().toISOString().split('T')[0],
    nome_jogador: '',
    pontos: 0,
    rebotes: 0,
    assistencias: 0,
    roubos_bola: 0,
    tocos: 0,
    perdas_bola: 0,
    arremessos_tentados: 0,
    arremessos_convertidos: 0,
    
    // Avançadas
    lance_livre_tentados: 0,
    lance_livre_convertidos: 0,
    dois_pontos_tentados: 0,
    dois_pontos_convertidos: 0,
    tres_pontos_tentados: 0,
    tres_pontos_convertidos: 0,
  };
  const [form, setForm] = useState(formInicial);

  useEffect(() => {
    if (profile) {
      loadAllStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, esporte]);

  // Guarda o último resultado para a tela já abrir preenchida na próxima visita.
  useEffect(() => {
    if (loading) return;
    salvarCache('stats', { historicoPrivado, mediasPrivadas, myPlayerInfo, myRank, evolucao, historicoQuadra });
  }, [loading, historicoPrivado, mediasPrivadas, myPlayerInfo, myRank, evolucao, historicoQuadra]);

  async function loadAllStats() {
    setLoading(true);
    try {
      // 1. Carregar estatísticas privadas
      const { data: privData } = await estatisticasPessoaisAPI.obterMinhas(esporte);
      const hist = privData || [];
      setHistoricoPrivado(hist);

      if (hist.length > 0) {
        const t = hist.reduce((acc, h) => ({
          pontos: acc.pontos + (h.pontos || 0),
          rebotes: acc.rebotes + (h.rebotes || 0),
          assistencias: acc.assistencias + (h.assistencias || 0),
          roubos: acc.roubos + (h.roubos_bola || 0),
          tocos: acc.tocos + (h.tocos || 0),
          perdas: acc.perdas + (h.perdas_bola || 0),
          arremessos_tentados: acc.arremessos_tentados + (h.arremessos_tentados || 0),
          arremessos_convertidos: acc.arremessos_convertidos + (h.arremessos_convertidos || 0),
          lf_tentados: acc.lf_tentados + (h.lance_livre_tentados || 0),
          lf_convertidos: acc.lf_convertidos + (h.lance_livre_convertidos || 0),
          dois_tentados: acc.dois_tentados + (h.dois_pontos_tentados || 0),
          dois_convertidos: acc.dois_convertidos + (h.dois_pontos_convertidos || 0),
          tres_tentados: acc.tres_tentados + (h.tres_pontos_tentados || 0),
          tres_convertidos: acc.tres_convertidos + (h.tres_pontos_convertidos || 0),
        }), {
          pontos: 0, rebotes: 0, assistencias: 0, roubos: 0, tocos: 0, perdas: 0,
          arremessos_tentados: 0, arremessos_convertidos: 0,
          lf_tentados: 0, lf_convertidos: 0, dois_tentados: 0, dois_convertidos: 0, tres_tentados: 0, tres_convertidos: 0
        });
        const qtd = hist.length;
        const m = {
          pontos: (t.pontos / qtd).toFixed(1),
          rebotes: (t.rebotes / qtd).toFixed(1),
          assistencias: (t.assistencias / qtd).toFixed(1),
          roubos: (t.roubos / qtd).toFixed(1),
          tocos: (t.tocos / qtd).toFixed(1),
          perdas: (t.perdas / qtd).toFixed(1),
          aproveitamento: t.arremessos_tentados > 0 ? ((t.arremessos_convertidos / t.arremessos_tentados) * 100).toFixed(0) : '0',
          lf_aproveitamento: t.lf_tentados > 0 ? ((t.lf_convertidos / t.lf_tentados) * 100).toFixed(0) : '0',
          dois_aproveitamento: t.dois_tentados > 0 ? ((t.dois_convertidos / t.dois_tentados) * 100).toFixed(0) : '0',
          tres_aproveitamento: t.tres_tentados > 0 ? ((t.tres_convertidos / t.tres_tentados) * 100).toFixed(0) : '0',
          lf_detalhe: `${t.lf_convertidos}/${t.lf_tentados}`,
          dois_detalhe: `${t.dois_convertidos}/${t.dois_tentados}`,
          tres_detalhe: `${t.tres_convertidos}/${t.tres_tentados}`,
        };
        setMediasPrivadas(m);
      } else {
        setMediasPrivadas(null);
      }

      // 2. Carregar informações do jogador público
      if (profile.player_id) {
        const { data: pInfo } = await supabase
          .from('jogadores')
          .select('*')
          .eq('id', profile.player_id)
          .maybeSingle();
        if (pInfo) {
          setMyPlayerInfo(pInfo);
        }

        // Calcular rank
        const { data: rankList } = await rankingAPI.get(city, uf, 200, esporte);
        if (rankList) {
          const myIndex = rankList.findIndex(j => j.id === profile.player_id);
          if (myIndex !== -1) {
            setMyRank(`#${myIndex + 1}`);
          }
        }

        // Linha de evolução: média mensal das avaliações recebidas
        setLoadingEvolucao(true);
        const { data: evo, error: evoError } = await supabase.rpc('evolucao_jogador', {
          p_jogador_id: profile.player_id,
          p_meses: 6,
        });
        if (evoError) {
          console.warn('Linha de evolução indisponível:', evoError.message);
          setEvolucao([]);
        } else {
          setEvolucao((evo || []).map(r => ({
            mes: r.mes,
            media: r.media === null || r.media === undefined ? null : Number(r.media),
            total: Number(r.total) || 0,
            jogos: Number(r.jogos) || 0,
            votos: Number(r.votos) || 0,
            pct_bom: Number(r.pct_bom) || 0,
          })));
        }

        // Obter histórico de partidas oficiais/de quadra
        const { data: myMatches } = await supabase
          .from('partida_jogadores')
          .select('time, partida:partidas(*)')
          .eq('jogador_id', profile.player_id);
        
        const quadraList = [];
        
        if (myMatches) {
          const finishedMatches = myMatches.filter(m => m.partida?.status === 'finalizado');
          finishedMatches.forEach(m => {
            const p = m.partida;
            const myTeam = m.time;
            const scoreMyTeam = myTeam === 'A' ? p.placar_time_a : p.placar_time_b;
            const scoreOpponent = myTeam === 'A' ? p.placar_time_b : p.placar_time_a;
            const won = scoreMyTeam > scoreOpponent;
            
            quadraList.push({
              id: p.id,
              data: p.created_at,
              timeA: p.time_a,
              timeB: p.time_b,
              placarA: p.placar_time_a,
              placarB: p.placar_time_b,
              vencedor: won ? 'Ganhou' : 'Perdeu'
            });
          });
          setHistoricoQuadra(quadraList);
        }
      }

      // Contribuição própria: quantos atletas já receberam nota minha.
      const { total: totalAvaliados } = await meusAvaliados();
      setAvaliouQtd(totalAvaliados);
    } catch (e) {
      console.error(e);
      showToast('Erro ao carregar dados.', 'error');
    } finally {
      setLoading(false);
      setLoadingEvolucao(false);
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCompartilhar() {
    const resultado = await compartilharApp();
    if (resultado === 'copiado') showToast('Link copiado — cole onde quiser', 'success');
    if (resultado === 'erro') showToast('Não consegui copiar o link', 'error');
  }

  // Lógica de incrementos de campos privados (totalmente independentes no formulário)
  function ajustarCampo(campo, valor) {
    setForm(prev => {
      const updates = { ...prev };
      updates[campo] = Math.max(0, (prev[campo] || 0) + valor);
      return updates;
    });
  }

  async function handleSalvar() {
    let tentados = parseInt(form.arremessos_tentados) || 0;
    let convertidos = parseInt(form.arremessos_convertidos) || 0;
    let pontos = parseInt(form.pontos) || 0;

    if (showAvancado) {
      const ll_conv = parseInt(form.lance_livre_convertidos) || 0;
      const ll_tent = parseInt(form.lance_livre_tentados) || 0;
      const d_conv = parseInt(form.dois_pontos_convertidos) || 0;
      const d_tent = parseInt(form.dois_pontos_tentados) || 0;
      const t_conv = parseInt(form.tres_pontos_convertidos) || 0;
      const t_tent = parseInt(form.tres_pontos_tentados) || 0;

      if (ll_conv > ll_tent) {
        showToast('Lances livres convertidos não podem superar os tentados.', 'error');
        return;
      }
      if (d_conv > d_tent) {
        showToast('2 Pts convertidos não podem superar os tentados.', 'error');
        return;
      }
      if (t_conv > t_tent) {
        showToast('3 Pts convertidos não podem superar os tentados.', 'error');
        return;
      }

      // Em modo avançado, calculamos os totais automaticamente
      convertidos = d_conv + t_conv;
      tentados = d_tent + t_tent;
      pontos = d_conv * 2 + t_conv * 3 + ll_conv;
    } else {
      if (convertidos > tentados) {
        showToast('Arremessos convertidos não podem superar os tentados.', 'error');
        return;
      }
    }

    setSalvando(true);
    try {
      const payload = { 
        ...form,
        arremessos_tentados: tentados,
        arremessos_convertidos: convertidos,
        pontos: pontos,
        esporte: esporte
      };
      if (!showAvancado) {
        payload.lance_livre_tentados = 0;
        payload.lance_livre_convertidos = 0;
        payload.dois_pontos_tentados = 0;
        payload.dois_pontos_convertidos = 0;
        payload.tres_pontos_tentados = 0;
        payload.tres_pontos_convertidos = 0;
      }
      
      const { error } = await estatisticasPessoaisAPI.registrar(payload);
      if (error) throw error;

      showToast('Partida registrada!', 'success');
      setShowRegistrar(false);
      setForm(formInicial);
      setShowAvancado(false);
      loadAllStats();
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar partida.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(id) {
    if (!window.confirm('Deseja excluir esta partida permanentemente do histórico pessoal?')) return;
    try {
      const { error } = await estatisticasPessoaisAPI.excluir(id);
      if (error) throw error;
      showToast('Partida excluída!', 'success');
      loadAllStats();
    } catch (e) {
      console.error(e);
      showToast('Erro ao excluir partida.', 'error');
    }
  }

  const starsVal = myPlayerInfo?.media_estrelas || 0;
  const badgeText = starsVal >= 4.5 ? 'ELITE' : starsVal >= 4.0 ? 'DESTAQUE' : starsVal >= 3.5 ? 'PROMESSA' : '';

  if (loading && !_cache) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '30vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-content home-page" style={{ position: 'relative' }}>
      <div style={{ padding: '16px 16px 0', position: 'relative', zIndex: 1 }}>
        
        {/* Cabeçalho: voltar à esquerda, compartilhar à direita */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <button 
            onClick={() => onNavigate('inicio')} 
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 700, padding: 0, fontFamily: 'inherit' }}
          >
            ← Início
          </button>

          <button
            type="button"
            onClick={handleCompartilhar}
            aria-label="Compartilhar o app"
            title="Compartilhar o app"
            style={{
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', padding: 0,
              marginRight: -8, marginTop: -6, marginBottom: -6,
              color: 'var(--accent-text)', cursor: 'pointer' }}
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.6 10.5l6.8-4" />
              <path d="M8.6 13.5l6.8 4" />
            </svg>
          </button>
        </div>

        {/* Fundo de Imagem com Fade */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: 'clamp(130px, 30vw, 160px)',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'flex-end',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          marginBottom: 10
        }}>
          {profile.foto_perfil ? (
            <img 
              src={profile.foto_perfil} 
              alt={profile.nome_completo} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, opacity: 0.7 }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-secondary) 100%)', opacity: 0.5 }} />
          )}

          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to top, var(--bg-primary) 0%, rgba(17, 24, 39, 0) 100%)',
            zIndex: 1
          }} />

          <div style={{ zIndex: 2, padding: '16px', width: '100%' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2 }} >{profile.nome_completo}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              {badgeText && (
                <span style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-line)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.02em'
                }}>
                  {badgeText}
                </span>
              )}
              <span style={{ color: '#6A6A82', fontSize: '11px' }}>{profile.posicao || myPlayerInfo?.posicao || cfg.posicoes[0]}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '17px', fontWeight: 900, color: 'var(--accent)', fontFamily: 'monospace' }}>
                  {starsVal > 0 ? Number(starsVal).toFixed(1) : '0.0'}
                </span>
                <span style={{ color: 'var(--accent)', fontSize: '15px' }}>★</span>
                <span style={{ color: '#94A3B8', fontSize: '11px', marginLeft: 4 }}>Nota média</span>
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                {myRank !== '--' ? `${myRank} ` : ''}{city} - {uf}
              </div>
            </div>
          </div>
        </div>

        {/* Contribuição própria — só a pessoa vê a dela. De propósito, não
            existe ranking de quem mais avalia. */}
        {avaliouQtd !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: 'var(--text-secondary)',
            fontFamily: "'Inter',sans-serif", marginBottom: 10 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--accent-text)" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {avaliouQtd === 0 ? (
              <span>Você ainda não avaliou nenhum jogador</span>
            ) : (
              <span>Você avaliou <strong style={{ color: 'var(--text-primary)' }}>{avaliouQtd}</strong> {avaliouQtd === 1 ? 'jogador' : 'jogadores'}</span>
            )}
          </div>
        )}

        {/* Linha de Evolução (média mensal real das avaliações recebidas) */}
        <LinhaEvolucao serie={evolucao} loading={loadingEvolucao} />

        {/* Tab Bar interna */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '4px',
          gap: 4,
          marginBottom: 10
        }}>
          {[
            { key: 'sobre', label: 'SOBRE' },
            { key: 'estatisticas', label: 'ESTATÍSTICAS' },
            { key: 'historico', label: 'HISTÓRICO' }
          ].map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setAba(t.key)}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: '6px',
                border: 'none',
                background: aba === t.key ? 'var(--bg-elevated)' : 'none',
                color: aba === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo das Tabs */}
        <div style={{ minHeight: '80px', paddingBottom: 16 }}>
          {aba === 'sobre' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '13px' }}>
              {[
                { label: 'Cidade', val: `${city} - ${uf}` },
                { label: 'Idade', val: profile?.idade ? `${profile.idade} anos` : 'A definir' },
                { label: 'Altura', val: profile?.altura ? `${Number(profile.altura).toFixed(2)} m` : 'A definir' },
                { label: 'Posição', val: profile.posicao || myPlayerInfo?.posicao || cfg.posicoes[0] },
                { label: 'Equipe', val: myPlayerInfo?.equipe || `${city} Hooper` },
              ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.val}</span>
                </div>
              ))}
            </div>
          )}

          {aba === 'estatisticas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Avaliações Públicas */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em', marginBottom: 10, fontFamily: "'Inter',sans-serif", textTransform: 'uppercase' }}>AVALIAÇÕES PÚBLICAS DA QUADRA</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {fundamentos.map(f => {
                    const mediaAspecto = myPlayerInfo ? myPlayerInfo[`media_${f.key}`] || 0 : 0;
                    return (
                      <div key={f.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                            {myPlayerInfo?.total_votos >= 1 ? `★ ${Number(mediaAspecto).toFixed(1)}` : '--'}
                          </span>
                        </div>
                        <div className="progress-bar" style={{ height: '4px', background: 'var(--bg-secondary)' }}>
                          <div 
                            className="progress-fill bar-grow-fill" 
                            style={{ width: myPlayerInfo?.total_votos >= 1 ? `${(mediaAspecto / 5) * 100}%` : '0%', background: 'var(--accent)' }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Registro Privado */}
              <div className="card" style={{ padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em', fontFamily: "'Inter',sans-serif", textTransform: 'uppercase' }}>ESTATÍSTICAS PRIVADAS</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{historicoPrivado.length} jogos</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Registre seus números de forma privada. Esses dados não afetam os rankings e servem para seu controle pessoal.
                </p>

                {mediasPrivadas ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    
                    {/* Linha Principal de Médias */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                      <div style={{ background: 'var(--bg-secondary)', padding: '8px 4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--accent)' }}>{mediasPrivadas.pontos}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>PPJ</div>
                      </div>
                      <div style={{ background: 'var(--bg-secondary)', padding: '8px 4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)' }}>{mediasPrivadas.rebotes}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>REB</div>
                      </div>
                      <div style={{ background: 'var(--bg-secondary)', padding: '8px 4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)' }}>{mediasPrivadas.assistencias}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>AST</div>
                      </div>
                    </div>

                    {/* Painel de Aproveitamento de Arremessos */}
                    <div style={{ 
                      background: 'var(--bg-secondary)', 
                      borderRadius: '10px', 
                      padding: '8px', 
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      {/* Círculo de Aproveitamento Geral */}
                      <div style={{ 
                        position: 'relative', 
                        width: '74px', 
                        height: '74px', 
                        borderRadius: '50%', 
                        background: `conic-gradient(var(--accent) 0% ${mediasPrivadas.aproveitamento}%, var(--border) ${mediasPrivadas.aproveitamento}% 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <div style={{ 
                          width: '60px', 
                          height: '60px', 
                          borderRadius: '50%', 
                          background: 'var(--bg-secondary)', 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          <span style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: '1' }}>{mediasPrivadas.aproveitamento}%</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>GERAL</span>
                        </div>
                      </div>

                      {/* Aproveitamento Individual por Categoria */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          { label: 'Lance Livre', pct: mediasPrivadas.lf_aproveitamento, vol: mediasPrivadas.lf_detalhe },
                          { label: 'Arremesso de 2', pct: mediasPrivadas.dois_aproveitamento, vol: mediasPrivadas.dois_detalhe },
                          { label: 'Arremesso de 3', pct: mediasPrivadas.tres_aproveitamento, vol: mediasPrivadas.tres_detalhe },
                        ].map(item => (
                          <div key={item.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2 }}>
                              <span>{item.label}</span>
                              <span style={{ color: 'var(--text-primary)' }}>{item.pct}% <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({item.vol})</span></span>
                            </div>
                            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: 'var(--accent)', width: `${item.pct}%`, borderRadius: '2px' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Gráfico de Evolução (Últimos 5 Jogos) */}
                    {historicoPrivado.length > 0 && (
                      <div style={{ 
                        background: 'var(--bg-card)', 
                        borderRadius: '10px', 
                        padding: '8px', 
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase', fontFamily: "'Inter',sans-serif" }}>
                          Evolução de Pontos (Últimos 5 Jogos)
                        </div>
                        
                        {(() => {
                          const ultimasPartidasParaGrafico = [...historicoPrivado].slice(0, 5).reverse();
                          const maxPontos = Math.max(...ultimasPartidasParaGrafico.map(p => p.pontos || 0), 10);
                          
                          return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '60px', padding: '0 8px', marginTop: 10, position: 'relative' }}>
                              {/* Linha auxiliar horizontal a 50% de altura */}
                              <div style={{
                                position: 'absolute',
                                left: 8,
                                right: 8,
                                top: '50%',
                                borderTop: '1px dashed var(--border)',
                                pointerEvents: 'none',
                                zIndex: 0
                              }} />
                              
                              {ultimasPartidasParaGrafico.map((partida, idx) => {
                                const alturaPct = Math.max(8, ((partida.pontos || 0) / maxPontos) * 100);
                                return (
                                  <div key={partida.id || idx} style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    flex: 1, 
                                    height: '100%', 
                                    justifyContent: 'flex-end',
                                    position: 'relative',
                                    zIndex: 1
                                  }}>
                                    {/* Pontuação no topo da barra */}
                                    <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>
                                      {partida.pontos}
                                    </span>
                                    {/* Barra vertical com gradiente */}
                                    <div style={{ 
                                      width: '14px', 
                                      height: `${alturaPct}%`, 
                                      background: 'linear-gradient(to top, var(--accent-dim) 0%, var(--accent) 100%)',
                                      borderRadius: '4px 4px 0 0',
                                      transition: 'height 0.3s ease'
                                    }} />
                                    {/* Data ou número da partida embaixo */}
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 6 }}>
                                      {new Date(partida.data_partida + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                  </div>
                ) : null}

                <button className="btn btn-primary btn-sm" onClick={() => setShowRegistrar(true)} style={{ width: '100%', marginTop: 8 }}>
                  Registrar Partida Pessoal
                </button>
              </div>
            </div>
          )}

          {aba === 'historico' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              
              {/* Seletor de Tipo de Histórico */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <button
                  onClick={() => setSubAbaHistorico('pessoal')}
                  style={{
                    background: subAbaHistorico === 'pessoal' ? 'var(--accent-soft)' : 'none',
                    border: subAbaHistorico === 'pessoal' ? '1px solid var(--accent-soft)' : '1px solid transparent',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '11px',
                    color: subAbaHistorico === 'pessoal' ? 'var(--accent)' : '#64748B',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Pessoal (Privado)
                </button>
                <button
                  onClick={() => setSubAbaHistorico('quadra')}
                  style={{
                    background: subAbaHistorico === 'quadra' ? 'var(--accent-soft)' : 'none',
                    border: subAbaHistorico === 'quadra' ? '1px solid var(--accent-soft)' : '1px solid transparent',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '11px',
                    color: subAbaHistorico === 'quadra' ? 'var(--accent)' : '#64748B',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Oficial (Quadra)
                </button>
              </div>

              {subAbaHistorico === 'pessoal' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historicoPrivado.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                      Nenhuma partida registrada no seu histórico pessoal privado.
                    </div>
                  ) : (
                    historicoPrivado.map(h => (
                      <div key={h.id} style={{
                        background: 'var(--bg-card)',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        position: 'relative'
                      }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {h.pontos} pts | {h.rebotes} reb | {h.assistencias} ast
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                            {new Date(h.data_partida + 'T00:00:00').toLocaleDateString('pt-BR')}
                            {h.nome_jogador && ` • ${h.nome_jogador}`}
                          </div>
                        </div>

                        <button 
                          onClick={() => handleExcluir(h.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            padding: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historicoQuadra.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                      Nenhuma partida finalizada jogada em quadras oficiais.
                    </div>
                  ) : (
                    historicoQuadra.map(h => (
                      <div key={h.id} style={{
                        background: 'var(--bg-card)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {h.timeA} {h.placarA} x {h.placarB} {h.timeB}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {new Date(h.data).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: h.vencedor === 'Ganhou' ? '#10B981' : '#EF4444',
                          background: h.vencedor === 'Ganhou' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px'
                        }}>
                          {h.vencedor.toUpperCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Modal Registrar Partida Pessoal */}
      {showRegistrar && (
        <div className="modal-overlay" onClick={() => { if (!salvando) setShowRegistrar(false); }} style={{ zIndex: 1000 }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 900, fontSize: 'clamp(17px, 4vw, 20px)', marginBottom: 4 }}>Nova Partida</h3>
            <p style={{ color: '#64748b', fontSize: 'clamp(11px, 2.5vw, 12px)', marginBottom: 10 }}>Grave seus números de forma privada.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome do Evento / Oponente</label>
                <input
                  type="text"
                  value={form.nome_jogador || ''}
                  onChange={e => setForm(p => ({ ...p, nome_jogador: e.target.value }))}
                  placeholder="Ex: Treino Noite, Adversário..."
                />
              </div>

              <div>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Data da Partida</label>
                <input
                  type="date"
                  value={form.data_partida}
                  onChange={e => setForm(p => ({ ...p, data_partida: e.target.value }))}
                />
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowAvancado(!showAvancado);
                  setForm(prev => ({
                    ...prev,
                    lance_livre_tentados: 0,
                    lance_livre_convertidos: 0,
                    dois_pontos_tentados: 0,
                    dois_pontos_convertidos: 0,
                    tres_pontos_tentados: 0,
                    tres_pontos_convertidos: 0,
                  }));
                }}
                style={{ alignSelf: 'flex-start', margin: '4px 0' }}
              >
                {showAvancado ? '← Ocultar Avançados' : 'Mostrar Avançados'}
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {showAvancado ? (
                  <>
                    {[
                      { l: 'Lances Livres Tentados', k: 'lance_livre_tentados' },
                      { l: 'Lances Livres Convertidos', k: 'lance_livre_convertidos' },
                      { l: '2 Pts Tentados', k: 'dois_pontos_tentados' },
                      { l: '2 Pts Convertidos', k: 'dois_pontos_convertidos' },
                      { l: '3 Pts Tentados', k: 'tres_pontos_tentados' },
                      { l: '3 Pts Convertidos', k: 'tres_pontos_convertidos' },
                    ].map(item => (
                      <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{item.l}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button type="button" onClick={() => ajustarCampo(item.k, -1)} className="btn btn-secondary" style={{ width: 28, height: 28, padding: 0, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>-</button>
                          <span style={{ fontWeight: 800, fontSize: 15, minWidth: 20, textAlign: 'center' }}>{form[item.k]}</span>
                          <button type="button" onClick={() => ajustarCampo(item.k, 1)} className="btn btn-secondary" style={{ width: 28, height: 28, padding: 0, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>+</button>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      { l: 'Arremessos Tentados', k: 'arremessos_tentados' },
                      { l: 'Arremessos Convertidos', k: 'arremessos_convertidos' },
                      { l: 'Pontos', k: 'pontos' },
                    ].map(item => (
                      <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{item.l}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button type="button" onClick={() => ajustarCampo(item.k, -1)} className="btn btn-secondary" style={{ width: 26, height: 26, padding: 0, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>-</button>
                          <span style={{ fontWeight: 800, fontSize: 15, minWidth: 24, textAlign: 'center' }}>{form[item.k]}</span>
                          <button type="button" onClick={() => ajustarCampo(item.k, 1)} className="btn btn-secondary" style={{ width: 26, height: 26, padding: 0, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>+</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {[
                  { l: 'Rebotes', k: 'rebotes' },
                  { l: 'Assistências', k: 'assistencias' },
                  { l: 'Roubos de Bola', k: 'roubos_bola' },
                  { l: 'Tocos', k: 'tocos' },
                  { l: 'Perdas de Bola', k: 'perdas_bola' },
                ].map(item => (
                  <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{item.l}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button type="button" onClick={() => ajustarCampo(item.k, -1)} className="btn btn-secondary" style={{ width: 26, height: 26, padding: 0, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>-</button>
                      <span style={{ fontWeight: 800, fontSize: 15, minWidth: 24, textAlign: 'center' }}>{form[item.k]}</span>
                      <button type="button" onClick={() => ajustarCampo(item.k, 1)} className="btn btn-secondary" style={{ width: 26, height: 26, padding: 0, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setShowRegistrar(false)} style={{ flex: 1 }} disabled={salvando}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando} style={{ flex: 2 }}>
                {salvando ? 'Salvando...' : 'Salvar Partida'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`toast ${toast.type}`} 
            style={{ zIndex: 9999 }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
