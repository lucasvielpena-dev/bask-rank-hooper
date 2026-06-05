import { useState, useEffect } from 'react';
import { jogadoresAPI } from '../lib/supabase';

export default function Jogadores({ initialOpenAdd = false }) {
  const [jogadores, setJogadores] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(initialOpenAdd);
  const [novoJogador, setNovoJogador] = useState({ nome: '', apelido: '', posicao: '' });
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadJogadores(); }, []);
  useEffect(() => { if (initialOpenAdd) setShowAdd(true); }, [initialOpenAdd]);

  useEffect(() => {
    if (busca.trim() === '') {
      setFiltrados(jogadores);
    } else {
      setFiltrados(jogadores.filter(j =>
        j.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (j.apelido || '').toLowerCase().includes(busca.toLowerCase())
      ));
    }
  }, [busca, jogadores]);

  async function loadJogadores() {
    setLoading(true);
    const { data } = await jogadoresAPI.listar();
    setJogadores(data || []);
    setFiltrados(data || []);
    setLoading(false);
  }

  async function handleAdicionarJogador() {
    if (!novoJogador.nome.trim()) {
      showToast('Digite o nome do jogador', 'error');
      return;
    }
    setSalvando(true);
    const { error } = await jogadoresAPI.adicionar(novoJogador);
    if (error) {
      showToast(error.message || 'Erro ao adicionar jogador', 'error');
    } else {
      showToast('Jogador adicionado com sucesso!', 'success');
      setShowAdd(false);
      setNovoJogador({ nome: '', apelido: '', posicao: '' });
      loadJogadores();
    }
    setSalvando(false);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const getInitial = (nome) => nome ? nome.charAt(0).toUpperCase() : '?';

  const posicoes = ['Armador', 'Ala-armador', 'Ala', 'Ala-pivô', 'Pivô'];

  return (
    <div className="page-content">
      <div style={{ padding: '20px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 20 }}>Jogadores</h2>
              <p style={{ color: '#64748b', fontSize: 13 }}>{jogadores.length} cadastrados</p>
            </div>
          </div>

        </div>

        {/* Busca */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar jogador..."
            style={{ paddingLeft: 40 }}
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="loading"><div className="spinner" />Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <h3>Nenhum jogador encontrado</h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 20 }}>
            {filtrados.map(j => (
              <div key={j.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar" style={{ position: 'relative' }}>
                  {getInitial(j.nome)}
                  {j.atual_campeao && (
                    <div style={{ position: 'absolute', top: -6, right: -6, fontSize: 14 }}>👑</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{j.nome}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {j.apelido && <span style={{ marginRight: 8 }}>"{j.apelido}"</span>}
                    {j.posicao && <span>{j.posicao}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {j.total_votos >= 5 ? (
                    <>
                      <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 14 }}>★ {Number(j.media_estrelas).toFixed(1)}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{j.total_votos} votos</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: '#475569' }}>
                      {j.total_votos}/5 votos
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Adicionar */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Adicionar Jogador</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Cadastre um novo jogador no ranking</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome completo *</label>
                <input
                  value={novoJogador.nome}
                  onChange={e => setNovoJogador(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Felipe Santos"
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Apelido</label>
                <input
                  value={novoJogador.apelido}
                  onChange={e => setNovoJogador(p => ({ ...p, apelido: e.target.value }))}
                  placeholder="Ex: dd, viel..."
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Posição</label>
                <select
                  value={novoJogador.posicao}
                  onChange={e => setNovoJogador(p => ({ ...p, posicao: e.target.value }))}
                  style={{ background: '#242938', color: novoJogador.posicao ? '#f1f5f9' : '#64748b' }}
                >
                  <option value="">Selecionar posição...</option>
                  {posicoes.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAdicionarJogador} disabled={salvando} style={{ flex: 2 }}>
                {salvando ? <><div className="spinner" /> Salvando...</> : <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  Adicionar
                </>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
