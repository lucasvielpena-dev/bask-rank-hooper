import { useState, useEffect } from 'react';
import { jogosAPI } from '../lib/supabase';

export default function Jogos() {
  const [aba, setAba] = useState('jogos');
  const [jogos, setJogos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNovo, setShowNovo] = useState(false);
  const [novoJogo, setNovoJogo] = useState({ titulo: '', data: new Date().toISOString().split('T')[0] });
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { 
    loadJogos(); 
  }, []);

  async function loadJogos() {
    setLoading(true);
    const { data } = await jogosAPI.listar();
    const todos = data || [];
    setJogos(todos.filter(j => j.status === 'ativo'));
    setHistorico(todos.filter(j => j.status !== 'ativo'));
    setLoading(false);
  }

  async function handleCriarJogo() {
    if (!novoJogo.titulo?.trim()) {
      showToast('Digite um título para o jogo', 'error');
      return;
    }
    setSalvando(true);
    const { error } = await jogosAPI.criar({ ...novoJogo, status: 'ativo', times: [], placar: {} });
    if (error) {
      showToast(error.message || 'Erro ao criar jogo', 'error');
    } else {
      showToast('Jogo criado com sucesso!', 'success');
      setShowNovo(false);
      setNovoJogo({ titulo: '', data: new Date().toISOString().split('T')[0] });
      loadJogos();
    }
    setSalvando(false);
  }

  async function handleFinalizarJogo(id) {
    const { error } = await jogosAPI.atualizar(id, { status: 'finalizado' });
    if (!error) {
      showToast('Jogo finalizado!', 'success');
      loadJogos();
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };



  return (
    <div className="page-content">
      <div style={{ padding: '20px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(99,102,241,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </div>
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 20 }}>Jogos da Noite</h2>
              <p style={{ color: '#64748b', fontSize: 13 }}>Resultados e histórico</p>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNovo(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Jogo
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab ${aba === 'jogos' ? 'active' : ''}`} onClick={() => setAba('jogos')}>
            Jogos
          </button>
          <button className={`tab ${aba === 'historico' ? 'active' : ''}`} onClick={() => setAba('historico')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
            Histórico
            {historico.length > 0 && (
              <span style={{ background: '#3b82f6', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{historico.length}</span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" />Carregando...</div>
        ) : aba === 'jogos' ? (
          <>
            {jogos.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                <h3>Nenhum jogo ativo</h3>
                <p>Crie um novo jogo da noite!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 20 }}>
                {jogos.map(j => (
                  <div key={j.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{j.titulo || 'Jogo da Noite'}</div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>{formatDate(j.data)}</div>
                      </div>
                      <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>ATIVO</span>
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 13, padding: '10px 16px' }}
                      onClick={() => handleFinalizarJogo(j.id)}
                    >
                      Finalizar Jogo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {historico.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
                <h3>Nenhum jogo no histórico</h3>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 20 }}>
                {historico.map(j => (
                  <div key={j.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{j.titulo || 'Jogo da Noite'}</div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{formatDate(j.data)}</div>
                      </div>
                      <span style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8', padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>FINALIZADO</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Novo Jogo */}
      {showNovo && (
        <div className="modal-overlay" onClick={() => setShowNovo(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Novo Jogo</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Registre um jogo da noite</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Título *</label>
                <input
                  value={novoJogo.titulo}
                  onChange={e => setNovoJogo(p => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Jogo de quarta-feira"
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Data</label>
                <input
                  type="date"
                  value={novoJogo.data}
                  onChange={e => setNovoJogo(p => ({ ...p, data: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowNovo(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCriarJogo} disabled={salvando} style={{ flex: 2 }}>
                {salvando ? <><div className="spinner" /> Criando...</> : 'Criar Jogo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
