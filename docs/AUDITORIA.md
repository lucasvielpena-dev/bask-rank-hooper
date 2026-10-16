# 🔎 Auditoria de código — Rank Hooper

Data: 2026-10-16
Escopo: `bask-rank-hooper-main` (frontend React + SQL Supabase). Auditoria somente leitura.
Observação: itens de severidade Alta foram verificados diretamente no código-fonte.

---

## 🔴 Alta

### A1. `migration_cleanup.sql` quebra a votação
`supabase/migration_cleanup.sql:11-14` remove `votos` e `auditoria_votos`:
```sql
DROP TABLE IF EXISTS public.votos CASCADE;
DROP TABLE IF EXISTS public.auditoria_votos CASCADE;
```
Mas `registrar_avaliacao` continua inserindo na tabela removida (`supabase/schema.sql:432`):
```sql
INSERT INTO public.auditoria_votos (avaliacao_id, ip, device_id, localizacao, status) ...
```
**Efeito:** rodar `migration_cleanup.sql` faz a votação falhar em runtime.

### A2. Overload ambíguo de `get_ranking` (4 vs 5 argumentos)
- `supabase/schema.sql:522` → `get_ranking(p_cidade, p_uf, p_limit, p_esporte)` (4 args)
- `supabase/migration_features_v2.sql:74` → `get_ranking(..., p_posicao)` (5 args)

`schema.sql:516-519` só dá DROP em assinaturas antigas; **não remove a versão de 5 args**. O frontend chama com 4 parâmetros nomeados (`src/lib/supabase.js:46-63`). Risco de ambiguidade no PostgREST (PGRST203) e ordenação divergente (v2 usa `score_confianca`).

### A3. RPCs administrativas sem checagem de role
`supabase/migration_master.sql`:
- `get_master_stats()` (linha 82) — `SECURITY DEFINER`, **sem verificação de role**.
- `get_city_stats()` (linha 123) — idem.

As demais RPCs (ex.: `admin_get_users`, linha 178) validam `role IN ('master','admin')`. Essas duas vazam métricas internas para qualquer usuário autenticado.

### A4. Trigger de média corrompe dados cross-sport
`atualizar_media_jogador` (`supabase/schema.sql:279`) recalcula a média usando colunas de basquete (`arremesso`, `controle_de_bola`) e filtra apenas por `jogador_id`, **sem `esporte`**. A votação de handebol (`supabase_migration_handebol.sql:149`) insere na **mesma tabela `avaliacoes`** com `finalizacao/passes` (e `total_votos = total_votos + 1` na linha 180). Resultado: médias de handebol sobrescritas com NULLs e `total_votos` contando todos os esportes; risco de unique violation no índice `(avaliador_id, jogador_id)`.

### A5. Upload de avatar — `createBucket` no cliente
`src/lib/supabase.js:260-282`:
- cria o bucket público `avatars` a cada upload;
- sem validação de tipo/tamanho;
- `fileExt` derivado do nome do arquivo sem sanitização.

---

## 🟠 Média

### M1. Relatórios do Master sempre vazios (chaves EN vs PT)
`get_master_reports` retorna `users_by_month`, `players_by_city`, `month`, `count` (`migration_master.sql:404-466`), mas `src/pages/AdminReports.jsx:179-184` lê `usuarios_por_mes`, `jogadores_por_cidade` e usa `labelKey="mes"`.
**Resultado:** a tela de Relatórios nunca mostra dados.

### M2. `get_city_stats` não retorna `uf`
A RPC devolve só `cidade, user_count, player_count, tournament_count, match_count` (`migration_master.sql:123-130`), mas `src/pages/AdminCities.jsx:37,144` usa `c.uf` → UF sempre "—" e o filtro por UF não funciona.

### M3. RPC órfã e acesso direto no admin de jogadores
`admin_get_players()` é definida (com guarda de role) mas nunca usada; `src/lib/supabase.js:621-634` consulta a tabela `jogadores` diretamente, sem paginação.

### M4. Cidade/UF/esporte fixos
`Jogos.jsx:250-251` (`cidade: 'Altamira', uf: 'PA'`), `Jogos.jsx:110`, `AuthContext.jsx:206,295,332`, `Torneios.jsx:192`, `Racoes.jsx:87` (`esporte: 'basquete'`).

### M5. Sincronização do placar a cada segundo
`src/pages/Torneios.jsx:1546-1555` faz `upsert`/`update` no Supabase a cada tick do cronômetro (a cada 1s), por jogo aberto.

### M6. Fallback update→upsert pode criar/regravar perfil
`src/lib/supabase.js:238-247` — o upsert mascara falha de RLS/UPDATE e pode inserir profile. A auto-criação de jogador roda no cliente com lock só em memória (`AuthContext.jsx:151-240`).

### M7. Arquivos gigantes e duplicação de UI
`Torneios.jsx` (~2463 linhas / 110 KB), `global.css` (~1877 linhas / 71 KB, 247 `!important`), `Stats.jsx` 47 KB, `Jogos.jsx` 54 KB. Console de placar/cronômetro duplicado entre `Torneios.jsx` e `Jogos.jsx`.

### M8. Service worker com versão divergente
`public/sw.js:1` usa cache `v17`; `src/App.jsx:30` usa `swVersion = 'v18'` e desregistra o SW na mudança. Cache-first pode servir bundle antigo após deploy.

### M9. RLS permissiva
`schema.sql:228` `jogadores_select_all FOR SELECT USING (TRUE)`; `schema.sql:220` `profiles_select_all USING (TRUE)` (expõe `email`, `role`, `is_active`). Estatísticas misturam todos os esportes.

### M10. Erros silenciosos / logs de debug
`src/lib/authUser.js:8-24` (`catch (_) {}`), `Home.jsx:49-51`, `Destaques.jsx:90-92`, `AdminLogs.jsx:91-92`; `console.log` em `AuthContext.jsx:168,181,223,230`.

---

## 🟡 Baixa

- **B1. Código morto de handebol:** `EsporteContext.jsx:9` fixa `basquete` e `setEsporte` é no-op; ainda há ramos de handebol em `AnimatedBackgrounds.jsx`, `Icons.jsx:323`, `Torneios.jsx`, `Atletas.jsx:223`, `PlayerProfileModal.jsx:153` e a RPC `registrar_avaliacao_handebol`.
- **B2. Acessibilidade:** cartões `div onClick` sem `role`/`tabIndex`/keydown (`Home.jsx:306`, `NotificationsPanel.jsx:130`); SVGs sem `aria-hidden`; inputs de busca sem `aria-label`.
- **B3. Sem recorte por esporte** em `get_city_stats`/`get_master_stats`.
- **B4. Android:** `capacitor.config.ts:26` usa `android.allowMixedContent: true`, contradizendo `usesCleartextTraffic="false"` do manifest.
- **B5. Credenciais:** `.env.local` contém URL + chave publicável reais (corretamente no `.gitignore`). A anon key é pública por design; a proteção depende de RLS bem configurada (ver M9).
- **B6. Diversos:** regra de `score_confianca` duplicada (front `src/lib/ranking.js` vs RPC); `manifest.json` `id: com.rankshoops.app` ≠ `capacitor.config.ts` `appId: com.rankhooper.app`; `MasterDashboard.jsx:67` faz polling a cada 15s sem pausar em background.

---

## ✔ Verificado OK
- Sem `dangerouslySetInnerHTML` em `src/`.
- Credenciais do Supabase não estão mais hardcoded em `src/lib/supabase.js` (usa `process.env` + throw se ausentes).
- `Torneios.jsx` **não** é código morto (renderizado via `Jogos.jsx`).
- `network_security_config.xml`: sem cleartext.
- Guardas de role corretas em `admin_get_users`, `admin_set_role`, `admin_toggle_user_active`, `admin_delete_user`, `get_master_reports`, `admin_get_logs`.

---

## Mapa de risco dos SQL (`supabase/`)

Ordem sugerida, com conflitos:

| Arquivo | Papel | Conflito |
|---|---|---|
| `schema.sql` | base: tabelas, RLS, `registrar_avaliacao`, `get_ranking` (4 args), trigger média | insere em `auditoria_votos` |
| `schema_tournaments.sql` | torneios/equipes/jogos | policies `FOR ALL` coexistem com as do schema |
| `migration_master.sql` | RPCs admin | `get_master_stats`/`get_city_stats` sem role; `admin_get_players` órfã |
| `migration_features_v2.sql` | redefine `get_ranking` (5 args) + `racoes` | **overload** com o schema |
| `supabase_migration_handebol.sql` | votação handebol | trigger de média corrompe; código desativado |
| `migration_cleanup.sql` | DROP `votos`/`auditoria_votos` | **quebra `registrar_avaliacao`** |
| `fix_*.sql` | FK `criado_por` | par fix/desfix — estado final indefinido |

---

## Priorização sugerida
1. **A1** e **A4** — antes de qualquer deploy/execução de SQL.
2. **A3** e **A5** — segurança.
3. **A2 / M1 / M2** — contratos de RPC e telas admin quebradas.
4. **M5 / M7 / M8** — performance e manutenibilidade.

---

## ✅ Correções aplicadas (2026-10-16)

Arquivos alterados/criados nesta rodada:

- **`supabase/migration_rls_hardening.sql`** (novo) — cobre:
  - **A3** (parcial): `get_master_stats` e `get_city_stats` agora exigem `role IN ('master','admin')`; execução de funções do schema `public` revogada de anônimos.
  - **M9**: policies de SELECT migradas de `USING (TRUE)` (papel `public`, incluía `anon`) para `TO authenticated`; `auditoria_votos` sem leitura; `REVOKE ALL ... FROM anon`.
  - **PII**: `email` + `latitude/longitude/latitude_atual/longitude_atual` de `profiles` revogadas de `authenticated` (leitura por coluna).
  - Escritas por posse em `jogadores`, `jogos`, `partidas` (coluna `criado_por` adicionada) e `rações` (removido o `OR auth.role() = 'authenticated'`).
- **`src/lib/supabase.js`** — `PROFILE_SAFE_COLUMNS` + consultas de `profiles` sem `select('*')`; **A5** corrigido (`createBucket` removido do cliente, validação de tipo/tamanho no upload).
- **`src/contexts/AuthContext.jsx`**, **`src/components/Layout.jsx`**, **`src/components/CompleteProfileScreen.jsx`** — email lido da sessão de auth, não mais de `profiles`.

Ainda **pendentes** (não alterados): **A1** (conflito `migration_cleanup` × `registrar_avaliacao`), **A2** (overload `get_ranking`), **A4** (trigger de média × handebol), **M1/M2** (chaves EN/PT e `uf` ausente), **M5/M7/M8**.

### Correção de UI — modais atrás da barra de navegação

Os modais de página (ex.: "Finalizar Jogo" em `Jogos.jsx`, registrar avaliação em `Stats.jsx`, etc.) ficavam **embaixo da barra inferior** e o botão de confirmar não aparecia.

Causa: as páginas renderizam os modais dentro de `.page-content`, que cria um **contexto de empilhamento** (`z-index:1`); a barra `.bottom-nav` tem `z-index:100`, então o overlay (mesmo com `z-index:150`) ficava preso abaixo dela.

Correções:

- **`src/components/Layout.jsx`** — o contêiner das páginas recebeu `zIndex: 120` (acima da barra, que é `100`), garantindo que qualquer modal da página fique acima da navegação.
- **`src/styles/global.css`** — `.modal-sheet` ganhou `padding-bottom: calc(14px + env(safe-area-inset-bottom))` para o botão não colar na borda/área segura do aparelho.
