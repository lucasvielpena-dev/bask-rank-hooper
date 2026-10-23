import { useEffect, useRef, useState } from 'react';
import { midiaAPI, supabase } from '../lib/supabase';

const MAX = midiaAPI.MAX_FOTOS;

/**
 * Fase 1 + 2 — fotos (máx. 5) e 1 vídeo curto (play sob demanda).
 */
export default function GaleriaPerfil({ usuarioId, jogador, isOwner = false }) {
  const [fotos, setFotos] = useState([]);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviandoVideo, setEnviandoVideo] = useState(false);
  const [erro, setErro] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [playVideo, setPlayVideo] = useState(false);
  const inputRef = useRef(null);
  const videoInputRef = useRef(null);

  async function resolveUid() {
    if (usuarioId) return usuarioId;
    if (jogador) {
      const res = await midiaAPI.listarPorJogador(jogador);
      // listarPorJogador only returns fotos; resolve uid like API
      let uid = jogador.usuario_id || jogador.user_id || null;
      if (!uid && jogador.criado_por) uid = jogador.criado_por;
      return uid;
    }
    return null;
  }

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      let uid = usuarioId;
      if (!uid && jogador) {
        // reuse listarPorJogador logic for fotos + need uid for video
        const fotosRes = await midiaAPI.listarPorJogador(jogador);
        if (fotosRes.error) throw fotosRes.error;
        setFotos(fotosRes.data || []);
        // try video via profile link
        let u = jogador.usuario_id || jogador.criado_por || null;
        if (!u && jogador.id) {
          const { data: pr } = await supabase
            .from('profiles')
            .select('id')
            .eq('player_id', jogador.id)
            .maybeSingle();
          u = pr?.id || null;
          if (!u) {
            const { data: j } = await supabase
              .from('jogadores')
              .select('criado_por')
              .eq('id', jogador.id)
              .maybeSingle();
            u = j?.criado_por || null;
          }
        }
        if (u) {
          const vRes = await midiaAPI.obterVideo(u);
          setVideo(vRes.data || null);
        } else {
          setVideo(null);
        }
      } else if (uid) {
        const [fRes, vRes] = await Promise.all([
          midiaAPI.listarPorUsuario(uid, 'foto'),
          midiaAPI.obterVideo(uid),
        ]);
        if (fRes.error) throw fRes.error;
        setFotos(fRes.data || []);
        setVideo(vRes.data || null);
      } else {
        setFotos([]);
        setVideo(null);
      }
    } catch (e) {
      setFotos([]);
      setVideo(null);
      setErro(e?.message || 'Não foi possível carregar a galeria');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPlayVideo(false);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, jogador?.id]);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !usuarioId) return;
    setEnviando(true);
    setErro(null);
    try {
      const { error } = await midiaAPI.adicionarFoto(usuarioId, file);
      if (error) throw error;
      await carregar();
    } catch (err) {
      setErro(err?.message || 'Falha no upload');
    } finally {
      setEnviando(false);
    }
  }

  async function onPickVideo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !usuarioId) return;
    setEnviandoVideo(true);
    setErro(null);
    try {
      const { error } = await midiaAPI.adicionarVideo(usuarioId, file);
      if (error) throw error;
      setPlayVideo(false);
      await carregar();
    } catch (err) {
      setErro(err?.message || 'Falha no upload do vídeo');
    } finally {
      setEnviandoVideo(false);
    }
  }

  async function onRemove(f, ev) {
    ev?.stopPropagation?.();
    if (!window.confirm('Remover esta mídia?')) return;
    const { error } = await midiaAPI.remover(f.id, f.storage_path);
    if (error) {
      setErro(error.message || 'Não foi possível remover');
      return;
    }
    if (f.tipo === 'video' || video?.id === f.id) {
      setVideo(null);
      setPlayVideo(false);
    } else {
      setFotos((prev) => prev.filter((x) => x.id !== f.id));
    }
    if (viewer?.id === f.id) setViewer(null);
  }

  const vazio = fotos.length === 0 && !video;
  if (loading && vazio) {
    return (
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.04em' }}>
          GALERIA
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Carregando…</div>
      </div>
    );
  }

  if (!isOwner && vazio) return null;

  return (
    <div style={{ marginTop: 12, marginBottom: 12 }}>
      {/* ---- Vídeo (fase 2) ---- */}
      {(video || isOwner) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              VÍDEO HIGHLIGHT
            </div>
            {isOwner && !video && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={enviandoVideo}
                onClick={() => videoInputRef.current?.click()}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 50 }}
              >
                {enviandoVideo ? 'Enviando…' : 'Enviar vídeo'}
              </button>
            )}
          </div>

          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
            style={{ display: 'none' }}
            onChange={onPickVideo}
          />

          {!video && isOwner ? (
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={enviandoVideo}
              style={{
                width: '100%',
                padding: '18px 12px',
                borderRadius: 14,
                border: '1px dashed var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {enviandoVideo
                ? 'Enviando vídeo…'
                : '1 vídeo de até 20 segundos (MP4) · play só quando tocar'}
            </button>
          ) : video ? (
            <div
              style={{
                position: 'relative',
                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: '#000',
                aspectRatio: '16 / 9',
              }}
            >
              {playVideo ? (
                <video
                  src={video.url}
                  controls
                  playsInline
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlayVideo(true)}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--bg-elevated) 0%, #0a0e14 100%)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent-line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                    }}
                  >
                    ▶
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Tocar highlight
                  </span>
                </button>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={(e) => onRemove(video, e)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    padding: '6px 12px',
                    borderRadius: 50,
                    border: 'none',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    zIndex: 2,
                  }}
                >
                  Remover
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ---- Fotos (fase 1) ---- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          FOTOS{fotos.length > 0 ? ` · ${fotos.length}/${MAX}` : ''}
        </div>
        {isOwner && fotos.length < MAX && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
            style={{ fontSize: 12, padding: '6px 12px', borderRadius: 50 }}
          >
            {enviando ? 'Enviando…' : 'Adicionar foto'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={onPick}
      />

      {erro && (
        <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{erro}</div>
      )}

      {fotos.length === 0 && isOwner ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          style={{
            width: '100%',
            padding: '20px 12px',
            borderRadius: 14,
            border: '1px dashed var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {enviando ? 'Enviando…' : 'Adicione até 5 fotos do seu jogo'}
        </button>
      ) : fotos.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {fotos.map((f) => (
            <div
              key={f.id}
              role="button"
              tabIndex={0}
              onClick={() => setViewer(f)}
              onKeyDown={(e) => e.key === 'Enter' && setViewer(f)}
              style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                background: 'var(--bg-secondary)',
              }}
            >
              <img
                src={f.url}
                alt=""
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {isOwner && (
                <button
                  type="button"
                  onClick={(e) => onRemove(f, e)}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    fontSize: 14,
                    lineHeight: 1,
                    cursor: 'pointer',
                  }}
                  aria-label="Remover"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {viewer && (
        <div className="modal-overlay" onClick={() => setViewer(null)} style={{ zIndex: 80 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%', margin: 'auto', padding: 12 }}>
            <img
              src={viewer.url}
              alt=""
              style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 16, background: '#000' }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 10, borderRadius: 50 }}
              onClick={() => setViewer(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
