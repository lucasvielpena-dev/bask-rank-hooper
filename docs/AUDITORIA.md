# 🔎 Auditoria de código — Rank Hooper

Data: 2026-10-16
Escopo: `bask-rank-hooper-main` (frontend React + SQL Supabase). Auditoria somente leitura.
Observação: itens de severidade Alta foram verificados diretamente no código-fonte.

---

## 🛡️ Auditoria de segurança no banco de produção (2026-10-17)

Diferente das demais seções (leitura de código), esta foi feita **batendo no banco real** com a chave pública que vai no bundle do site — exatamente o que um curioso tem em mãos. Correção: `supabase/migration_seguranca_v3.sql`.

**Status (2026-10-17): ✅ APLICADO no banco de produção.** Confirmado por sonda anônima depois do deploy: `rotina_semanal_domingo()`, `admin_get_users()`, `admin_get_players()`, `admin_get_logs()`, `get_master_stats()`, `get_master_reports()` e `get_city_stats()` respondem `permission denied for function` (antes **executavam**); `profiles` e `avaliacoes_jogo` seguem `42501`; verificação `has_*_privilege` retornou `false` em tudo, exceto `authenticated → touch_last_seen` (que o app precisa). Na mesma data foram aplicadas as pendentes `migration_nota_jogo_na_media.sql` (colunas `total_notas_jogo`/`media_notas_jogo`/`total_votos_estrelas` confirmadas) e `migration_exclusao_conta.sql` (RPC `excluir_minha_conta()` existe e está negada ao anônimo).

**Confirmado OK (com prova):**
- Anônimo não lê nenhuma tabela: `42501 permission denied` em todas as 19 testadas.
- `email` e GPS de `profiles` escondidos de quem está logado (Passo 2 do hardening rodou — comprovado indiretamente: `partidas.criado_por`, criada no Passo 3, existe; o Passo 2 vem antes).
- `avaliacoes_jogo` fechada e seus RPCs revogados do anônimo (`permission denied for function`).
- Sem `CREATE VIEW` (vetor clássico de RLS bypass), sem bucket público, RLS ligada em todas as tabelas.
- `registrar_avaliacao` exige `auth.uid()` (e usa `auth.uid()`, não parâmetro) → anônimo não vota.
- **A3 resolvido:** `get_master_stats`/`get_city_stats` agora validam role (testado: retornam "Acesso negado", não dados).

**Brechas encontradas e corrigidas:** ver `supabase/migration_seguranca_v3.sql` (Passos 1–4).

### S1. Anônimo executa RPCs (o `REVOKE ... FROM PUBLIC` do hardening não bastou)
`migration_rls_hardening.sql:339` faz `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC`. Mas o Supabase concede EXECUTE **explicitamente ao papel `anon`** ao criar a função, e isso não é tirado por um revoke em `PUBLIC`.
Prova: `POST /rest/v1/rpc/get_master_stats` (SECURITY DEFINER) como anônimo → `P0001 "Acesso negado"` (a função **executou**); `admin_get_users`, `get_master_reports`, `admin_get_players`, `admin_get_logs`, `touch_last_seen` e `sortear_jogadores_para_voto` idem. `get_ranking`/`get_status_voto_hoje` também executam e só param na tabela (`permission denied for table jogadores`).
Correção: Passo 1 do `migration_seguranca_v3.sql` (`REVOKE ... FROM anon` + `ALTER DEFAULT PRIVILEGES ... FROM anon`).

### S2. `rotina_semanal_domingo()` sem guarda — anônimo zerava o ranking 🔴
`schema.sql:645`: `SECURITY DEFINER`, sem nenhuma checagem, e o corpo faz `media_estrelas = ROUND(media_estrelas * 0.9, 2)` em **todos** os atletas, zera `votos_semana` e grava campeão. Combinada com S1, qualquer pessoa **sem login** podia chamá-la em loop (0,9^n) e destruir o ranking.
Correção: Passo 2 do `migration_seguranca_v3.sql` (revoga de todos + guarda `auth.uid() IS NOT NULL`).

### S3. Qualquer logado virava `master` e lia o email de todos 🔴
`profiles_update_own` (`schema.sql:222`, mantida pelo hardening) só exige `auth.uid() = id`, e `role` é coluna comum da mesma linha — não há restrição por coluna (o Passo 2 do hardening só mexe em SELECT). Com `UPDATE profiles SET role='master'`, o painel admin inteiro abre: `admin_get_users()` devolve **email de todos** (nome, cidade, uf, role, last_seen), `admin_delete_user()` apaga contas, `admin_send_global_notification()` manda notificação para todos.
Correção: Passo 3 do `migration_seguranca_v3.sql` (gatilho `trg_proteger_campos_admin`).

### S4. Votos de estrela não eram anônimos 🟠
`avaliacoes_select_auth USING (TRUE)` (`migration_rls_hardening.sql:54`) deixava qualquer logado ler a tabela inteira — `avaliador_id` + `comentario` → dá para montar "quem votou em quem, com que nota". O app só lê as próprias avaliações (`Atletas.jsx:150`, `PlayerProfileModal.jsx:155`).
Correção: Passo 4 do `migration_seguranca_v3.sql` (policy passa a `avaliador_id = auth.uid()`).

### S5. Pendência de decisão 🟠
`jogadores`/`partidas` aceitam UPDATE de qualquer logado quando `criado_por IS NULL` (cláusula de transição do hardening, `migration_rls_hardening.sql:197,231`). Atletas antigos sem dono são editáveis por qualquer um — inclusive `media_estrelas`. O Passo 5 do `migration_seguranca_v3.sql` (comentado) traz o backfill + a policy estrita, para aplicar quando quiser.

### S6. Baixa
Signup aberto (`disable_signup: false`) e sem CAPTCHA → contas falsas para brigada de votos. Mitigado por `UNIQUE(avaliador_id, jogador_id)` + limite de 20/dia. Login anônimo **desligado** ✔; sem buckets públicos ✔.

### Bug funcional achado de passagem
`sortear_jogadores_para_voto()` (`schema.sql:586`) quebra sempre com `42702 column reference "id" is ambiguous`: o `RETURNS TABLE` declara `id`/`uf` como parâmetros de saída e o corpo usa `WHERE id = auth.uid()`. O frontend não chama essa RPC (dead code) — mas se religar, precisa qualificar (`profiles.id`).

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

> **✅ Mitigado (2026-10-16):** o `migration_features_v2.sql` foi **neutralizado** (virou aviso; não executa mais SQL). As rações agora vêm de `migration_racoes.sql`, que **não** toca em `get_ranking`. Se a versão de 5 args já tiver sido criada no banco, rode o bloco abaixo no SQL Editor para removê-la:
> ```sql
> DROP FUNCTION IF EXISTS public.get_ranking(text, text, integer, text, text);
> ```

### A3. RPCs administrativas sem checagem de role
`supabase/migration_master.sql`:
- `get_master_stats()` (linha 82) — `SECURITY DEFINER`, **sem verificação de role**.
- `get_city_stats()` (linha 123) — idem.

As demais RPCs (ex.: `admin_get_users`, linha 178) validam `role IN ('master','admin')`. Essas duas vazam métricas internas para qualquer usuário autenticado.

### ~~A4. Trigger de média corrompe dados cross-sport~~ ✅ resolvido (2026-10-17)
`atualizar_media_jogador` (`supabase/schema.sql:279`) recalculava a média usando colunas de basquete (`arremesso`, `controle_de_bola`) e filtrava apenas por `jogador_id`, **sem `esporte`**. A votação de handebol (`supabase_migration_handebol.sql:149`) insere na **mesma tabela `avaliacoes`** com `finalizacao/passes` (e `total_votos = total_votos + 1` na linha 180). Resultado: médias de handebol sobrescritas com NULLs e `total_votos` contando todos os esportes; risco de unique violation no índice `(avaliador_id, jogador_id)`.

**Resolvido** em `supabase/migration_nota_jogo_na_media.sql`: a recalculadora unificada `recalcular_media_jogador` sai cedo quando `esporte <> 'basquete'`, então o gatilho de basquete não encosta mais em linhas de handebol. Como o handebol está desativado no app (`EsporteContext` fixa `basquete`), hoje o ramo nem é alcançado; o guard fica como rede de proteção caso o esporte seja religado um dia (a média de handebol continuaria sob responsabilidade da RPC `registrar_avaliacao_handebol`).

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

- **B1. ~~Código morto de handebol~~ ✅ resolvido (2026-10-17):** ramos removidos de `AnimatedBackgrounds.jsx` (−43% do arquivo: 27,7 kB → 15,9 kB, incluindo o import de `useEsporte`), `Icons.jsx` (`IconHandebol` excluído; `IconSportDynamic` virou atalho de `IconBasquete`), `Torneios.jsx` (rótulos e tabela de stats), `Atletas.jsx` e `PlayerProfileModal.jsx` (o `apiVoto` ternário) e `src/lib/supabase.js` (`votacaoHandebolAPI`). `EsporteContext.jsx` continua fixando `basquete` — isso é intencional (app exclusivo de basquete). No banco sobram apenas colunas ociosas (`finalizacao`, `passes`, `media_finalizacao`, `media_passes`) e a RPC `registrar_avaliacao_handebol`, mantidas como saída de emergência.
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
| `migration_features_v2.sql` | ⚠️ **OBSOLETO** — não executa SQL (aviso no topo) | substituído por `migration_racoes.sql` |
| `migration_racoes.sql` | cria `racoes` + `racao_participantes` com RLS endurecida | **sem** o overload de `get_ranking` |
| `supabase_migration_handebol.sql` | votação handebol | desativado no app; média protegida pelo guard de esporte (A4 ✅) |
| `migration_cleanup.sql` | DROP `votos`/`auditoria_votos` | **quebra `registrar_avaliacao`** |
| `fix_*.sql` | FK `criado_por` | par fix/desfix — estado final indefinido |

---

## Priorização sugerida
1. **A1** — antes de qualquer deploy/execução de SQL. (**A4** ✅ resolvido em 2026-10-17.)
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

Ainda **pendentes** (não alterados): **A1** (conflito `migration_cleanup` × `registrar_avaliacao`), **M1/M2** (chaves EN/PT e `uf` ausente), **M5/M7/M8**. (**A2** mitigado — ver acima. **A4** e **B1** resolvidos em 2026-10-17.)

### Correção de UI — modais atrás da barra de navegação

Os modais de página (ex.: "Finalizar Jogo" em `Jogos.jsx`, registrar avaliação em `Stats.jsx`, etc.) ficavam **embaixo da barra inferior** e o botão de confirmar não aparecia.

Causa: as páginas renderizam os modais dentro de `.page-content`, que cria um **contexto de empilhamento** (`z-index:1`); a barra `.bottom-nav` tem `z-index:100`, então o overlay (mesmo com `z-index:150`) ficava preso abaixo dela.

Correções:

- **`src/components/Layout.jsx`** — o contêiner das páginas recebeu `zIndex: 120` (acima da barra, que é `100`), garantindo que qualquer modal da página fique acima da navegação.
- **`src/styles/global.css`** — `.modal-sheet` ganhou `padding-bottom: calc(14px + env(safe-area-inset-bottom))` para o botão não colar na borda/área segura do aparelho.

### Correção de runtime — tabela `racoes` inexistente

Erro em produção: `Could not find the table 'public.racoes' in the schema cache`. A tabela nunca foi criada (o `migration_features_v2.sql` que a criava não foi rodado — e não deve ser).

Correções:

- **`supabase/migration_racoes.sql`** (novo) — cria `racoes` + `racao_participantes` (e a coluna `avaliacoes.racao_id`) **sem** tocar em `get_ranking`, já com RLS endurecida (`TO authenticated`, posse do dono). Inclui a coluna `racoes.jogador_id`, que o frontend (`racoesAPI.criar`) envia no INSERT. Idempotente.
- **`supabase/migration_features_v2.sql`** — **neutralizado** (virou aviso; não executa SQL), para não recriar o overload nem reabrir leitura anônima.
- **`supabase/migration_rls_hardening.sql`** — tornado **reexecutável** (`DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`) e as partes de rações agora só rodam se as tabelas existirem.
- **`src/pages/Racoes.jsx`** — a mensagem de erro passou a indicar `migration_racoes.sql`.
