import { useState, useEffect, memo } from 'react';
import { supabase, denunciasAPI, votacaoAPI, votacaoHandebolAPI } from '../lib/supabase';
import { motion } from 'framer-motion';
import AnimatedCounter from './AnimatedCounter';
import { useEsporte } from '../contexts/EsporteContext';
import { IconSportDynamic } from './Icons';

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
          <svg width="28" height="28" viewBox="0 0 24 24" fill={(hover || value) >= i ? '#C8F135' : 'none'} stroke={(hover || value) >= i ? '#C8F135' : '#64748B'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
});

export default function PlayerProfileModal({ jogador, rank, onClose }) {
  const { esporte, cfg } = useEsporte();
  const fundamentos = cfg.habilidades;

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
  const [estrelas, setEstrelas] = useState(() => Object.fromEntries(cfg.habilidades.map(h => [h.key, 0])));
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
    if (!descricao.trim()) { showToast('Por favor, descreva o motivo da denúncia.', 'error'); return; }
    setEnviandoDenuncia(true);
    const { error } = await denunciasAPI.criar({ jogador_id: jogador.id, tipo: tipoDenuncia, descricao: descricao.trim() });
    if (error) { showToast(error.message || 'Erro ao registrar denúncia.', 'error'); }
    else { showToast('✓ Denúncia enviada para análise!', 'success'); setTimeout(() => { setShowDenunciar(false); setDescricao(''); }, 1500); }
    setEnviandoDenuncia(false);
  }

  async function handleConfirmarAvaliacao() {
    if (fundamentos.some(f => !estrelas[f.key])) { showToast('Selecione uma nota para todos os 5 fundamentos', 'error'); return; }
    setEnviandoAvaliacao(true);
    const apiVoto = esporte === 'handebol' ? votacaoHandebolAPI : votacaoAPI;
    const { data, error } = await apiVoto.votar(jogador.id, estrelas);
    if (error || !data?.sucesso) { showToast(data?.erro || error?.message || 'Erro ao registrar avaliação', 'error'); }
    else {
      showToast(`✓ Avaliação registrada! Média: ★ ${Number(data.media_estrelas).toFixed(1)}`, 'success');
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
    { key: 'estatisticas', label: 'Estatísticas' },
    { key: 'historico', label: 'Histórico' },
  ];

  const posColor = '#C8F135';

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-end', padding: 0 }}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, borderRadius: '24px 24px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', background: '#0D0D1A' }}>
        <div className="modal-handle" />

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}><div className="spinner" /> Carregando...</div>
        ) : showAvaliar ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px' }}>
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <h4 style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', fontFamily: "'Barlow Condensed',sans-serif" }}>Avaliar Atleta</h4>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                Notas de <strong style={{ color: 'var(--text-primary)' }}>{localJogador.apelido || localJogador.nome}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {fundamentos.map((f, i) => {
                const val = estrelas[f.key] || 0;
                return (
                   <div key={f.key} style={{ background: val > 0 ? 'rgba(200,241,53,0.1)' : 'var(--bg-card)', padding: '14px 16px', borderRadius: 12, border: val > 0 ? '1px solid rgba(200,241,53,0.3)' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 6, background: val > 0 ? '#C8F135' : '#13131F', color: val > 0 ? '#fff' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: val > 0 ? 'none' : '1px solid var(--border)' }}>{i + 1}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{f.label}</span>
                      </div>
                      <span style={{ fontSize: 12, color: '#C8F135', fontWeight: 700 }}>{val > 0 ? `\u2605 ${val}.0` : labelsNota[val] || 'Nota'}</span>
                    </div>
                    <StarPicker value={val} onChange={v => setEstrelas(p => ({ ...p, [f.key]: v }))} disabled={enviandoAvaliacao} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="button" onClick={() => setShowAvaliar(false)} disabled={enviandoAvaliacao} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Voltar</button>
              <button type="button" onClick={handleConfirmarAvaliacao} disabled={enviandoAvaliacao || fundamentos.some(f => !estrelas[f.key])} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#C8F135', color: '#0C0C14', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>{enviandoAvaliacao ? 'Salvando...' : 'Salvar'}</button>
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
              <div style={{ position: 'relative', height: 200, margin: '8px 16px 0', borderRadius: '16px 16px 0 0', overflow: 'hidden', flexShrink: 0 }}>
                {localJogador.foto_url ? (
                  <img src={localJogador.foto_url} alt={localJogador.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${posColor}22 0%, var(--bg-card) 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <div style={{ width: 96, height: 96, borderRadius: '50%', background: `linear-gradient(135deg, ${posColor} 0%, ${posColor}88 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Barlow Condensed',sans-serif", border: '3px solid rgba(200,241,53,0.3)', boxShadow: '0 0 0 4px rgba(200,241,53,0.1)' }}>
                      {localJogador.nome?.charAt(0) || '?'}
                    </div>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', background: 'linear-gradient(to bottom, transparent 0%, #0D0D1A 100%)' }} />
                <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 2 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                    {localJogador.nome}
                  </div>
                  {localJogador.apelido && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Inter',sans-serif", marginTop: 2 }}>
                      "{localJogador.apelido}"
                    </div>
                  )}
                </div>
              </div>

              {/* Rating + Rank Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#C8F135', fontFamily: "'Barlow Condensed',sans-serif" }}>
                      {starsVal > 0 ? <AnimatedCounter value={starsVal} /> : '--'}
                    </span>
                    <span style={{ fontSize: 14, color: '#C8F135' }}>&#9733;</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Inter',sans-serif", fontWeight: 400 }}> Nota média</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif", marginTop: 2 }}>
                    baseado em {localJogador.total_votos || 0} {(localJogador.total_votos || 0) === 1 ? 'voto' : 'votos'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 16 }}>&#127942;</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Inter',sans-serif" }}>#{rank || '--'} {localJogador.cidade}</span>
                </div>
              </div>

              {/* Game Stats */}
              <div style={{ padding: '16px' }}>
                {!hasAnyGameStats ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '20px', color: '#6A6A82' }}>
                    <IconSportDynamic sport={esporte} size={16} color="#6A6A82" />
                    <span>Nenhuma partida registrada ainda</span>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gameStats.length}, 1fr)`, gap: 8, textAlign: 'center' }}>
                    {gameStats.map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter',sans-serif" }}>{item.val}</div>
                        <div style={{ fontSize: 10, color: '#6B7280', fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Evolution Timeline */}
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 400, color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter',sans-serif", marginBottom: 12 }}>Linha de Evolução</div>
                <motion.div 
                  initial="hidden" 
                  animate="show" 
                  variants={{ show: { transition: { staggerChildren: 0.1 } } }}
                  style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', padding: '0 8px' }}
                >
                  <div style={{ position: 'absolute', top: 10, left: 24, right: 24, height: 2, background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', top: 10, left: 24, width: `${evolutionIndex * 33.3}%`, maxWidth: 'calc(100% - 48px)', height: 2, background: '#C8F135', transition: 'width 0.6s ease' }} />
                  {[
                    { label: 'Rookie', year: '2023', val: 0 },
                    { label: 'Promessa', year: '2024', val: 1 },
                    { label: 'Elite', year: '2025', val: 2 },
                    { label: 'MVP', year: '2026', val: 3 },
                  ].map((step, i) => {
                    const isCompleted = evolutionIndex >= step.val;
                    const isActive = evolutionIndex === step.val;
                    return (
                      <motion.div 
                        key={step.label} 
                        variants={{ hidden: { scale: 0 }, show: { scale: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } } }}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: isCompleted ? '#C8F135' : 'transparent',
                          border: isCompleted ? 'none' : '2px dashed #333344',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: isActive ? '0 0 12px rgba(200,241,53,0.4)' : 'none',
                          animation: isActive ? 'pulse 2s infinite' : 'none',
                          marginBottom: 6,
                        }}>
                          {isCompleted && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFFFFF' }} />}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: isCompleted ? 700 : 400, color: isCompleted ? 'var(--text-primary)' : '#444', fontFamily: "'Inter',sans-serif", textAlign: 'center' }}>{step.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif", marginTop: 1 }}>{step.year}</div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', padding: '0 16px', position: 'relative', borderBottom: '1px solid var(--border)' }}>
                {tabs.map(t => {
                  const active = perfilTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setPerfilTab(t.key)}
                      style={{
                        position: 'relative', flex: 1, padding: '12px 16px 10px', background: 'none', border: 'none',
                        color: active ? '#C8F135' : '#6A6A82',
                        fontSize: active ? 14 : 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
                        fontFamily: active ? "'Barlow Condensed',sans-serif" : "'Inter',sans-serif",
                        transition: 'color 0.2s, font-size 0.2s',
                      }}
                    >
                      {t.label}
                      {active && (
                        <motion.div
                          layoutId="underline"
                          style={{
                            position: 'absolute',
                            bottom: -1,
                            left: 0,
                            right: 0,
                            height: 2,
                            background: '#C8F135',
                            borderRadius: '2px 2px 0 0'
                          }}
                        />
                      )}
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
                      { label: 'Posição', val: localJogador.posicao || cfg.posicoes[0], icon: <IconSportDynamic sport={esporte} size={14} color="#C8F135" /> },
                      { label: 'Equipe', val: localJogador.equipe || `${localJogador.cidade} Hooper`, icon: null },
                    ].map((item, i) => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none', minHeight: 48 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {item.icon}
                          <span style={{ fontSize: 11, color: '#6B7280', fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 400 }}>{item.label}</span>
                        </div>
                        <span style={{ fontSize: item.label === 'Posição' ? 12 : 15, fontWeight: item.label === 'Posição' ? 400 : 700, color: item.label === 'Posição' ? '#6A6A82' : 'var(--text-primary)', fontFamily: "'Inter',sans-serif", textAlign: 'right' }}>{item.val}</span>
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
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter',sans-serif" }}>{f.label}</span>
                            <span style={{ color: '#C8F135', fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif" }}>{hasVotes ? `\u2605 ${Number(mediaAspecto).toFixed(1)}` : '--'}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div className="bar-grow-fill" style={{ width: hasVotes ? `${(mediaAspecto / 5) * 100}%` : '0%', height: '100%', borderRadius: 3, background: '#C8F135' }} />
                          </div>
                        </div>
                      );
                    })}
                    {localJogador.total_votos < 1 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6, fontFamily: "'Inter',sans-serif" }}>Sem dados de avaliação ainda</div>
                    )}
                  </div>
                )}

                {perfilTab === 'historico' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {historicoJogos.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontFamily: "'Inter',sans-serif" }}>Nenhuma partida finalizada</div>
                    ) : (
                      historicoJogos.map(h => (
                        <div key={h.id} style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter',sans-serif" }}>{h.timeA} {h.placarA} x {h.placarB} {h.timeB}</div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>{new Date(h.data).toLocaleDateString('pt-BR')}</span>
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
              <div style={{ padding: '12px 16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => setShowAvaliar(true)} style={{ width: '100%', height: 52, borderRadius: 12, background: '#C8F135', border: 'none', color: '#0C0C14', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em', boxShadow: '0 4px 16px rgba(200,241,53,0.25)' }}>
                  {jaAvaliou ? 'Editar Avaliação' : 'Avaliar Este Jogador'}
                </button>
                <button onClick={() => setShowDenunciar(true)} style={{ width: '100%', height: 44, borderRadius: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                  Denunciar Perfil
                </button>
              </div>
            )}
          </>
        )}

        {showDenunciar && (
          <div className="modal-overlay" onClick={() => setShowDenunciar(false)} style={{ zIndex: 200, background: 'rgba(0,0,0,0.8)' }}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, marginBottom: 20 }}>
              <div className="modal-handle" />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4, color: 'var(--text-primary)' }}>Denunciar Atleta</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16 }}>Nos ajude a manter a comunidade limpa.</p>
              <form onSubmit={handleEnviarDenuncia} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Motivo</label>
                   <select value={tipoDenuncia} onChange={e => setTipoDenuncia(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}>
                    <option value="perfil_falso">Perfil Falso</option>
                    <option value="avaliacao_suspeita">Avaliação Suspeita</option>
                    <option value="comportamento_inadequado">Comportamento Inadequado</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Descrição *</label>
                   <textarea required rows="3" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva brevemente..." style={{ resize: 'none', width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                   <button type="button" onClick={() => setShowDenunciar(false)} disabled={enviandoDenuncia} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Cancelar</button>
                  <button type="submit" disabled={enviandoDenuncia} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#EF4444', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>{enviandoDenuncia ? 'Enviando...' : 'Enviar'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <style>{`@keyframes pulse { 0%, 100% { box-shadow: 0 0 8px rgba(200,241,53,0.3); } 50% { box-shadow: 0 0 16px rgba(200,241,53,0.6); } }`}</style>
    </div>
  );
}
