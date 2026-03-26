# CLAUDE.md — df-elector-pulse

> Arquivo de referência para o Claude Code. Atualizado a cada sprint/mudança.
> **Última atualização:** 2026-03-26 | **Sprint atual:** Sprint 02 — Concluída

---

## 📋 Visão Geral do Projeto

**Nome:** df-elector-pulse
**Repositório:** https://github.com/Sveci/df-elector-pulse
**Descrição:** Dashboard de monitoramento eleitoral do Distrito Federal (DF) — "pulso" em tempo real de dados eleitorais com mapas, gráficos, relatórios e analytics.

---

## 🏗️ Arquitetura & Stack

### Frontend (Lovable)
| Tecnologia | Versão | Uso |
|---|---|---|
| React | ^18.3.1 | UI Framework |
| TypeScript | ^5.8.3 | Tipagem estática |
| Vite | ^5.4.19 | Build tool + Dev server |
| Tailwind CSS | ^3.4.17 | Estilização utility-first |
| shadcn/ui (Radix) | Múltiplos | Componentes base |
| React Router DOM | ^6.30.3 | Roteamento SPA |
| TanStack React Query | ^5.83.0 | Gerenciamento de estado server-side |
| Recharts | ^2.15.4 | Gráficos e visualizações |
| Leaflet + React-Leaflet | ^1.9.4 / ^4.2.1 | Mapas interativos |
| leaflet.heat | ^0.2.0 | Heatmaps geográficos |
| @xyflow/react | ^12.10.1 | Diagramas de fluxo |
| Framer Motion | ^12.35.2 | Animações |
| React Joyride | ^2.9.3 | Onboarding/tours guiados |
| React Markdown | ^10.1.0 | Renderização Markdown |

### Backend (Supabase via Claude Code)
| Tecnologia | Uso |
|---|---|
| Supabase | BaaS — Auth, Database, Storage, Realtime |
| PostgreSQL | Banco de dados principal |
| PLpgSQL (9.3% do código) | Functions, triggers, RLS policies |
| Supabase JS Client | ^2.58.0 |

### Geração de Documentos
| Lib | Uso |
|---|---|
| ExcelJS | ^4.4.0 — Exportação Excel |
| jsPDF | ^4.2.1 — Geração de PDF |
| JSZip | ^3.10.1 — Compactação de arquivos |
| QRCode | ^1.5.4 — Geração de QR Codes |

### Testes
| Ferramenta | Uso |
|---|---|
| Playwright | ^1.57.0 — E2E testing |

### DevOps
| Item | Detalhe |
|---|---|
| Package Manager | npm (com bun.lock também presente) |
| Node.js | >=20.0.0 |
| Linter | ESLint ^9.32.0 |
| Deploy Frontend | Lovable (Share → Publish) |
| Deploy Backend | Supabase Dashboard / CLI |

---

## 📂 Estrutura de Diretórios

```
df-elector-pulse/
├── .lovable/           # Configurações do Lovable
├── docs/               # Documentação do projeto
├── public/             # Assets estáticos
├── src/                # Código-fonte principal (React/TS)
│   ├── components/     # Componentes reutilizáveis
│   ├── pages/          # Páginas/rotas
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilitários e clients (Supabase, etc.)
│   ├── types/          # Tipagens TypeScript
│   └── ...
├── supabase/           # Configuração Supabase
│   ├── migrations/     # Migrações SQL do banco
│   ├── functions/      # Edge Functions (se existirem)
│   └── config.toml     # Config do Supabase CLI
├── CLAUDE.md           # ← ESTE ARQUIVO
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── playwright.config.ts
└── ...
```

---

## 🔄 Workflow de Desenvolvimento

### Plataformas
- **Lovable** → Frontend (UI, componentes, páginas, estilização)
- **Claude Code** → Backend (Supabase migrations, functions, RLS, types, CLAUDE.md)

### Convenções de Commit
Cada prompt executado no Claude Code deve terminar com:
```bash
git add -A && git commit -m "feat|fix|chore(escopo): descrição curta" && git push origin main
```

### Padrão de Sprints
Toda demanda é dividida em sprints. Cada sprint contém:
1. **Checklist** — tarefas objetivas com ☐/☑
2. **Prompts Lovable** — instruções para o frontend (quando aplicável)
3. **Prompts Claude Code** — instruções para o backend + commit/deploy
4. **Atualização do CLAUDE.md** — ao final de cada sprint

---

## 📊 Histórico de Sprints

### Sprint 02 — Auditoria Completa: Tela Proposições
**Status:** ✅ Concluída
**Data:** 2026-03-26

**Arquivos auditados (código-fonte completo lido):**
- src/pages/Proposicoes.tsx
- src/hooks/proposicoes/useProposicoesMonitoradas.ts
- src/hooks/proposicoes/useAlertasConfig.ts
- src/hooks/proposicoes/useProposicaoDetalhe.ts
- src/components/proposicoes/ProposicaoDrawer.tsx
- src/components/proposicoes/TramitacoesTimeline.tsx
- supabase/migrations/20260325200000_proposicoes_module.sql

**Achados da auditoria:**
1. 🔴 Real-Time AUSENTE — nenhum Supabase channel/subscription existia
2. 🔴 useRunMonitor não invalidava cache — botão "Verificar agora" rodava mas tela não atualizava
3. 🟡 Exclusão de alerta sem confirmação (hard delete direto)
4. 🟡 Sem staleTime nos hooks (refetch desnecessário em cada focus)
5. 🟡 Input de busca oculto com menos de 4 proposições

**O que já funcionava bem:**
- Schema com 4 tabelas bem estruturadas + 10 indexes + RLS completo
- CRUD completo de proposições e alertas
- Integração com API da Câmara e Senado (busca + detalhes + tramitações live)
- Timeline de tramitações com classificação por criticidade
- Cron job via pg_cron a cada 6h
- Alertas WhatsApp (Z-API + Meta Cloud) com log de notificações
- Loading/empty/error states em todas as tabs

**Correções aplicadas:**
- ✅ Supabase Realtime habilitado (INSERT/UPDATE/DELETE) em proposicoes_monitoradas e proposicoes_tramitacoes
- ✅ Hook useProposicoesRealtime criado com cleanup e filtro por tenant_id
- ✅ REPLICA IDENTITY FULL para DELETE events
- ✅ useRunMonitor agora invalida caches de proposições e tramitações
- ✅ AlertDialog de confirmação antes de excluir alertas
- ✅ staleTime configurado (2min proposições, 5min alertas)
- ✅ Input de busca visível com 1+ proposição

**Módulo Proposições — Tabelas:**
| Tabela | Descrição |
|---|---|
| proposicoes_monitoradas | PLs, PECs e proposições acompanhadas |
| proposicoes_tramitacoes | Cache de tramitações detectadas |
| proposicoes_alertas_config | Configuração de alertas WhatsApp |
| proposicoes_notificacoes_log | Log de notificações enviadas |

---

### Sprint 01 — Fix: Reenviar QR Codes (Tenant)
**Status:** ✅ Concluída
**Data:** 2026-03-26

**Problema:** Botão "Reenviar QR Codes" na modal de eventos retornava erro "Tenant não foi identificado"

**Causa raiz:** A função `handleResendQRCodes` em `EventDetailsDialog` buscava o `tenant_id` via `supabase.auth.getSession()` → `user_metadata.tenant_id`, que não existe no JWT. O padrão correto do projeto é usar o hook `useTenantId()`, que lê do `TenantContext` (tabela `user_tenants`).

**Correção:**
- Substituído o lookup incorreto via `user_metadata` pelo hook `useTenantId()` no componente `EventDetailsDialog`
- Adicionado dialog de confirmação antes do reenvio com contagem de inscritos
- Adicionado loading spinner (`Loader2`) e texto "Reenviando..." durante processamento
- Botão desabilitado durante envio + tooltip "Nenhum inscrito para reenviar" quando lista vazia
- Mensagens de erro amigáveis (sem expor detalhes técnicos ao usuário)

**Arquivos alterados:**
- `src/pages/Events.tsx` — import de `useTenantId`, `Tooltip`, `DialogDescription`, `DialogFooter`, `Loader2`; refatoração do handler e botão de reenvio

**Checklist:**
- [x] Diagnóstico da causa raiz
- [x] Correção Frontend (hook `useTenantId` + UX melhorada)
- [x] Testes manuais
- [x] Commit & Deploy

---

### Sprint 0 — Análise Inicial
**Status:** ✅ Concluída
**Data:** 2026-03-26

**Checklist:**
- [x] Mapear estrutura do repositório
- [x] Identificar tech stack completa
- [x] Documentar arquitetura
- [x] Criar CLAUDE.md
- [x] Estabelecer workflow Lovable ↔ Claude Code

---

## 🚀 Próximos Passos

> Aguardando definição da próxima demanda para criar Sprint 2.

---

## ⚠️ Notas Importantes

1. **Supabase Types:** Sempre regenerar tipos após alterações no schema:
   ```bash
   npx supabase gen types typescript --project-id <ID> > src/types/supabase.ts
   ```

2. **Lovable Sync:** Mudanças feitas via Lovable são commitadas automaticamente. Mudanças via Claude Code/IDE também refletem no Lovable.

3. **Variáveis de Ambiente:** Ver `.env.example` para as variáveis necessárias.

4. **Node.js:** Requer versão >=20.0.0 (ver `.nvmrc`).

---

*Este arquivo é a fonte de verdade para o Claude Code neste projeto.*