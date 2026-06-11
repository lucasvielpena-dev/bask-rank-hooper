import { useState, useEffect, useMemo } from 'react';
import { supabase, rankingAPI, estatisticasPessoaisAPI } from '../lib/supabase';

const fundamentos = [
  { key: 'arremesso', label: 'Arremesso' },
  { key: 'controle_de_bola', label: 'Controle de Bola' },
  { key: 'defesa', label: 'Defesa' },
  { key: 'visao_de_jogo', label: 'Visão de Jogo' },
  { key: 'explosao_fisica', label: 'Explosão Física' }
];

export default function Stats({ profile, onNavigate }) {
  const [aba, setAba] = useState('sobre'); // 'sobre' | 'estatisticas' | 'historico'
  const [subAbaHistorico, setSubAbaHistorico] = useState('pessoal'); // 'pessoal' | 'quadra'
  const [historicoPrivado, setHistoricoPrivado] = useState([]);
  const [historicoQuadra, setHistoricoQuadra] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [showAvancado, setShowAvancado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);

  // States de estatísticas calculadas privadas
  const [mediasPrivadas, setMediasPrivadas] = useState(null);

  // States do jogador público
  const [myPlayerInfo, setMyPlayerInfo] = useState(null);
  const [myRank, setMyRank] = useState('--');
  const [careerStats, setCareerStats] = useState({ games: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 });

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
  }, [profile]);

  async function loadAllStats() {
    setLoading(true);
    try {
      // 1. Carregar estatísticas privadas
      const { data: privData } = await estatisticasPessoaisAPI.obterMinhas();
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
        const { data: rankList } = await rankingAPI.get(city, uf, 200);
        if (rankList) {
          const myIndex = rankList.findIndex(j => j.id === profile.player_id);
          if (myIndex !== -1) {
            setMyRank(`#${myIndex + 1}`);
          }
        }

        // Obter histórico de partidas oficiais/de quadra
        const { data: myMatches } = await supabase
          .from('partida_jogadores')
          .select('time, partida:partidas(*)')
          .eq('jogador_id', profile.player_id);
        
        let totalGames = 0;
        const quadraList = [];
        
        if (myMatches) {
          const finishedMatches = myMatches.filter(m => m.partida?.status === 'finalizado');
          finishedMatches.forEach(m => {
            const p = m.partida;
            const myTeam = m.time;
            const scoreMyTeam = myTeam === 'A' ? p.placar_time_a : p.placar_time_b;
            const scoreOpponent = myTeam === 'A' ? p.placar_time_b : p.placar_time_a;
            const won = scoreMyTeam > scoreOpponent;
            
            if (won) totalGames++;
            
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
          totalGames = finishedMatches.length;
        }

        // Obter estatísticas oficiais acumuladas
        const { data: myStats } = await supabase
          .from('estatisticas_partida')
          .select('pontos, rebotes, assistencias, tocos, roubos_bola')
          .eq('jogador_id', profile.player_id);

        let totalPoints = 0;
        let totalRebounds = 0;
        let totalAssists = 0;
        let totalSteals = 0;
        let totalBlocks = 0;

        if (myStats) {
          myStats.forEach(s => {
            totalPoints += s.pontos || 0;
            totalRebounds += s.rebotes || 0;
            totalAssists += s.assistencias || 0;
            totalSteals += s.roubos_bola || 0;
            totalBlocks += s.tocos || 0;
          });
        }

        setCareerStats({
          games: totalGames,
          points: totalPoints,
          rebounds: totalRebounds,
          assists: totalAssists,
          steals: totalSteals,
          blocks: totalBlocks
        });
      }
    } catch (e) {
      console.error(e);
      showToast('Erro ao carregar dados.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
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
        pontos: pontos
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

  // Cálculos de médias oficiais/carreira
  const { ppj, reb, ast, stl, blk } = useMemo(() => {
    const totalGamesNum = careerStats.games || 0;
    return {
      ppj: totalGamesNum > 0 ? (careerStats.points / totalGamesNum).toFixed(1) : '0.0',
      reb: totalGamesNum > 0 ? (careerStats.rebounds / totalGamesNum).toFixed(1) : '0.0',
      ast: totalGamesNum > 0 ? (careerStats.assists / totalGamesNum).toFixed(1) : '0.0',
      stl: totalGamesNum > 0 ? (careerStats.steals / totalGamesNum).toFixed(1) : '0.0',
      blk: totalGamesNum > 0 ? (careerStats.blocks / totalGamesNum).toFixed(1) : '0.0',
    };
  }, [careerStats]);

  const starsVal = myPlayerInfo?.media_estrelas || 0;
  const badgeText = starsVal >= 4.5 ? 'ELITE' : starsVal >= 4.0 ? 'DESTAQUE' : starsVal >= 3.5 ? 'PROMESSA' : 'EM DEV.';

  let evolutionIndex = 0;
  if (starsVal >= 4.5) {
    evolutionIndex = 3;
  } else if (starsVal >= 4.0) {
    evolutionIndex = 2;
  } else if (starsVal >= 3.0) {
    evolutionIndex = 1;
  }

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '30vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: '12px 12px 0' }}>
        
        {/* Cabeçalho Voltar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <button 
            onClick={() => onNavigate('inicio')} 
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 700, padding: 0, fontFamily: 'inherit' }}
          >
            ← Início
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
              <span style={{
                background: 'rgba(200,241,53,0.12)',
                color: 'var(--accent)',
                border: '1px solid rgba(200,241,53,0.3)',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.02em'
              }}>
                {badgeText}
              </span>
              <span style={{ color: '#94A3B8', fontSize: '11px' }}>{profile.posicao || myPlayerInfo?.posicao || 'Ala'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent)', fontFamily: 'monospace' }}>
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

        {/* Linha de Médias de Quadra */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 'clamp(4px, 1vw, 8px)',
          background: 'var(--bg-secondary)',
          padding: '6px 4px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          textAlign: 'center',
          marginBottom: 10
        }}>
          {[
            { label: 'PPJ', val: ppj },
            { label: 'REB', val: reb },
            { label: 'AST', val: ast },
            { label: 'STL', val: stl },
            { label: 'BLK', val: blk },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 'clamp(13px, 3.5vw, 16px)', fontWeight: 800, color: 'var(--text-primary)' }}>{item.val}</div>
              <div style={{ fontSize: 'clamp(8px, 2vw, 9px)', color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Linha de Evolução */}
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'Oswald',sans-serif" }}>
            LINHA DE EVOLUÇÃO
          </div>
          <div className="evolution-timeline" style={{ margin: '10px 0 4px' }}>
            <div className="evolution-progress-line" style={{ width: `${evolutionIndex * 33.3}%` }} />
            {[
              { label: 'Rookie', year: '2023', val: 0 },
              { label: 'Promessa', year: '2024', val: 1 },
              { label: 'Elite', year: '2025', val: 2 },
              { label: 'MVP', year: '2026', val: 3 },
            ].map(step => (
              <div key={step.label} className={`evolution-step ${evolutionIndex >= step.val ? 'completed' : ''} ${evolutionIndex === step.val ? 'active' : ''}`}>
                <div className="evolution-dot" style={{ width: '18px', height: '18px', fontSize: '9px' }}>
                  {step.val === 3 ? '★' : step.val + 1}
                </div>
                <div className="evolution-label" style={{ fontSize: '8px', marginTop: 4 }}>{step.label}</div>
                <div className="evolution-year" style={{ fontSize: '7px' }}>{step.year}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Bar interna */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '2px',
          gap: 2,
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
                padding: '6px 3px',
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '13px' }}>
              {[
                { label: 'Cidade', val: `${city} - ${uf}` },
                { label: 'Idade', val: profile?.idade ? `${profile.idade} anos` : 'A definir' },
                { label: 'Altura', val: profile?.altura ? `${Number(profile.altura).toFixed(2)} m` : 'A definir' },
                { label: 'Posição', val: profile.posicao || myPlayerInfo?.posicao || 'Ala' },
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Avaliações Públicas */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em', marginBottom: 10, fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase' }}>AVALIAÇÕES PÚBLICAS DA QUADRA</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em', fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase' }}>ESTATÍSTICAS PRIVADAS</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{historicoPrivado.length} jogos</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Registre seus números de forma privada. Esses dados não afetam os rankings e servem para seu controle pessoal.
                </p>

                {mediasPrivadas ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    
                    {/* Linha Principal de Médias */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, textAlign: 'center' }}>
                      <div style={{ background: 'var(--bg-secondary)', padding: '6px 3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent)' }}>{mediasPrivadas.pontos}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>PPJ</div>
                      </div>
                      <div style={{ background: 'var(--bg-secondary)', padding: '6px 3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{mediasPrivadas.rebotes}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>REB</div>
                      </div>
                      <div style={{ background: 'var(--bg-secondary)', padding: '6px 3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{mediasPrivadas.assistencias}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>AST</div>
                      </div>
                    </div>

                    {/* Painel de Aproveitamento de Arremessos */}
                    <div style={{ 
                      background: 'var(--bg-secondary)', 
                      borderRadius: '10px', 
                      padding: '10px', 
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
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
                          <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: '1' }}>{mediasPrivadas.aproveitamento}%</span>
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>GERAL</span>
                        </div>
                      </div>

                      {/* Aproveitamento Individual por Categoria */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          { label: 'Lance Livre', pct: mediasPrivadas.lf_aproveitamento, vol: mediasPrivadas.lf_detalhe },
                          { label: 'Arremesso de 2', pct: mediasPrivadas.dois_aproveitamento, vol: mediasPrivadas.dois_detalhe },
                          { label: 'Arremesso de 3', pct: mediasPrivadas.tres_aproveitamento, vol: mediasPrivadas.tres_detalhe },
                        ].map(item => (
                          <div key={item.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2 }}>
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
                        padding: '10px', 
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase', fontFamily: "'Oswald',sans-serif" }}>
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
                                    <span style={{ fontSize: '9px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>
                                      {partida.pontos}
                                    </span>
                                    {/* Barra vertical com gradiente */}
                                    <div style={{ 
                                      width: '14px', 
                                      height: `${alturaPct}%`, 
                                      background: 'linear-gradient(to top, var(--accent-dim) 0%, var(--accent) 100%)',
                                      borderRadius: '4px 4px 0 0',
                                      boxShadow: '0 0 10px var(--accent-dim)',
                                      transition: 'height 0.3s ease'
                                    }} />
                                    {/* Data ou número da partida embaixo */}
                                    <span style={{ fontSize: '7px', color: 'var(--text-muted)', fontWeight: 700, marginTop: 6 }}>
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
                  ➕ Registrar Partida Pessoal
                </button>
              </div>
            </div>
          )}

          {aba === 'historico' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              
              {/* Seletor de Tipo de Histórico */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <button
                  onClick={() => setSubAbaHistorico('pessoal')}
                  style={{
                    background: subAbaHistorico === 'pessoal' ? 'rgba(200,241,53,0.1)' : 'none',
                    border: subAbaHistorico === 'pessoal' ? '1px solid rgba(200,241,53,0.2)' : '1px solid transparent',
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
                    background: subAbaHistorico === 'quadra' ? 'rgba(200,241,53,0.1)' : 'none',
                    border: subAbaHistorico === 'quadra' ? '1px solid rgba(200,241,53,0.2)' : '1px solid transparent',
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
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
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
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {h.pontos} pts | {h.rebotes} reb | {h.assistencias} ast
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
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
                            padding: 6,
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
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                      Nenhuma partida finalizada jogada em quadras oficiais.
                    </div>
                  ) : (
                    historicoQuadra.map(h => (
                      <div key={h.id} style={{
                        background: 'var(--bg-card)',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {h.timeA} {h.placarA} x {h.placarB} {h.timeB}
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {new Date(h.data).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: h.vencedor === 'Ganhou' ? '#10B981' : '#EF4444',
                          background: h.vencedor === 'Ganhou' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          padding: '2px 6px',
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome do Evento / Oponente</label>
                <input
                  type="text"
                  value={form.nome_jogador || ''}
                  onChange={e => setForm(p => ({ ...p, nome_jogador: e.target.value }))}
                  placeholder="Ex: Treino Noite, Adversário..."
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Data da Partida</label>
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
                style={{ alignSelf: 'flex-start', margin: '4px 0', fontSize: 11 }}
              >
                {showAvancado ? '← Ocultar Avançados' : '⚡ Mostrar Avançados'}
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
                      <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{item.l}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button type="button" onClick={() => ajustarCampo(item.k, -1)} className="btn btn-secondary" style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 16 }}>-</button>
                          <span style={{ fontWeight: 800, fontSize: 14, minWidth: 20, textAlign: 'center' }}>{form[item.k]}</span>
                          <button type="button" onClick={() => ajustarCampo(item.k, 1)} className="btn btn-secondary" style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 16 }}>+</button>
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
                      <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{item.l}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button type="button" onClick={() => ajustarCampo(item.k, -1)} className="btn btn-secondary" style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 18 }}>-</button>
                          <span style={{ fontWeight: 800, fontSize: 15, minWidth: 24, textAlign: 'center' }}>{form[item.k]}</span>
                          <button type="button" onClick={() => ajustarCampo(item.k, 1)} className="btn btn-secondary" style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 18 }}>+</button>
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
                  <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{item.l}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button type="button" onClick={() => ajustarCampo(item.k, -1)} className="btn btn-secondary" style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 18 }}>-</button>
                      <span style={{ fontWeight: 800, fontSize: 15, minWidth: 24, textAlign: 'center' }}>{form[item.k]}</span>
                      <button type="button" onClick={() => ajustarCampo(item.k, 1)} className="btn btn-secondary" style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 18 }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setShowRegistrar(false)} style={{ flex: 1 }} disabled={salvando}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando} style={{ flex: 2 }}>
                {salvando ? 'Salvando...' : 'Salvar Partida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
