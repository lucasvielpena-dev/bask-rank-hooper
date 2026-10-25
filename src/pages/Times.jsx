import { useCallback, useEffect, useState } from 'react';
import { timesAPI, supabase } from '../lib/supabase';

export default function Times({ profile, onNavigate }) {
  const cidade = timesAPI.cidadeDoProfile(profile);
  const [times, setTimes] = useState([]);
  const [meuTime, setMeuTime] = useState(null);
  const [convites, setConvites] = useState([]);
  const [amistosos, setAmistosos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [toast, setToast] = useState(null);

  const [showCriar, setShowCriar] = useState(false);
  const [nomeTime, setNomeTime] = useState('');
  const [descTime, setDescTime] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [detalhe, setDetalhe] = useState(null); // time selecionado
  const [membros, setMembros] = useState([]);
  const [showConvidar, setShowConvidar] = useState(false);
  const [buscaAtleta, setBuscaAtleta] = useState('');
  const [candidatos, setCandidatos] = useState([]);

  const [showDesafio, setShowDesafio] = useState(null); // time alvo
  const [localAm, setLocalAm] = useState('');
  const [dataAm, setDataAm] = useState('');
  const [horaAm, setHoraAm] = useState('19:00');

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const carregar = useCallback(async () => {
    if (!cidade) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const [tRes, mRes, cRes, aRes] = await Promise.all([
        timesAPI.listarPorCidade(cidade, esporte || 'basquete'),
        timesAPI.meuTimeNaCidade(cidade),
        timesAPI.meusConvitesPendentes(),
        timesAPI.listarAmistososCidade(cidade),
      ]);
      if (tRes.error) throw tRes.error;
      setTimes(tRes.data || []);
      setMeuTime(mRes.data || null);
      setConvites(cRes.data || []);
      setAmistosos(aRes.data || []);
    } catch (e) {
      setErro(e.message || 'Falha ao carregar times');
    } finally {
      setLoading(false);
    }
  }, [cidade]);

  useEffect(() => { carregar(); }, [carregar]);

  async function abrirDetalhe(t) {
    setDetalhe(t);
    const { data } = await timesAPI.listarMembros(t.id);
    setMembros(data || []);
  }

  async function handleCriar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const { error } = await timesAPI.criar({
        nome: nomeTime,
        cidade,
        uf: profile?.uf || 'PA',
        descricao: descTime,
        esporte: esporte || 'basquete',
      });
      if (error) throw error;
      setShowCriar(false);
      setNomeTime('');
      setDescTime('');
      showToast('Time criado');
      await carregar();
    } catch (err) {
      showToast(err.message || 'Erro ao criar', 'err');
    } finally {
      setSalvando(false);
    }
  }

  async function handleConvite(id, aceitar) {
    const { error } = await timesAPI.responderConvite(id, aceitar);
    if (error) showToast(error.message, 'err');
    else {
      showToast(aceitar ? 'Você entrou no time' : 'Convite recusado');
      await carregar();
    }
  }

  async function buscarCandidatos() {
    const q = buscaAtleta.trim();
    if (q.length < 2) {
      setCandidatos([]);
      showToast('Digite pelo menos 2 letras', 'err');
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nome_completo, apelido, foto_perfil, cidade_atual, cidade')
      .or(`nome_completo.ilike.%${q}%,apelido.ilike.%${q}%`)
      .limit(40);
    if (error) {
      showToast(error.message || 'Erro na busca', 'err');
      return;
    }
    const cNorm = (cidade || '').toLowerCase().trim();
    const idsMembros = new Set(membros.map((m) => m.usuario_id).filter(Boolean));
    // Filtro mais flexível: aceita se a cidade contém ou está vazia
    const filtrados = (data || []).filter((p) => {
      if (p.id === profile?.id || idsMembros.has(p.id)) return false;
      if (!cNorm) return true;
      const pc = (p.cidade_atual || p.cidade || '').toLowerCase().trim();
      // Aceita se cidade vazia, ou se uma contém a outra (sem acento rigoroso)
      if (!pc) return true;
      const n1 = pc.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const n2 = cNorm.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n1.includes(n2) || n2.includes(n1);
    });
    setCandidatos(filtrados);
    if (filtrados.length === 0) {
      showToast(
        (data || []).length
          ? 'Nenhum atleta da sua cidade com esse nome. Tente outro termo.'
          : 'Nenhum atleta encontrado',
        'err'
      );
    }
  }

  async function enviarConvite(uid) {
    if (!detalhe) return;
    const { error } = await timesAPI.convidar(detalhe.id, uid);
    if (error) showToast(error.message, 'err');
    else {
      showToast('Convite enviado');
      setShowConvidar(false);
      setBuscaAtleta('');
      setCandidatos([]);
    }
  }

  async function enviarDesafio(e) {
    e.preventDefault();
    if (!meuTime || !showDesafio) return;
    setSalvando(true);
    try {
      let dataHora = null;
      if (dataAm) {
        dataHora = new Date(`${dataAm}T${horaAm || '19:00'}:00`).toISOString();
      }
      const { error } = await timesAPI.desafiar({
        timeAId: meuTime.id,
        timeBId: showDesafio.id,
        cidade,
        local: localAm,
        dataHora,
      });
      if (error) throw error;
      showToast('Desafio enviado');
      setShowDesafio(null);
      setLocalAm('');
      await carregar();
    } catch (err) {
      showToast(err.message || 'Erro', 'err');
    } finally {
      setSalvando(false);
    }
  }

  async function responderAm(id, aceitar) {
    const { error } = await timesAPI.responderAmistoso(id, aceitar);
    if (error) showToast(error.message, 'err');
    else {
      showToast(aceitar ? 'Amistoso aceito' : 'Desafio recusado');
      await carregar();
    }
  }

  const souCapitao = meuTime && profile?.id === meuTime.capitao_id;

  return (
    <div className="page-content">
      <div className="home-container" style={{ paddingBottom: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 900 }}>TIMES</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              {cidade || 'Defina sua cidade'} · entrada só por convite
            </p>
          </div>
          {!meuTime && cidade && (
            <button type="button" className="btn btn-primary btn-sm" style={{ width: 'auto', borderRadius: 50 }} onClick={() => setShowCriar(true)}>
              + Criar time
            </button>
          )}
        </div>

        {!cidade && (
          <div className="card" style={{ marginBottom: 12 }}>
            Complete o perfil com sua cidade para ver os times locais.
          </div>
        )}

        {erro && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{erro}</div>}

        {/* Convites para mim */}
        {convites.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-label">Seus convites</div>
            <div className="stack-cards">
              {convites.map((c) => (
                <div key={c.id} className="card">
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{c.time?.nome || 'Time'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Convite para entrar no elenco
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleConvite(c.id, false)}>Recusar</button>
                    <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleConvite(c.id, true)}>Aceitar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {meuTime && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent-line)' }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Seu time</div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{meuTime.nome}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {souCapitao ? 'Você é o capitão' : 'Você é membro'}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={() => abrirDetalhe(meuTime)}>
              Ver elenco
            </button>
          </div>
        )}

        <div className="section-label">Times em {cidade || '—'}</div>
        {loading ? (
          <div className="stack-cards">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 14 }} />)}
          </div>
        ) : times.length === 0 ? (
          <div className="card" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Nenhum time cadastrado nesta cidade ainda.
          </div>
        ) : (
          <div className="stack-cards">
            {times.map((t) => (
              <div key={t.id} className="card" style={{ cursor: 'pointer' }} onClick={() => abrirDetalhe(t)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{t.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Capitão: {t.capitao?.apelido || t.capitao?.nome_completo?.split(' ')[0] || '—'}
                    </div>
                  </div>
                  {souCapitao && meuTime?.id !== t.id && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ width: 'auto' }}
                      onClick={(e) => { e.stopPropagation(); setShowDesafio(t); }}
                    >
                      Desafiar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="section-label" style={{ marginTop: 16 }}>Amistosos</div>
        {amistosos.length === 0 ? (
          <div className="card" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Nenhum amistoso marcado ainda.
          </div>
        ) : (
          <div className="stack-cards">
            {amistosos.map((a) => {
              const souB = profile?.id && meuTime && a.time_b_id === meuTime.id && meuTime.capitao_id === profile.id;
              return (
                <div key={a.id} className="card">
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {a.time_a?.nome || 'Time A'} × {a.time_b?.nome || 'Time B'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {a.status}{a.local_quadra ? ` · ${a.local_quadra}` : ''}
                    {a.data_hora ? ` · ${new Date(a.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </div>
                  {a.status === 'pendente' && souB && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => responderAm(a.id, false)}>Recusar</button>
                      <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => responderAm(a.id, true)}>Aceitar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {onNavigate && (
          <button type="button" className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => onNavigate('jogos')}>
            Voltar a Competições
          </button>
        )}
      </div>

      {/* Modal criar */}
      {showCriar && (
        <div className="modal-overlay" onClick={() => setShowCriar(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 900, marginBottom: 8 }}>Novo time</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Time fechado de {cidade}. Só entram atletas convidados por você.
            </p>
            <form onSubmit={handleCriar} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input required placeholder="Nome do time" value={nomeTime} onChange={(e) => setNomeTime(e.target.value)} />
              <textarea rows={2} placeholder="Descrição (opcional)" value={descTime} onChange={(e) => setDescTime(e.target.value)} style={{ resize: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCriar(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={salvando}>{salvando ? '…' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detalhe */}
      {detalhe && (
        <div className="modal-overlay" onClick={() => setDetalhe(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 900, marginBottom: 4 }}>{detalhe.nome}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Elenco · só por convite</p>
            <div className="stack-cards" style={{ marginBottom: 12 }}>
              {membros.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-elevated)', overflow: 'hidden', flexShrink: 0 }}>
                    {m.perfil?.foto_perfil ? (
                      <img src={m.perfil.foto_perfil} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {m.perfil?.apelido || m.perfil?.nome_completo || 'Atleta'}
                    {detalhe.capitao_id === m.usuario_id && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)' }}>capitão</span>
                    )}
                  </div>
                </div>
              ))}
              {membros.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nenhum membro ainda.</div>}
            </div>
            {profile?.id === detalhe.capitao_id && (
              <button type="button" className="btn btn-primary" style={{ marginBottom: 8 }} onClick={() => setShowConvidar(true)}>
                Convidar atleta
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setDetalhe(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Convidar */}
      {showConvidar && detalhe && (
        <div className="modal-overlay" onClick={() => setShowConvidar(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 900, marginBottom: 8 }}>Convidar</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Só atletas da mesma cidade.</p>
            <input
              placeholder="Buscar nome…"
              value={buscaAtleta}
              onChange={(e) => setBuscaAtleta(e.target.value)}
              onKeyUp={(e) => e.key === 'Enter' && buscarCandidatos()}
            />
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8, marginBottom: 12 }} onClick={buscarCandidatos}>
              Buscar
            </button>
            <div className="stack-cards">
              {candidatos.map((p) => (
                <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{p.apelido || p.nome_completo}</span>
                  <button type="button" className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={() => enviarConvite(p.id)}>
                    Convidar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Desafio */}
      {showDesafio && (
        <div className="modal-overlay" onClick={() => setShowDesafio(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 900, marginBottom: 4 }}>Desafiar {showDesafio.nome}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Amistoso entre times da cidade.</p>
            <form onSubmit={enviarDesafio} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input placeholder="Local / quadra" value={localAm} onChange={(e) => setLocalAm(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input type="date" value={dataAm} onChange={(e) => setDataAm(e.target.value)} />
                <input type="time" value={horaAm} onChange={(e) => setHoraAm(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDesafio(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={salvando}>{salvando ? '…' : 'Enviar desafio'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type === 'err' ? 'error' : ''}`} style={{ zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
