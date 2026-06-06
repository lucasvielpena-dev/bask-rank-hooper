import { useState, useEffect } from 'react';
import { estatisticasPessoaisAPI } from '../lib/supabase';

export default function Stats() {
  const [aba, setAba] = useState('resumo');
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [showAvancado, setShowAvancado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);

  // States de estatísticas calculadas
  const [totais, setTotais] = useState(null);
  const [medias, setMedias] = useState(null);
  const [melhorJogo, setMelhorJogo] = useState(null);

  // Form State
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
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const { data, error } = await estatisticasPessoaisAPI.obterMinhas();
      if (error) throw error;

      const hist = data || [];
      setHistorico(hist);

      if (hist.length > 0) {
        // 1. Calcular Totais Acumulados
        const t = hist.reduce((acc, h) => ({
          pontos: acc.pontos + (h.pontos || 0),
          rebotes: acc.rebotes + (h.rebotes || 0),
          assistencias: acc.assistencias + (h.assistencias || 0),
          roubos: acc.roubos + (h.roubos_bola || 0),
          tocos: acc.tocos + (h.tocos || 0),
          perdas: acc.perdas + (h.perdas_bola || 0),
          arremessos_tentados: acc.arremessos_tentados + (h.arremessos_tentados || 0),
          arremessos_convertidos: acc.arremessos_convertidos + (h.arremessos_convertidos || 0),
          
          // Avançadas
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
        setTotais(t);

        // 2. Calcular Médias por Jogo
        const qtd = hist.length;
        const m = {
          pontos: (t.pontos / qtd).toFixed(1).replace('.', ','),
          rebotes: (t.rebotes / qtd).toFixed(1).replace('.', ','),
          assistencias: (t.assistencias / qtd).toFixed(1).replace('.', ','),
          roubos: (t.roubos / qtd).toFixed(1).replace('.', ','),
          tocos: (t.tocos / qtd).toFixed(1).replace('.', ','),
          perdas: (t.perdas / qtd).toFixed(1).replace('.', ','),
          aproveitamento: t.arremessos_tentados > 0 ? ((t.arremessos_convertidos / t.arremessos_tentados) * 100).toFixed(1).replace('.', ',') : '0,0',
        };
        setMedias(m);

        // 3. Obter Melhor Jogo da Carreira (Baseado no maior número de pontos)
        let melhor = hist[0];
        hist.forEach(h => {
          if ((h.pontos || 0) > (melhor.pontos || 0)) {
            melhor = h;
          } else if ((h.pontos || 0) === (melhor.pontos || 0)) {
            // Desempate por rebotes + assistências
            const somaAtu = (h.rebotes || 0) + (h.assistencias || 0);
            const somaMelhor = (melhor.rebotes || 0) + (melhor.assistencias || 0);
            if (somaAtu > somaMelhor) {
              melhor = h;
            }
          }
        });
        setMelhorJogo(melhor);
      } else {
        setTotais(null);
        setMedias(null);
        setMelhorJogo(null);
      }
    } catch (e) {
      console.error(e);
      showToast('Erro ao carregar estatísticas.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Lógica de incrementos e sincronização automática
  function ajustarCampo(campo, valor) {
    setForm(prev => {
      const updates = { ...prev };
      
      if (showAvancado) {
        if (campo === 'dois_pontos_convertidos') {
          const newVal = Math.max(0, prev.dois_pontos_convertidos + valor);
          const diff = newVal - prev.dois_pontos_convertidos;
          updates.dois_pontos_convertidos = newVal;
          updates.dois_pontos_tentados = Math.max(prev.dois_pontos_tentados + diff, newVal);
          updates.arremessos_convertidos = Math.max(0, prev.arremessos_convertidos + diff);
          updates.arremessos_tentados = Math.max(updates.arremessos_convertidos, prev.arremessos_tentados + diff);
          updates.pontos = Math.max(0, prev.pontos + diff * 2);
        } else if (campo === 'dois_pontos_tentados') {
          const newVal = Math.max(prev.dois_pontos_convertidos, prev.dois_pontos_tentados + valor);
          const diff = newVal - prev.dois_pontos_tentados;
          updates.dois_pontos_tentados = newVal;
          updates.arremessos_tentados = Math.max(prev.arremessos_convertidos, prev.arremessos_tentados + diff);
        } else if (campo === 'tres_pontos_convertidos') {
          const newVal = Math.max(0, prev.tres_pontos_convertidos + valor);
          const diff = newVal - prev.tres_pontos_convertidos;
          updates.tres_pontos_convertidos = newVal;
          updates.tres_pontos_tentados = Math.max(prev.tres_pontos_tentados + diff, newVal);
          updates.arremessos_convertidos = Math.max(0, prev.arremessos_convertidos + diff);
          updates.arremessos_tentados = Math.max(updates.arremessos_convertidos, prev.arremessos_tentados + diff);
          updates.pontos = Math.max(0, prev.pontos + diff * 3);
        } else if (campo === 'tres_pontos_tentados') {
          const newVal = Math.max(prev.tres_pontos_convertidos, prev.tres_pontos_tentados + valor);
          const diff = newVal - prev.tres_pontos_tentados;
          updates.tres_pontos_tentados = newVal;
          updates.arremessos_tentados = Math.max(prev.arremessos_convertidos, prev.arremessos_tentados + diff);
        } else if (campo === 'lance_livre_convertidos') {
          const newVal = Math.max(0, prev.lance_livre_convertidos + valor);
          const diff = newVal - prev.lance_livre_convertidos;
          updates.lance_livre_convertidos = newVal;
          updates.lance_livre_tentados = Math.max(prev.lance_livre_tentados + diff, newVal);
          updates.pontos = Math.max(0, prev.pontos + diff);
        } else if (campo === 'lance_livre_tentados') {
          updates.lance_livre_tentados = Math.max(prev.lance_livre_convertidos, prev.lance_livre_tentados + valor);
        } else {
          updates[campo] = Math.max(0, (prev[campo] || 0) + valor);
        }
      } else {
        if (campo === 'arremessos_convertidos') {
          const newVal = Math.max(0, prev.arremessos_convertidos + valor);
          const diff = newVal - prev.arremessos_convertidos;
          updates.arremessos_convertidos = newVal;
          updates.arremessos_tentados = Math.max(prev.arremessos_tentados, newVal);
          updates.pontos = Math.max(0, prev.pontos + diff * 2); // Assume +2 de pontos por padrão para facilidade
        } else if (campo === 'arremessos_tentados') {
          updates.arremessos_tentados = Math.max(prev.arremessos_convertidos, prev.arremessos_tentados + valor);
        } else {
          updates[campo] = Math.max(0, (prev[campo] || 0) + valor);
        }
      }

      return updates;
    });
  }

  async function handleSalvar() {
    const tentados = parseInt(form.arremessos_tentados) || 0;
    const convertidos = parseInt(form.arremessos_convertidos) || 0;
    
    if (convertidos > tentados) {
      showToast('Arremessos convertidos não podem superar os tentados.', 'error');
      return;
    }

    setSalvando(true);
    try {
      const payload = { ...form };
      if (!showAvancado) {
        // Limpar avançados caso não seja modo avançado
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
      loadStats();
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar partida.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(id) {
    if (!window.confirm('Deseja excluir esta partida permanentemente?')) return;
    try {
      const { error } = await estatisticasPessoaisAPI.excluir(id);
      if (error) throw error;
      showToast('Partida excluída!', 'success');
      loadStats();
    } catch (e) {
      console.error(e);
      showToast('Erro ao excluir partida.', 'error');
    }
  }

  const formatData = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const getPercent = (conv, tent) => {
    if (!tent || tent === 0) return '0,0%';
    return `${((conv / tent) * 100).toFixed(1).replace('.', ',')}%`;
  };

  return (
    <div className="page-content">
      <div style={{ padding: '20px 20px 0' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 20 }}>Minhas Estatísticas</h2>
              <p style={{ color: '#64748b', fontSize: 13 }}>Acompanhamento individual privado</p>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowRegistrar(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Registrar Partida
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab ${aba === 'resumo' ? 'active' : ''}`} onClick={() => setAba('resumo')}>Resumo</button>
          <button className={`tab ${aba === 'historico' ? 'active' : ''}`} onClick={() => setAba('historico')}>Histórico</button>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /> Carregando estatísticas...</div>
        ) : historico.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            <h3>Nenhuma partida registrada</h3>
            <p>Seus dados são privados e não afetam os rankings locais da cidade.</p>
            <button className="btn btn-primary" onClick={() => setShowRegistrar(true)} style={{ marginTop: 14 }}>
              Registrar Primeira Partida
            </button>
          </div>
        ) : (
          <>
            {aba === 'resumo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
                
                {/* Destaque Qtd Jogos */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)' }}>
                  <div style={{ fontSize: 28 }}>🏀</div>
                  <div>
                    <h3 style={{ fontSize: 20, fontWeight: 900 }}>{historico.length} Jogos</h3>
                    <p style={{ fontSize: 12, color: '#64748b' }}>Partidas registradas no histórico pessoal</p>
                  </div>
                </div>

                {/* Médias por Jogo */}
                <div>
                  <div className="section-title" style={{ marginBottom: 8 }}>Médias por Jogo</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { l: 'Pontos', v: medias?.pontos, c: '#f59e0b' },
                      { l: 'Rebotes', v: medias?.rebotes, c: '#60a5fa' },
                      { l: 'Assists', v: medias?.assistencias, c: '#10b981' },
                      { l: 'Roubos', v: medias?.roubos, c: '#818cf8' },
                      { l: 'Tocos', v: medias?.tocos, c: '#a78bfa' },
                      { l: 'Perdas', v: medias?.perdas, c: '#f87171' },
                    ].map(item => (
                      <div key={item.l} className="card" style={{ textAlign: 'center', padding: '12px 6px' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: item.c }}>{item.v}</div>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{item.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totais Acumulados */}
                <div className="card">
                  <div className="section-title" style={{ marginBottom: 12 }}>Totais Acumulados</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {[
                      { l: 'Pontos', v: totais?.pontos },
                      { l: 'Rebotes', v: totais?.rebotes },
                      { l: 'Assists', v: totais?.assistencias },
                      { l: 'Roubos', v: totais?.roubos },
                      { l: 'Tocos', v: totais?.tocos },
                      { l: 'Turnovers', v: totais?.perdas },
                    ].map(item => (
                      <div key={item.l}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{item.l}</div>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Aproveitamento de Arremessos */}
                <div className="card">
                  <div className="section-title" style={{ marginBottom: 12 }}>Aproveitamento de Arremessos</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Aproveitamento Geral</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: '#60a5fa' }}>{medias?.aproveitamento}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-fill blue bar-grow-fill" style={{ width: `${(totais?.arremessos_convertidos / (totais?.arremessos_tentados || 1)) * 100}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {totais?.arremessos_convertidos} convertidos / {totais?.arremessos_tentados} tentados
                  </div>

                  {/* Detalhados avançados se usados */}
                  {totais && (totais.lf_tentados > 0 || totais.dois_tentados > 0 || totais.tres_tentados > 0) && (
                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {totais.lf_tentados > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                            <span>Lances Livres</span>
                            <span style={{ fontWeight: 700 }}>{getPercent(totais.lf_convertidos, totais.lf_tentados)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{totais.lf_convertidos}/{totais.lf_tentados} convertidos</div>
                        </div>
                      )}
                      {totais.dois_tentados > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                            <span>Arremessos de 2 Pontos</span>
                            <span style={{ fontWeight: 700 }}>{getPercent(totais.dois_convertidos, totais.dois_tentados)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{totais.dois_convertidos}/{totais.dois_tentados} convertidos</div>
                        </div>
                      )}
                      {totais.tres_tentados > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                            <span>Arremessos de 3 Pontos</span>
                            <span style={{ fontWeight: 700 }}>{getPercent(totais.tres_convertidos, totais.tres_tentados)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{totais.tres_convertidos}/{totais.tres_tentados} convertidos</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Melhor Jogo da Carreira */}
                {melhorJogo && (
                  <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 20 }}>🏆</span>
                      <div>
                        <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.05em' }}>
                          MELHOR PARTIDA {melhorJogo.nome_jogador ? `(${melhorJogo.nome_jogador})` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Registrado em {formatData(melhorJogo.data_partida)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b' }}>{melhorJogo.pontos}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Pontos</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#60a5fa' }}>{melhorJogo.rebotes}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Rebotes</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{melhorJogo.assistencias}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Assists</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Últimos Jogos */}
                <div>
                  <div className="section-title" style={{ marginBottom: 10 }}>Últimos Jogos</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {historico.slice(0, 5).map(h => (
                      <div key={h.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16 }}>🏀</span>
                          <div>
                            {h.nome_jogador && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{h.nome_jogador}</div>}
                            <span style={{ fontWeight: 700, fontSize: 14 }}>
                              {h.pontos} pts | {h.rebotes} reb | {h.assistencias} ast
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{formatData(h.data_partida)}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {aba === 'historico' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
                {historico.map(h => (
                  <div key={h.id} className="card" style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingRight: 24 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{h.nome_jogador || 'Partida Pessoal'}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{formatData(h.data_partida)}</div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                      {[
                        ['PTS', h.pontos],
                        ['REB', h.rebotes],
                        ['AST', h.assistencias],
                        ['ARR', getPercent(h.arremessos_convertidos, h.arremessos_tentados)]
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#60a5fa' }}>{v}</div>
                          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{k}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, color: '#64748b', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                      <span>Roubos: {h.roubos_bola}</span> • 
                      <span>Tocos: {h.tocos}</span> • 
                      <span>Erros: {h.perdas_bola}</span>
                      {h.lance_livre_tentados > 0 && (
                        <> • <span>LL: {h.lance_livre_convertidos}/{h.lance_livre_tentados}</span></>
                      )}
                      {h.dois_pontos_tentados > 0 && (
                        <> • <span>2PT: {h.dois_pontos_convertidos}/{h.dois_pontos_tentados}</span></>
                      )}
                      {h.tres_pontos_tentados > 0 && (
                        <> • <span>3PT: {h.tres_pontos_convertidos}/{h.tres_pontos_tentados}</span></>
                      )}
                    </div>

                    {/* Botão de Excluir */}
                    <button
                      onClick={() => handleExcluir(h.id)}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Excluir partida"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>

      {/* Modal Registrar Partida (Contadores) */}
      {showRegistrar && (
        <div className="modal-overlay" onClick={() => { if (!salvando) setShowRegistrar(false); }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }}>🏀 Nova Partida</h3>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>Grave seus números. Esses dados são privados e não afetam os rankings.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome do Jogador</label>
                <input
                  type="text"
                  value={form.nome_jogador || ''}
                  onChange={e => setForm(p => ({ ...p, nome_jogador: e.target.value }))}
                  placeholder="Ex: Seu Nome, Apelido ou Adversário"
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

              {/* Botão toggle para estatísticas avançadas */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowAvancado(!showAvancado);
                  setForm(prev => ({
                    ...prev,
                    // Ao abrir ou fechar, inicializa os campos avançados
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
                {showAvancado ? '← Ocultar Estatísticas Avançadas' : '⚡ Mostrar Estatísticas Avançadas'}
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Seções de contadores */}
                {showAvancado ? (
                  <>
                    {/* Contadores Avançados */}
                    {[
                      { l: 'Lances Livres Convertidos', k: 'lance_livre_convertidos' },
                      { l: 'Lances Livres Tentados', k: 'lance_livre_tentados' },
                      { l: 'Arremessos de 2 Pts Convertidos', k: 'dois_pontos_convertidos' },
                      { l: 'Arremessos de 2 Pts Tentados', k: 'dois_pontos_tentados' },
                      { l: 'Arremessos de 3 Pts Convertidos', k: 'tres_pontos_convertidos' },
                      { l: 'Arremessos de 3 Pts Tentados', k: 'tres_pontos_tentados' },
                    ].map(item => (
                      <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{item.l}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button
                            type="button"
                            onClick={() => ajustarCampo(item.k, -1)}
                            className="btn btn-secondary"
                            style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 16, fontWeight: 700 }}
                          >
                            -
                          </button>
                          <span style={{ fontWeight: 800, fontSize: 14, minWidth: 20, textAlign: 'center' }}>{form[item.k]}</span>
                          <button
                            type="button"
                            onClick={() => ajustarCampo(item.k, 1)}
                            className="btn btn-secondary"
                            style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 16, fontWeight: 700 }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Visualização de calculados em avançado */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span>Pontos Calculados: <strong>{form.pontos}</strong></span>
                      <span>Arremessos de Quadra: <strong>{form.arremessos_convertidos}/{form.arremessos_tentados}</strong></span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Contadores Básicos */}
                    {[
                      { l: 'Pontos', k: 'pontos' },
                      { l: 'Arremessos Convertidos', k: 'arremessos_convertidos' },
                      { l: 'Arremessos Tentados', k: 'arremessos_tentados' },
                    ].map(item => (
                      <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{item.l}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button
                            type="button"
                            onClick={() => ajustarCampo(item.k, -1)}
                            className="btn btn-secondary"
                            style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 18, fontWeight: 700 }}
                          >
                            -
                          </button>
                          <span style={{ fontWeight: 800, fontSize: 15, minWidth: 24, textAlign: 'center' }}>{form[item.k]}</span>
                          <button
                            type="button"
                            onClick={() => ajustarCampo(item.k, 1)}
                            className="btn btn-secondary"
                            style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 18, fontWeight: 700 }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Fundamentos Comuns */}
                {[
                  { l: 'Rebotes', k: 'rebotes' },
                  { l: 'Assistências', k: 'assistencias' },
                  { l: 'Roubos de Bola', k: 'roubos_bola' },
                  { l: 'Tocos', k: 'tocos' },
                  { l: 'Perdas de Bola', k: 'perdas_bola' },
                ].map(item => (
                  <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{item.l}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => ajustarCampo(item.k, -1)}
                        className="btn btn-secondary"
                        style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 18, fontWeight: 700 }}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 800, fontSize: 15, minWidth: 24, textAlign: 'center' }}>{form[item.k]}</span>
                      <button
                        type="button"
                        onClick={() => ajustarCampo(item.k, 1)}
                        className="btn btn-secondary"
                        style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 18, fontWeight: 700 }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowRegistrar(false)} style={{ flex: 1 }} disabled={salvando}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando} style={{ flex: 2 }}>
                {salvando ? <><div className="spinner" /> Salvando...</> : 'Salvar Partida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
