import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';

function PlayerAvatar({ fotoUrl, nome, size = 40, border = 'none' }) {
  const initial = nome ? nome.charAt(0).toUpperCase() : '?';
  
  const getGradientForName = (name) => {
    const colors = [
      ['#3b82f6', '#1d4ed8'],
      ['#f59e0b', '#d97706'],
      ['#10b981', '#047857'],
      ['#8b5cf6', '#6d28d9'],
      ['#ec4899', '#be185d'],
      ['#f43f5e', '#be123c'],
      ['#06b6d4', '#0891b2'],
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return `linear-gradient(135deg, ${colors[index][0]} 0%, ${colors[index][1]} 100%)`;
  };

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    border: border,
    flexShrink: 0
  };

  if (fotoUrl) {
    return (
      <div style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
        <img src={fotoUrl} alt={nome} style={avatarStyle} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <div style={{
        ...avatarStyle,
        background: getGradientForName(nome),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: size * 0.44,
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
      }}>
        {initial}
      </div>
    </div>
  );
}

export default function RankingPublico({ onNavigate }) {
  const [players, setPlayers] = useState([]);
  const [uniqueCities, setUniqueCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // States dos Filtros
  const [searchCity, setSearchCity] = useState('');
  const [searchAthlete, setSearchAthlete] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('geral');

  useEffect(() => {
    loadCities();
    loadPlayers();
    
    // Configura tempo real para atualização automática dos dados
    const channel = supabase
      .channel('public-ranking-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jogadores' },
        () => {
          loadPlayers();
          loadCities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadCities() {
    try {
      const { data } = await supabase
        .from('jogadores')
        .select('cidade, uf')
        .eq('ativo', true);
      if (data) {
        const temp = [];
        const seen = new Set();
        data.forEach(item => {
          const key = `${item.cidade}|${item.uf}`;
          if (!seen.has(key)) {
            seen.add(key);
            temp.push({ cidade: item.cidade, uf: item.uf });
          }
        });
        temp.sort((a, b) => a.cidade.localeCompare(b.cidade));
        setUniqueCities(temp);
      }
    } catch (e) {
      console.error('Erro ao carregar cidades:', e);
    }
  }

  async function loadPlayers() {
    setLoading(true);
    try {
      const { data } = await jogadoresAPI.listar();
      setPlayers(data || []);
    } catch (e) {
      console.error('Erro ao carregar ranking:', e);
    }
    setLoading(false);
  }

  // Obter valor com base na categoria
  const getMetricValue = (player) => {
    if (selectedCategory === 'pontos') return player.media_arremesso || 0;
    if (selectedCategory === 'rebotes') return player.media_fisicalidade || 0;
    if (selectedCategory === 'assist') return player.media_passe || 0;
    if (selectedCategory === 'defesa') return player.media_defesa || 0;
    return player.media_estrelas || 0;
  };

  // Cálculo da porcentagem top na cidade
  const getCityPlayerCount = (city, uf) => {
    return players.filter(p => p.cidade === city && p.uf === uf).length;
  };

  const getCityPlayerRank = (player) => {
    const cityPlayers = players
      .filter(p => p.cidade === player.cidade && p.uf === player.uf)
      .sort((a, b) => (b.media_estrelas || 0) - (a.media_estrelas || 0));
    return cityPlayers.findIndex(p => p.id === player.id) + 1;
  };

  // Filtragem e Ordenação dos Jogadores
  const getProcessedPlayers = () => {
    let result = [...players];

    // Filtro por Cidade
    if (selectedCity) {
      const [cidade, uf] = selectedCity.split('|');
      result = result.filter(p => p.cidade === cidade && p.uf === uf);
    }

    // Filtro de Busca por Atleta
    if (searchAthlete.trim()) {
      const term = searchAthlete.toLowerCase();
      result = result.filter(p => 
        p.nome.toLowerCase().includes(term) || 
        (p.apelido && p.apelido.toLowerCase().includes(term))
      );
    }

    // Filtro por Posição
    if (selectedPosition) {
      result = result.filter(p => p.posicao === selectedPosition);
    }

    // Ordenação por Categoria
    if (selectedCategory === 'pontos') {
      result.sort((a, b) => (b.media_arremesso || 0) - (a.media_arremesso || 0));
    } else if (selectedCategory === 'rebotes') {
      result.sort((a, b) => (b.media_fisicalidade || 0) - (a.media_fisicalidade || 0));
    } else if (selectedCategory === 'assist') {
      result.sort((a, b) => (b.media_passe || 0) - (a.media_passe || 0));
    } else if (selectedCategory === 'defesa') {
      result.sort((a, b) => (b.media_defesa || 0) - (a.media_defesa || 0));
    } else {
      // Geral (media_estrelas desc)
      result.sort((a, b) => {
        const diff = (b.media_estrelas || 0) - (a.media_estrelas || 0);
        if (Math.abs(diff) < 0.001) {
          return (b.total_votos || 0) - (a.total_votos || 0);
        }
        return diff;
      });
    }

    return result;
  };

  const processedPlayers = getProcessedPlayers();

  const getRankBadgeStyle = (index) => {
    if (index === 0) return { border: '2px solid #F97316', background: 'rgba(249, 115, 22, 0.15)', color: '#F97316' };
    if (index === 1) return { border: '2px solid #94A3B8', background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-secondary)' };
    if (index === 2) return { border: '2px solid #CD7C2F', background: 'rgba(205, 124, 47, 0.15)', color: '#CD7C2F' };
    return { border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)' };
  };

  // Filtragem das cidades exibidas no select com base na busca por cidade
  const filteredCities = uniqueCities.filter(c => 
    c.cidade.toLowerCase().includes(searchCity.toLowerCase())
  );

  if (loading) return (
    <div className="page-content" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="skeleton skeleton-avatar" style={{ width: 40, height: 40 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton skeleton-bar" style={{ width: '60%', height: 16 }} />
          <div className="skeleton skeleton-bar" style={{ width: '40%', height: 12 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, height: 40 }} className="skeleton" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3, 4, 5].map(idx => (
          <div key={idx} className="skeleton" style={{ height: 64, borderRadius: '12px' }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: '20px 20px 0' }}>
        
        {/* Cabeçalho de Modo de Visualização Público */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            RANKING PÚBLICO
          </h2>
          <span style={{
            background: 'rgba(245, 158, 11, 0.12)',
            color: '#F97316',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            display: 'inline-block',
            marginTop: 6
          }}>
            Modo Visualização
          </span>
        </div>

        {/* Barra de Filtros e Busca */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {/* Inputs de Pesquisa */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <input 
                type="text" 
                placeholder="🔍 Pesquisar cidade..." 
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input 
                type="text" 
                placeholder="🔍 Pesquisar atleta..." 
                value={searchAthlete}
                onChange={(e) => setSearchAthlete(e.target.value)}
              />
            </div>
          </div>
          
          {/* Filtros Dropdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                <option value="">Cidades ({filteredCities.length})</option>
                {filteredCities.map(c => (
                  <option key={`${c.cidade}|${c.uf}`} value={`${c.cidade}|${c.uf}`}>{c.cidade} - {c.uf}</option>
                ))}
              </select>
            </div>
            
            <div>
              <select value={selectedPosition} onChange={(e) => setSelectedPosition(e.target.value)}>
                <option value="">Posições</option>
                <option value="Armador">Armador</option>
                <option value="Ala-Armador">Ala-Armador</option>
                <option value="Ala">Ala</option>
                <option value="Ala-Pivô">Ala-Pivô</option>
                <option value="Pivô">Pivô</option>
              </select>
            </div>

            <div>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="geral">Geral</option>
                <option value="pontos">Pontos</option>
                <option value="rebotes">Rebotes</option>
                <option value="assist">Assistências</option>
                <option value="defesa">Defesa</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listagem do Ranking */}
        {processedPlayers.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="8" r="7"/>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
            </svg>
            <h3>Nenhum jogador encontrado</h3>
            <p>Tente ajustar os filtros ou pesquisar por outro termo.</p>
          </div>
        ) : (
          <div className="responsive-card-grid" style={{ marginBottom: 20 }}>
            {processedPlayers.map((jogador, index) => {
              const isFirst = index === 0;
              const totalInCity = getCityPlayerCount(jogador.cidade, jogador.uf);
              const rankInCity = getCityPlayerRank(jogador);
              const topPercentage = totalInCity > 0 ? Math.max(1, Math.round((rankInCity / totalInCity) * 100)) : 100;

              return (
                <div 
                  key={jogador.id} 
                  className={`card card-enter${isFirst ? ' first-place-card' : ''}`}
                  onClick={() => setSelectedPlayer({ ...jogador, rank: rankInCity })}
                  style={{
                    background: isFirst ? 'var(--podium-bg-1st)' : 'var(--bg-card)',
                    border: isFirst ? 'var(--podium-border-1st)' : '1px solid var(--border)',
                    borderRadius: isFirst ? '16px' : '12px',
                    padding: isFirst ? '16px' : '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    animationDelay: `${index * 20}ms`,
                    position: 'relative',
                    overflow: 'hidden',
                    ...(isFirst ? {
                      boxShadow: '0 0 20px rgba(249,115,22,0.15), 0 0 60px rgba(249,115,22,0.05), inset 0 1px 0 rgba(255,255,255,0.06)',
                    } : {})
                  }}
                >
                  {/* Efeito shimmer para o primeiro lugar */}
                  {isFirst && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.06) 50%, transparent 100%)',
                      animation: 'shimmer 3s ease-in-out infinite',
                      pointerEvents: 'none'
                    }} />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: isFirst ? 14 : 12 }}>
                    
                    {/* Indicador de Rank */}
                    {isFirst ? (
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #F97316 0%, #EAB308 100%)',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 900,
                        boxShadow: '0 2px 8px rgba(249,115,22,0.4)',
                        position: 'relative'
                      }}>
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="#EAB308" 
                          style={{
                            position: 'absolute',
                            top: '-12px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '18px',
                            height: '18px',
                            filter: 'drop-shadow(0 1px 2px rgba(234,179,8,0.5))'
                          }}
                        >
                          <path d="M2.5 18.5l2-9 5 4.5L12 7l2.5 7 5-4.5 2 9h-19z"/>
                        </svg>
                        1
                      </div>
                    ) : (
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 800,
                        ...getRankBadgeStyle(index)
                      }}>
                        {index + 1}
                      </div>
                    )}

                    {/* Foto de Perfil */}
                    <PlayerAvatar 
                      fotoUrl={jogador.foto_url} 
                      nome={jogador.nome} 
                      size={isFirst ? 50 : 40}
                      border={isFirst ? '2px solid rgba(249,115,22,0.6)' : 'none'}
                    />

                    {/* Detalhes do Atleta */}
                    <div>
                      <div style={{
                        fontSize: isFirst ? '15px' : '14px',
                        fontWeight: isFirst ? 800 : 700,
                        color: isFirst ? 'var(--podium-first-name)' : 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        {jogador.nome}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: isFirst ? 'var(--podium-first-sub)' : 'var(--text-secondary)', 
                        marginTop: 2,
                        fontWeight: isFirst ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 4
                      }}>
                        <span>{jogador.posicao || 'Ala'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span>{jogador.cidade} - {jogador.uf}</span>
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span style={{ 
                          color: isFirst ? '#F97316' : '#2563EB',
                          fontWeight: 700
                        }}>
                          Top {topPercentage}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Nota */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 3,
                      ...(isFirst ? {
                        background: 'var(--podium-first-star-bg)',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: '1px solid var(--podium-first-star-border)'
                      } : {})
                    }}>
                      <span style={{ 
                        fontSize: isFirst ? '17px' : '15px', 
                        fontWeight: 900, 
                        color: isFirst ? 'var(--podium-first-star-color)' : '#F97316', 
                        fontFamily: 'monospace' 
                      }}>
                        {Number(getMetricValue(jogador)).toFixed(1)}
                      </span>
                      <span style={{ color: isFirst ? 'var(--podium-first-star-color)' : '#F97316', fontSize: isFirst ? '14px' : '12px' }}>★</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Botão de Rodapé para retornar ao login */}
        <button 
          onClick={() => onNavigate('inicio')}
          className="btn-back-ranking"
          style={{
            background: 'none',
            border: '1px solid var(--accent-blue)',
            borderRadius: '50px',
            color: 'var(--accent-blue)',
            padding: '12px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          Voltar ao Início / Entrar
        </button>

      </div>

      {selectedPlayer && (
        <PlayerProfileModal
          jogador={selectedPlayer}
          rank={selectedPlayer.rank}
          isPublicView={true}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
