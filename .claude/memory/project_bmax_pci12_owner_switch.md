---
name: project-bmax-pci12-owner-switch
description: "PCI12: seletor de caminho liberado pra representante/admin + troca automática de responsável no RD (48h) enquanto pendente"
metadata:
  node_type: memory
  type: project
  modified: 2026-09-14T21:40:00.000Z
  originSessionId: 87fa48d5-0558-4034-9609-8fbcde3f3b32
---

## Seletor de caminho PCI12 liberado pra representante/admin (14/09/2026, commit `9205d9c`)

Antes só `role==="revenda"` podia escolher o caminho (BOX>REV / BOX+REV>IND) — checagem em 3 pontos: middleware `authorize(["revenda"])` na rota `POST /api/leads/pci` (`leads.routes.js`), checagem redundante no controller (`leads.controller.js`), e gate no front (`leads.js`, condição de exibição do seletor no card). Os 3 foram atualizados pra aceitar `["revenda", "representante", "adm"]`.

`aplicarCaminhoVenda()` (`caminhoVenda.service.js`) já era agnóstico de role — não precisou mudar. `AuditLog` já registra `req.user.role`, então dá pra saber depois quem selecionou em nome da revenda.

**Por que não tem risco de "travar":** todas as escritas do Portal no RD Station usam um único token de integração (`RD_CRM_TOKEN`, não OAuth por usuário) — o RD não distingue quem no Portal disparou a chamada. Isso já era assim pra toda ação do Portal, não é algo introduzido por essa mudança.

## Fix de normalização de PCI (defensivo)

`pci` em `rd.leads.service.js:mapDealToCard` agora sempre `.toUpperCase()` na origem (antes só removia espaço); front (`leads.js`) usa `normalizePci()` também no gate do seletor PCI12 (antes um dos dois pontos comparava string crua sem normalizar). **Não era a causa raiz** do caso investigado (lead Fabio Alessandro não mostrava o seletor) — a causa real era o usuário estar logado como **representante**, que na época não tinha permissão nenhuma de ver o seletor (ver seção acima). Mantido como melhoria defensiva.

## Troca automática de responsável durante PCI12 pendente — regra de 48h (14/09/2026, commit `ad423a0`)

Regra definida por André (14/09/2026): quando um lead vira PCI12 pendente, o responsável no RD Station passa a ser o André (`RD_OWNERS["Revenda"]` = `67efe9d367f94d002a8c4929`, já era usado assim desde 11/09/2026 por pedido dele) até a revenda escolher o caminho, **ou até 48h sem resposta** — nesse caso o responsável original (quem tinha o lead antes) é restaurado automaticamente.

### Implementação

- **Tabela nova** `bmax_pci12_tracking` (Postgres boxer-bmax): `deal_id` (PK), `owner_original_id`, `owner_original_nome`, `detectado_em`, `email_24h_enviado_em`, `revertido_em`, `resolvido_em`. Service: `src/services/pci12Tracking.service.js` (raw SQL via sequelize, mesmo padrão de `saldo.service.js` — não é um Model Sequelize).
- **Detecção**: dentro do cron diário já existente `sync-revenda-rep-rd` (`app.js`), no mesmo loop que já varria PCI12 pendentes pra mandar o e-mail imediato. Pra cada pendente: lê o owner atual do deal (`d.user._id`/`.name`), registra no tracking (`registrarTroca`, idempotente via `INSERT ... ON CONFLICT DO NOTHING RETURNING` — só troca o owner de verdade se o INSERT realmente aconteceu) e chama `updateLead(dealId, {data:{owner_id: RD_OWNERS["Revenda"]}})`.
- **Roda pra TODO pendente**, inclusive os que já estavam parados antes dessa feature existir — não depende mais do snapshot `pci12_leads_avisados` (que agora só controla se o e-mail imediato já foi mandado, não mais o tracking/troca de owner).
- **Cron novo** `/api/cron/pci12-followup`, 4x/dia (09/13/17/21h UTC — Vercel Hobby só permite 1x/dia por `schedule`, daí múltiplas entradas em `vercel.json`, mesmo padrão de `recalcular-comissoes`):
  - **≥24h sem resolver e sem e-mail 24h ainda:** manda lembrete pra revenda **e** representante (mesma lógica de busca de e-mail do aviso imediato), marca `email_24h_enviado_em`.
  - **PCI atual ≠ "PCI12"** (já resolveu, detectado via `getDealById` fresco): marca `resolvido_em`, não faz mais nada com esse deal (self-heal — cobre o caso de `aplicarCaminhoVenda` não ter marcado por algum motivo).
  - **≥48h sem resolver:** `updateLead(dealId, {data:{owner_id: owner_original_id}})`, marca `revertido_em`.
- `aplicarCaminhoVenda()` agora chama `marcarResolvido(dealId)` assim que o `updateLead` de resolução roda — não precisa reverter nada nesse ponto, porque esse mesmo `updateLead` já atribui o responsável certo via `lerPlanilhaResponsavel` (a função de resolução de responsável geográfico que já existia, usada pros dois caminhos 12A e 12B).

### Escopo — decisão confirmada por André (14/09/2026)

O tracking só pega leads que `getLeads("admin","adm")` retorna: pipeline Indústria Interno, criados a partir de 01/05/2026, excluindo Perdido/Excluído — **o mesmo recorte que já aparece pro Portal**. Ao disparar manualmente pela primeira vez (`vercel crons run`), só 3 leads entraram no tracking (Fabio Alessandro, Ezequiel/ESM, Huoli), bem menos que os ~20 PCI12 "esquecidos" achados numa investigação anterior via varredura direta da API RD (que não tinha esse filtro de pipeline/data). **André confirmou que está correto ficar assim** — não faz sentido trocar responsável de um lead que a revenda nem consegue ver/agir pelo Portal. Não é bug a corrigir; é o comportamento pretendido.

### Verificação ao vivo

- Funções de `pci12Tracking.service.js` testadas contra o Postgres de produção com deal_ids fictícios (inseridos e removidos depois) — insert idempotente, select, updates de marcação, tudo confirmado.
- Endpoint `/api/cron/pci12-followup` testado local contra deal inexistente (erro tratado, loop não quebra) e contra deal real (0h decorridas, sem disparo indevido).
- Disparo real via `vercel crons run /api/cron/sync-revenda-rep-rd` (14/09/2026, ~21:33 UTC) — confirmado direto no RD que os 3 leads pendentes tiveram `user` trocado pra André Coelho (`67efe9d367f94d002a8c4929`).

**Why:** vendedores Boxer classificam o lead como PCI12 e "somem" — sem ninguém de fato acompanhando enquanto a revenda não responde. Centralizar em André nesse meio-tempo garante acompanhamento ativo; devolver às 48h evita que o lead fique perdido em uma fila que ninguém revisita.

**How to apply:** qualquer mudança na regra de prazo (hoje 48h) ou na cadência de lembrete (hoje 24h, uma vez) mexe em `pci12-followup` (app.js) e possivelmente nos horários em `vercel.json`. Qualquer mudança em quem pode escolher o caminho do PCI12 mexe nos 3 pontos: `leads.routes.js`, `leads.controller.js`, `leads.js` (front).
