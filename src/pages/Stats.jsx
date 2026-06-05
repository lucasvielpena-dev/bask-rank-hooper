import { useState, useEffect } from 'react';
import { statsAPI, jogadoresAPI } from '../lib/supabase';
import { supabase } from '../lib/supabase';

function CircleProgress({ value, max = 100, size = 90, color = '#60a5fa' }) {
  const r = 35;
  const circum = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const dash = pct * circum;

  return (
    <div className="stat-circle" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circum}`} strokeLinecap="round"/>
      </svg>
      <div className="stat-circle-value">
        <span>{value}</span>
        <small>/ {max}</small>
      </div>
    </div>
  );
}

export default function Stats() {
  const [aba, setAba] = useState('resumo');
  const [stats, setStats] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [jogadores, setJogadores] = useState([]);
  const [form, setForm] = useState({ jogador_id: '', pontos: '', rebotes: '', assistencias: '', arremessos_tentados: '', arremessos_convertidos: '' });
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);
  const [mediaGeral, setMediaGeral] = useState(null);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) { setLoading(false); return; }

      // Buscar player_id do usuário
      const { data: profile } = await supabase.from('profiles').select('player_id').eq('id', user.id).single();
      const playerId = profile?.player_id;

      if (playerId) {
        const { data: hist } = await statsAPI.getMinhas(playerId);
        setHistorico(hist || []);
        // Calcular resumo
        if (hist && hist.length > 0) {
          const totals = hist.reduce((acc, h) => ({
            pontos: acc.pontos + (h.pontos || 0),
            rebotes: acc.rebotes + (h.rebotes || 0),
            assistencias: acc.assistencias + (h.assistencias || 0),
            tentados: acc.tentados + (h.arremessos_tentados || 0),
            convertidos: acc.convertidos + (h.arremessos_convertidos || 0),
          }), { pontos: 0, rebotes: 0, assistencias: 0, tentados: 0, convertidos: 0 });

          const partidas = hist.length;
          const pct = totals.tentados > 0 ? Math.round((totals.convertidos / totals.tentados) * 100) : 0;
          const indice = Math.min(100, Math.round((totals.pontos / partidas) * 2 + (totals.rebotes / partidas) + (totals.assistencias / partidas)));

          setStats({ ...totals, partidas, pct_arremessos: pct, indice });
        }
      }

      // Média geral de todos os jogadores
      const { data: todos } = await supabase
        .from('estatisticas_partida')
        .select('pontos, arremessos_tentados, arremessos_convertidos');
      if (todos && todos.length > 0) {
        const pct = todos.reduce((a, b) => {
          const t = b.arremessos_tentados || 0;
          const c = b.arremessos_convertidos || 0;
          return { t: a.t + t, c: a.c + c };
        }, { t: 0, c: 0 });
        setMediaGeral({
          pct_arremessos: pct.t > 0 ? Math.round((pct.c / pct.t) * 100) : 0,
          jogadores: new Set(todos.map(t => t.jogador_id)).size,
        });
      }

      const { data: jogs } = await jogadoresAPI.listar();
      setJogadores(jogs || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function handleRegistrar() {
    if (!form.jogador_id) { showToast('Selecione um jogador', 'error'); return; }
    setSalvando(true);
    const { error } = await statsAPI.registrar({
      jogador_id: form.jogador_id,
      pontos: parseInt(form.pontos) || 0,
      rebotes: parseInt(form.rebotes) || 0,
      assistencias: parseInt(form.assistencias) || 0,
      arremessos_tentados: parseInt(form.arremessos_tentados) || 0,
      arremessos_convertidos: parseInt(form.arremessos_convertidos) || 0,
    });
    if (error) { showToast(error.message, 'error'); }
    else {
      showToast('Partida registrada!', 'success');
      setShowRegistrar(false);
      setForm({ jogador_id: '', pontos: '', rebotes: '', assistencias: '', arremessos_tentados: '', arremessos_convertidos: '' });
      loadStats();
    }
    setSalvando(false);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  if (loading) return (
    <div className="page-content"><div className="loading"><div className="spinner" />Carregando stats...</div></div>
  );

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
              <h2 style={{ fontWeight: 800, fontSize: 20 }}>Desempenho</h2>
              <p style={{ color: '#64748b', fontSize: 13 }}>Estatísticas individuais</p>
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

        {aba === 'resumo' && (
          <>
            {/* Índice */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>MEU ÍNDICE</div>
                <CircleProgress value={stats?.indice || 37} color="#f87171" />
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>MÉDIA GERAL</div>
                <CircleProgress value={37} color="#f87171" />
                <div style={{ fontSize: 11, color: '#64748b' }}>{mediaGeral?.jogadores || 1} jogador</div>
              </div>
            </div>

            {/* Arremessos */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                Aproveitamento de Arremessos
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>INDIVIDUAL</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#60a5fa' }}>{stats?.pct_arremessos ?? 82}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>MÉDIA GERAL</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#60a5fa' }}>{mediaGeral?.pct_arremessos ?? 82}%</div>
                </div>
              </div>
              {stats && (
                <>
                  <div className="progress-bar" style={{ marginTop: 12 }}>
                    <div className="progress-fill blue" style={{ width: `${stats.pct_arremessos}%` }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                    {stats.convertidos} convertidos / {stats.tentados} tentados
                  </div>
                </>
              )}
            </div>

            {/* Stats em grid */}
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Pontos', value: stats.pontos, icon: '🏀' },
                  { label: 'Rebotes', value: stats.rebotes, icon: '↕️' },
                  { label: 'Assistências', value: stats.assistencias, icon: '🎯' },
                  { label: 'Partidas', value: stats.partidas, icon: '📋' },
                ].map(s => (
                  <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#60a5fa' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.05em' }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {aba === 'historico' && (
          <>
            {historico.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                <h3>Nenhuma partida registrada</h3>
                <p>Registre suas estatísticas de jogo</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 20 }}>
                {historico.map(h => (
                  <div key={h.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700 }}>{h.jogos?.titulo || 'Partida'}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {h.jogos?.data ? new Date(h.jogos.data).toLocaleDateString('pt-BR') : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {[['PTS', h.pontos], ['REB', h.rebotes], ['AST', h.assistencias]].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{v}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{k}</div>
                        </div>
                      ))}
                      {h.arremessos_tentados > 0 && (
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{Math.round((h.arremessos_convertidos / h.arremessos_tentados) * 100)}%</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>ARR</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Registrar Partida */}
      {showRegistrar && (
        <div className="modal-overlay" onClick={() => setShowRegistrar(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 20 }}>Registrar Partida</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Jogador *</label>
                <select value={form.jogador_id} onChange={e => setForm(p => ({ ...p, jogador_id: e.target.value }))} style={{ background: '#242938', color: form.jogador_id ? '#f1f5f9' : '#64748b' }}>
                  <option value="">Selecionar jogador...</option>
                  {jogadores.map(j => <option key={j.id} value={j.id}>{j.nome}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['pontos', 'Pontos'], ['rebotes', 'Rebotes'], ['assistencias', 'Assistências'], ['arremessos_tentados', 'Tentados'], ['arremessos_convertidos', 'Convertidos']].map(([k, l]) => (
                  <div key={k}>
                    <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>{l}</label>
                    <input type="number" min="0" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowRegistrar(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleRegistrar} disabled={salvando} style={{ flex: 2 }}>
                {salvando ? <><div className="spinner" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
