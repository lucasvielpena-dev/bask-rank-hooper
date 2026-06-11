import { useState, useEffect, memo } from 'react';
import { supabase, denunciasAPI, votacaoAPI } from '../lib/supabase';

const fundamentos = [
  { key: 'arremesso', label: 'Arremesso' },
  { key: 'controle_de_bola', label: 'Controle de Bola' },
  { key: 'defesa', label: 'Defesa' },
  { key: 'visao_de_jogo', label: 'Vis\u00e3o de Jogo' },
  { key: 'explosao_fisica', label: 'Explos\u00e3o F\u00edsica' }
];

const labelsNota = ['', 'Muito Fraco', 'Fraco', 'Regular', 'Bom', 'Excelente'];

const StarPicker = memo(function StarPicker({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => !disabled && onChange(i)}
          onMouseEnter={() => !disabled && setHover(i)}
          onMouseLeave={() => !disabled && setHover(0)}
          disabled={disabled}
          style={{
            background: 'none', border: 'none',
            cursor: disabled ? 'default' : 'pointer', padding: '4px',
            transition: 'transform 0.1s',
            transform: (hover || value) >= i ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill={(hover || value) >= i ? '#F97316' : 'none'} stroke={(hover || value) >= i ? '#F97316' : '#64748B'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
});

export default function PlayerProfileModal({ jogador, rank, onClose }) {
  const [localJogador, setLocalJogador] = useState(jogador);
  const [profileData, setProfileData] = useState(null);
  const [communityStats, setCommunityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [perfilTab, setPerfilTab] = useState('sobre');
  const [historicoJogos, setHistoricoJogos] = useState([]);

  const [showDenunciar, setShowDenunciar] = useState(false);
  const [tipoDenuncia, setTipoDenuncia] = useState('perfil_falso');
  const [descricao, setDescricao] = useState('');
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);
  const [toast, setToast] = useState(null);

  const [minhaId, setMinhaId] = useState(null);
  const [showAvaliar, setShowAvaliar] = useState(false);
  const [estrelas, setEstrelas] = useState({ arremesso: 0, defesa: 0, controle_de_bola: 0, explosao_fisica: 0, visao_de_jogo: 0 });
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [jaAvaliou, setJaAvaliou] = useState(false);

  useEffect(() => {
    loadPlayerDetails();
  }, [jogador?.id]);

  useEffect(() => {
    window.history.pushState({ modalOpen: 'profile' }, '');
    const handlePopState = () => onClose();
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.modalOpen === 'profile') window.history.back();
    };
  }, [onClose]);

  useEffect(() => {
    const channel = supabase
      .channel(`modal-realtime-${jogador.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jogadores', filter: `id=eq.${jogador.id}` }, (payload) => setLocalJogador(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jogador.id]);

  async function loadPlayerDetails() {
    setLoading(true);
    try {
      const { data: prof } = await supabase.from('profiles').select('altura, idade, id').eq('player_id', jogador.id).maybeSingle();
      if (prof) setProfileData(prof);

      const { data: myMatches } = await supabase.from('partida_jogadores').select('time, partida:partidas(*)').eq('jogador_id', jogador.id);

      let totalGames = 0, wins = 0, losses = 0, winRate = 0;
      const historyList = [];

      if (myMatches) {
        const finishedMatches = myMatches.filter(m => m.partida?.status === 'finalizado');
        finishedMatches.forEach(m => {
          const p = m.partida;
          const myTeam = m.time;
          const scoreMyTeam = myTeam === 'A' ? p.placar_time_a : p.placar_time_b;
          const scoreOpponent = myTeam === 'A' ? p.placar_time_b : p.placar_time_a;
          const won = scoreMyTeam > scoreOpponent;
          if (won) wins++; else losses++;
          historyList.push({ id: p.id, data: p.created_at, timeA: p.time_a, timeB: p.time_b, placarA: p.placar_time_a, placarB: p.placar_time_b, vencedor: won ? 'Ganhou' : 'Perdeu' });
        });
        totalGames = finishedMatches.length;
        winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        setHistoricoJogos(historyList);
      }

      const { data: myStats } = await supabase.from('estatisticas_partida').select('pontos, rebotes, assistencias, tocos, roubos_bola').eq('jogador_id', jogador.id);

      let totalPoints = 0, totalRebounds = 0, totalAssists = 0, totalSteals = 0, totalBlocks = 0;
      if (myStats) {
        myStats.forEach(s => {
          totalPoints += s.pontos || 0;
          totalRebounds += s.rebotes || 0;
          totalAssists += s.assistencias || 0;
          totalSteals += s.roubos_bola || 0;
          totalBlocks += s.tocos || 0;
        });
      }

      setCommunityStats({ games: totalGames, wins, losses, winRate, points: totalPoints, rebounds: totalRebounds, assists: totalAssists, steals: totalSteals, blocks: totalBlocks });

      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        setMinhaId(user.id);
        const { data: av } = await supabase.from('avaliacoes').select('*').eq('avaliador_id', user.id).eq('jogador_id', jogador.id).maybeSingle();
        if (av) {
          setEstrelas({ arremesso: av.arremesso, defesa: av.defesa, controle_de_bola: av.controle_de_bola, explosao_fisica: av.explosao_fisica, visao_de_jogo: av.visao_de_jogo });
          setJaAvaliou(true);
        }
      }
    } catch (e) {
      console.error('Erro ao buscar detalhes do jogador:', e);
    }
    setLoading(false);
  }

  async function handleEnviarDenuncia(e) {
    e.preventDefault();
    if (!descricao.trim()) { showToast('Por favor, descreva o motivo da den\u00fancia.', 'error'); return; }
    setEnviandoDenuncia(true);
    const { error } = await denunciasAPI.criar({ jogador_id: jogador.id, tipo: tipoDenuncia, descricao: descricao.trim() });
    if (error) { showToast(error.message || 'Erro ao registrar den\u00fancia.', 'error'); }
    else { showToast('\u2713 Den\u00fancia enviada para an\u00e1lise!', 'success'); setTimeout(() => { setShowDenunciar(false); setDescricao(''); }, 1500); }
    setEnviandoDenuncia(false);
  }

  async function handleConfirmarAvaliacao() {
    if (fundamentos.some(f => !estrelas[f.key])) { showToast('Selecione uma nota para todos os 5 fundamentos', 'error'); return; }
    setEnviandoAvaliacao(true);
    const { data, error } = await votacaoAPI.votar(jogador.id, estrelas);
    if (error || !data?.sucesso) { showToast(data?.erro || error?.message || 'Erro ao registrar avalia\u00e7\u00e3o', 'error'); }
    else {
      showToast(`\u2713 Avalia\u00e7\u00e3o registrada! M\u00e9dia: \u2605 ${Number(data.media_estrelas).toFixed(1)}`, 'success');
      setJaAvaliou(true); setShowAvaliar(false);
      const { data: updatedJ } = await supabase.from('jogadores').select('*').eq('id', jogador.id).single();
      if (updatedJ) setLocalJogador(updatedJ);
    }
    setEnviandoAvaliacao(false);
  }

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  const isMe = minhaId && (minhaId === localJogador.criado_por || (profileData && minhaId === profileData.id));
  const totalGamesNum = communityStats?.games || 0;
  const ppj = totalGamesNum > 0 ? (communityStats.points / totalGamesNum).toFixed(1) : '0.0';
  const reb = totalGamesNum > 0 ? (communityStats.rebounds / totalGamesNum).toFixed(1) : '0.0';
  const ast = totalGamesNum > 0 ? (communityStats.assists / totalGamesNum).toFixed(1) : '0.0';
  const stl = totalGamesNum > 0 ? (communityStats.steals / totalGamesNum).toFixed(1) : '0.0';
  const blk = totalGamesNum > 0 ? (communityStats.blocks / totalGamesNum).toFixed(1) : '0.0';

  const starsVal = localJogador.media_estrelas || 0;
  let evolutionIndex = 0;
  if (starsVal >= 4.5) evolutionIndex = 3;
  else if (starsVal >= 4.0) evolutionIndex = 2;
  else if (starsVal >= 3.0) evolutionIndex = 1;

  const hasAnyGameStats = communityStats && (communityStats.points > 0 || communityStats.rebounds > 0 || communityStats.assists > 0 || communityStats.steals > 0 || communityStats.blocks > 0);

  const gameStats = [
    { label: 'PPJ', val: ppj, show: communityStats?.points > 0 },
    { label: 'REB', val: reb, show: communityStats?.rebounds > 0 },
    { label: 'AST', val: ast, show: communityStats?.assists > 0 },
    { label: 'STL', val: stl, show: communityStats?.steals > 0 },
    { label: 'BLK', val: blk, show: communityStats?.blocks > 0 },
  ].filter(s => s.show);

  const tabs = [
    { key: 'sobre', label: 'Sobre' },
    { key: 'estatisticas', label: 'Estat\u00edsticas' },
    { key: 'historico', label: 'Hist\u00f3rico' },
  ];

  const positionColors = { 'Ala': '#3B82F6', 'Armador': '#8B5CF6', 'Piv\u00f4': '#10B981' };
  const posColor = positionColors[localJogador.posicao] || '#F97316';

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-end', padding: 0 }}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, borderRadius: '24px 24px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', background: '#0D0D1A' }}>
        <div className="modal-handle" />

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#8A8A9A', fontSize: 13 }}><div className="spinner" /> Carregando...</div>
        ) : showAvaliar ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px' }}>
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <h4 style={{ fontWeight: 800, fontSize: 18, color: '#FFFFFF', fontFamily: "'Barlow Condensed',sans-serif" }}>Avaliar Atleta</h4>
              <p style={{ fontSize: 13, color: '#8A8A9A', marginTop: 4 }}>
                Notas de <strong style={{ color: '#FFFFFF' }}>{localJogador.apelido || localJogador.nome}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {fundamentos.map((f, i) => {
                const val = estrelas[f.key] || 0;
                return (
                  <div key={f.key} style={{ background: val > 0 ? 'rgba(249,115,22,0.1)' : '#131C27', padding: '14px 16px', borderRadius: 12, border: val > 0 ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 6, background: val > 0 ? '#F97316' : '#131C27', color: val > 0 ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: val > 0 ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>{i + 1}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>{f.label}</span>
                      </div>
                      <span style={{ fontSize: 12, color: '#F97316', fontWeight: 700 }}>{val > 0 ? `\u2605 ${val}.0` : labelsNota[val] || 'Nota'}</span>
                    </div>
                    <StarPicker value={val} onChange={v => setEstrelas(p => ({ ...p, [f.key]: v }))} disabled={enviandoAvaliacao} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="button" onClick={() => setShowAvaliar(false)} disabled={enviandoAvaliacao} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: '#131C27', color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Voltar</button>
              <button type="button" onClick={handleConfirmarAvaliacao} disabled={enviandoAvaliacao || fundamentos.some(f => !estrelas[f.key])} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#F97316', color: '#0A1018', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>{enviandoAvaliacao ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', flex: 1 }}>

              {/* Back button */}
              <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Inter',sans-serif", padding: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
                  Voltar
                </button>
              </div>

              {/* Hero Section */}
              <div style={{ position: 'relative', height: 220, margin: '8px 16px 0', borderRadius: '16px 16px 0 0', overflow: 'hidden', flexShrink: 0 }}>
                {localJogador.foto_url ? (
                  <img src={localJogador.foto_url} alt={localJogador.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${posColor}22 0%, #131C27 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 96, height: 96, borderRadius: '50%', background: `linear-gradient(135deg, ${posColor} 0%, ${posColor}88 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, color: '#FFFFFF', fontFamily: "'Barlow Condensed',sans-serif", border: '3px solid rgba(249,115,22,0.3)', boxShadow: '0 0 0 4px rgba(249,115,22,0.1)' }}>
                      {localJogador.nome?.charAt(0) || '?'}
                    </div>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', background: 'linear-gradient(to bottom, transparent 0%, #0D0D1A 100%)' }} />
                <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 2 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                    {localJogador.nome}
                  </div>
                  {localJogador.apelido && (
                    <div style={{ fontSize: 13, color: '#8A8A9A', fontFamily: "'Inter',sans-serif", marginTop: 2 }}>
                      "{localJogador.apelido}"
                    </div>
                  )}
                </div>
              </div>

              {/* Rating + Rank Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#F97316', fontFamily: "'Barlow Condensed',sans-serif" }}>
                      {starsVal > 0 ? Number(starsVal).toFixed(1) : '--'}
                    </span>
                    <span style={{ fontSize: 14, color: '#F97316' }}>&#9733;</span>
                    <span style={{ fontSize: 13, color: '#8A8A9A', fontFamily: "'Inter',sans-serif", fontWeight: 400 }}> Nota m\u00e9dia</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', fontFamily: "'Inter',sans-serif", marginTop: 2 }}>
                    baseado em {localJogador.total_votos || 0} {(localJogador.total_votos || 0) === 1 ? 'voto' : 'votos'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 16 }}>&#127942;</span>
                  <span style={{ fontSize: 13, color: '#8A8A9A', fontFamily: "'Inter',sans-serif" }}>#{rank || '--'} {localJogador.cidade}</span>
                </div>
              </div>

              {/* Game Stats */}
              <div style={{ padding: '16px' }}>
                {!hasAnyGameStats ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 12px', opacity: 0.5 }}>
                      <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/>
                    </svg>
                    <div style={{ fontSize: 13, color: '#8A8A9A', fontFamily: "'Inter',sans-serif", marginBottom: 8 }}>Nenhuma partida registrada ainda</div>
                    <button style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 8, padding: '8px 16px', color: '#F97316', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>+ Adicionar partida</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gameStats.length}, 1fr)`, gap: 8, textAlign: 'center' }}>
                    {gameStats.map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', fontFamily: "'Inter',sans-serif" }}>{item.val}</div>
                        <div style={{ fontSize: 10, color: '#6B7280', fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Evolution Timeline */}
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 400, color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter',sans-serif", marginBottom: 12 }}>Linha de Evolu\u00e7\u00e3o</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', padding: '0 8px' }}>
                  <div style={{ position: 'absolute', top: 10, left: 24, right: 24, height: 2, background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', top: 10, left: 24, width: `${evolutionIndex * 33.3}%`, maxWidth: 'calc(100% - 48px)', height: 2, background: '#F97316', transition: 'width 0.6s ease' }} />
                  {[
                    { label: 'Rookie', year: '2023', val: 0 },
                    { label: 'Promessa', year: '2024', val: 1 },
                    { label: 'Elite', year: '2025', val: 2 },
                    { label: 'MVP', year: '2026', val: 3 },
                  ].map((step, i) => {
                    const isCompleted = evolutionIndex >= step.val;
                    const isActive = evolutionIndex === step.val;
                    return (
                      <div key={step.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: isCompleted ? '#F97316' : 'transparent',
                          border: isCompleted ? 'none' : '2px dashed rgba(255,255,255,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: isActive ? '0 0 12px rgba(249,115,22,0.4)' : 'none',
                          animation: isActive ? 'pulse 2s infinite' : 'none',
                          marginBottom: 6,
                        }}>
                          {isCompleted && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFFFFF' }} />}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: isCompleted ? 700 : 400, color: isCompleted ? '#FFFFFF' : '#444', fontFamily: "'Inter',sans-serif", textAlign: 'center' }}>{step.label}</div>
                        <div style={{ fontSize: 9, color: '#64748B', fontFamily: "'Inter',sans-serif", marginTop: 1 }}>{step.year}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', padding: '0 16px' }}>
                {tabs.map(t => {
                  const active = perfilTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setPerfilTab(t.key)}
                      style={{
                        flex: 1, padding: '12px 4px', background: 'none', border: 'none',
                        borderBottom: active ? '2px solid #F97316' : '2px solid transparent',
                        color: active ? '#F97316' : '#555',
                        fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
                        fontFamily: "'Inter',sans-serif", transition: 'all 0.2s',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div style={{ padding: '16px', minHeight: 100 }}>
                {perfilTab === 'sobre' && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {[
                      { label: 'Cidade', val: `${localJogador.cidade} - ${localJogador.uf}`, icon: null },
                      { label: 'Idade', val: profileData?.idade ? `${profileData.idade} anos` : '--', icon: null },
                      { label: 'Altura', val: profileData?.altura ? `${Number(profileData.altura).toFixed(2)} m` : '--', icon: null },
                      { label: 'Posi\u00e7\u00e3o', val: localJogador.posicao || 'Ala', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/></svg> },
                      { label: 'Equipe', val: localJogador.equipe || `${localJogador.cidade} Hooper`, icon: null },
                    ].map((item, i) => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none', minHeight: 48 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {item.icon}
                          <span style={{ fontSize: 11, color: '#6B7280', fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 400 }}>{item.label}</span>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', fontFamily: "'Inter',sans-serif", textAlign: 'right' }}>{item.val}</span>
                      </div>
                    ))}
                  </div>
                )}

                {perfilTab === 'estatisticas' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {fundamentos.map(f => {
                      const mediaAspecto = localJogador[`media_${f.key}`] || 0;
                      const hasVotes = localJogador.total_votos >= 1;
                      return (
                        <div key={f.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                            <span style={{ fontWeight: 600, color: '#FFFFFF', fontFamily: "'Inter',sans-serif" }}>{f.label}</span>
                            <span style={{ color: '#F97316', fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif" }}>{hasVotes ? `\u2605 ${Number(mediaAspecto).toFixed(1)}` : '--'}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div className="bar-grow-fill" style={{ width: hasVotes ? `${(mediaAspecto / 5) * 100}%` : '0%', height: '100%', borderRadius: 3, background: '#F97316' }} />
                          </div>
                        </div>
                      );
                    })}
                    {localJogador.total_votos < 1 && (
                      <div style={{ fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 6, fontFamily: "'Inter',sans-serif" }}>Sem dados de avalia\u00e7\u00e3o ainda</div>
                    )}
                  </div>
                )}

                {perfilTab === 'historico' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {historicoJogos.length === 0 ? (
                      <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', padding: '24px 0', fontFamily: "'Inter',sans-serif" }}>Nenhuma partida finalizada</div>
                    ) : (
                      historicoJogos.map(h => (
                        <div key={h.id} style={{ background: '#131C27', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', fontFamily: "'Inter',sans-serif" }}>{h.timeA} {h.placarA} x {h.placarB} {h.timeB}</div>
                            <span style={{ fontSize: 10, color: '#64748B', fontFamily: "'Inter',sans-serif" }}>{new Date(h.data).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 800, color: h.vencedor === 'Ganhou' ? '#10B981' : '#EF4444', background: h.vencedor === 'Ganhou' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 4, fontFamily: "'Inter',sans-serif" }}>{h.vencedor.toUpperCase()}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom CTAs */}
            {!isMe && (
              <div style={{ padding: '12px 16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => setShowAvaliar(true)} style={{ width: '100%', height: 52, borderRadius: 12, background: '#F97316', border: 'none', color: '#0A1018', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em', boxShadow: '0 4px 16px rgba(249,115,22,0.25)' }}>
                  {jaAvaliou ? 'Editar Avalia\u00e7\u00e3o' : 'Avaliar Este Jogador'}
                </button>
                <button onClick={() => setShowDenunciar(true)} style={{ width: '100%', height: 44, borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#8A8A9A', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                  Compartilhar Perfil
                </button>
              </div>
            )}
          </>
        )}

        {showDenunciar && (
          <div className="modal-overlay" onClick={() => setShowDenunciar(false)} style={{ zIndex: 200, background: 'rgba(0,0,0,0.8)' }}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, marginBottom: 20 }}>
              <div className="modal-handle" />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4, color: '#FFFFFF' }}>Denunciar Atleta</h3>
              <p style={{ color: '#8A8A9A', fontSize: 12, marginBottom: 16 }}>Nos ajude a manter a comunidade limpa.</p>
              <form onSubmit={handleEnviarDenuncia} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#8A8A9A', fontWeight: 600, display: 'block', marginBottom: 6 }}>Motivo</label>
                  <select value={tipoDenuncia} onChange={e => setTipoDenuncia(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#131C27', color: '#FFFFFF', fontSize: 13 }}>
                    <option value="perfil_falso">Perfil Falso</option>
                    <option value="avaliacao_suspeita">Avalia\u00e7\u00e3o Suspeita</option>
                    <option value="comportamento_inadequado">Comportamento Inadequado</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#8A8A9A', fontWeight: 600, display: 'block', marginBottom: 6 }}>Descri\u00e7\u00e3o *</label>
                  <textarea required rows="3" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva brevemente..." style={{ resize: 'none', width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#131C27', color: '#FFFFFF', fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button type="button" onClick={() => setShowDenunciar(false)} disabled={enviandoDenuncia} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: '#131C27', color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Cancelar</button>
                  <button type="submit" disabled={enviandoDenuncia} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#EF4444', color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>{enviandoDenuncia ? 'Enviando...' : 'Enviar'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <style>{`@keyframes pulse { 0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.3); } 50% { box-shadow: 0 0 16px rgba(249,115,22,0.6); } }`}</style>
    </div>
  );
}
