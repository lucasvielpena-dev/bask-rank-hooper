import { useEffect, useRef, useState } from 'react';
import { midiaAPI } from '../lib/supabase';

const MAX = midiaAPI.MAX_FOTOS;

/**
 * Fase 1 — galeria de fotos do perfil (máx. 5).
 * isOwner: mostra botão adicionar e remover.
 * usuarioId: dono da galeria (profiles.id).
 * jogador: opcional — se não tiver usuarioId, tenta resolver pelo jogador.
 */
export default function GaleriaPerfil({ usuarioId, jogador, isOwner = false }) {
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [viewer, setViewer] = useState(null);
  const inputRef = useRef(null);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      let res;
      if (usuarioId) res = await midiaAPI.listarPorUsuario(usuarioId);
      else if (jogador) res = await midiaAPI.listarPorJogador(jogador);
      else res = { data: [] };
      if (res.error) throw res.error;
      setFotos(res.data || []);
    } catch (e) {
      setFotos([]);
      setErro(e?.message || 'Não foi possível carregar a galeria');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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

  async function onRemove(f, ev) {
    ev?.stopPropagation?.();
    if (!window.confirm('Remover esta foto?')) return;
    const { error } = await midiaAPI.remover(f.id, f.storage_path);
    if (error) {
      setErro(error.message || 'Não foi possível remover');
      return;
    }
    setFotos((prev) => prev.filter((x) => x.id !== f.id));
    if (viewer?.id === f.id) setViewer(null);
  }

  if (loading && fotos.length === 0) {
    return (
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.04em' }}>
          GALERIA
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Carregando…</div>
      </div>
    );
  }

  if (!isOwner && fotos.length === 0) return null;

  return (
    <div style={{ marginTop: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          GALERIA{fotos.length > 0 ? ` · ${fotos.length}/${MAX}` : ''}
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
        capture={undefined}
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
      ) : (
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
                borderRadius: 12,
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
      )}

      {viewer && (
        <div
          className="modal-overlay"
          onClick={() => setViewer(null)}
          style={{ zIndex: 80 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 420,
              width: '100%',
              margin: 'auto',
              padding: 12,
            }}
          >
            <img
              src={viewer.url}
              alt=""
              style={{
                width: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: 16,
                background: '#000',
              }}
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
