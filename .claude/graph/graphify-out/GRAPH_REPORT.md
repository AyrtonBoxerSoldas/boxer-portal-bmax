# Graph Report - graph  (2026-08-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 527 nodes · 935 edges · 26 communities (22 shown, 4 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 89 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7edafc85`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- rd.leads.service.js
- admin.js
- export.routes.js
- users.controller.js
- cashback.routes.js
- dependencies
- src/app.js
- cashback.js
- package.json
- admin.routes.js
- index.js
- leads.js
- utils.js
- config.routes.js
- server.js
- auth.controller.js
- audit.js
- vercel.json
- responsavel.service.js
- negociacoes.js
- { Sequelize }
- resend.service.js
- Negociacao.js
- hash-password.js
- renovar_msal_ci.py

## God Nodes (most connected - your core abstractions)
1. `rdFetch()` - 17 edges
2. `createUser()` - 15 edges
3. `updateLeadPci()` - 13 edges
4. `{ Sequelize }` - 13 edges
5. `getLeads()` - 12 edges
6. `AuditLog()` - 11 edges
7. `refreshCashback()` - 11 edges
8. `getCustomField()` - 10 edges
9. `criarUsuario()` - 9 edges
10. `createFilial()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `updateLeadPci()` --calls--> `sendEmail()`  [EXTRACTED]
  src/controllers/leads.controller.js → src/services/email.service.js
- `updateLeadPci()` --calls--> `lerPlanilhaResponsavel()`  [EXTRACTED]
  src/controllers/leads.controller.js → src/services/responsavel.service.js
- `updateLeadResultado()` --calls--> `creditarCashback()`  [EXTRACTED]
  src/controllers/leads.controller.js → src/services/saldo.service.js
- `create()` --calls--> `createNegociacao()`  [EXTRACTED]
  src/controllers/negociacao.controller.js → src/services/negociacao.service.js
- `createNegociacao()` --calls--> `sendEmail()`  [EXTRACTED]
  src/services/negociacao.service.js → src/services/email.service.js

## Import Cycles
- None detected.

## Communities (26 total, 4 thin omitted)

### Community 0 - "rd.leads.service.js"
Cohesion: 0.06
Nodes (64): ESTADOS, RD_CF_SLUG_MAP, RD_CUSTOM_FIELDS, RD_OWNERS, RD_STAGES, RD_STAGES_EXCLUIDOS_REVENDAS, REPRESENTANTES, REVENDA_INVALIDOS (+56 more)

### Community 1 - "admin.js"
Cohesion: 0.07
Nodes (44): addFilialField(), ADMIN_ALERTAS, ADMIN_REPS_BMAX, ADMIN_REV_BMAX, ADMIN_REVENDAS, ADMIN_USERS, closeAdminModal(), COB_DATA (+36 more)

### Community 2 - "export.routes.js"
Cohesion: 0.07
Nodes (34): list(), { listAuditUsers, listAuditLogs }, users(), { AuditLog }, create(), {
    createNegociacao,
    listNegociacoes
}, list(), AuditLog (+26 more)

### Community 3 - "users.controller.js"
Cohesion: 0.10
Nodes (38): login(), { AuditLog }, bcrypt, clean(), createFilial(), createUser(), db, deleteFilial() (+30 more)

### Community 4 - "cashback.routes.js"
Cohesion: 0.10
Nodes (37): { authenticate, authorize }, express, { getLeads, mapDealToCard, getCustomField }, { getRepresentativeEmailByName }, { getSaldo, getSaldoGrupo, getExtrato, getExtratoGrupo, getCreditosProximosVencimento, getCreditosProximosVencimentoGrupo, processarExpirados, getExpirandoEm, creditarCashback, getSaldoRep, getExtratoRep, getCreditosExpirandoRep, getRepRevendas }, { lerPlanilhaCashback }, router, { sendEmail } (+29 more)

### Community 5 - "dependencies"
Cohesion: 0.06
Nodes (35): bcryptjs, cors, dotenv, exceljs, express, helmet, jsonwebtoken, multer (+27 more)

### Community 6 - "src/app.js"
Cohesion: 0.06
Nodes (29): adminRoutes, ALLOWED_ORIGINS, app, auditRoutes, authRoutes, cashbackRoutes, configRoutes, cors (+21 more)

### Community 7 - "cashback.js"
Cohesion: 0.11
Nodes (29): init(), login(), logout(), populateConfigSelects(), SCREENS, session, setDashHeader(), setLoginLoading() (+21 more)

### Community 8 - "package.json"
Cohesion: 0.11
Nodes (17): nodemon, author, description, devDependencies, nodemon, engines, node, keywords (+9 more)

### Community 9 - "admin.routes.js"
Cohesion: 0.13
Nodes (16): { authenticate, authorize }, bcrypt, express, fetchAllCobertura(), fetchAllRevendasAtivas(), { getLeads, getCustomField, syncRevendasToRD, syncRepresentantesToRD, renomearRepresentanteNoRD }, { invalidateConfigCache }, multer (+8 more)

### Community 10 - "index.js"
Cohesion: 0.12
Nodes (12): createAuditLogModel, createNegociacaoModel, createRepresentanteModel, createRevendaFilialModel, createRevendaModel, createUserModel, dotenv, RevendaFilial (+4 more)

### Community 11 - "leads.js"
Cohesion: 0.23
Nodes (11): API_LEADS, hideSkeleton(), LEADS_SEM_REVENDA, loadLeads(), render(), renderGrid(), retryLoad(), setupFilter() (+3 more)

### Community 12 - "utils.js"
Cohesion: 0.15
Nodes (3): esc(), toast(), TOAST_ICONS

### Community 13 - "config.routes.js"
Cohesion: 0.16
Nodes (13): PCI_POR_CAMINHO, RESPONSAVEIS, CAMINHOS, express, fetchRepresentantesBmax(), fetchRevendasBmax(), invalidateConfigCache(), PCIS (+5 more)

### Community 14 - "server.js"
Cohesion: 0.20
Nodes (8): REQUIRED, REQUIRED_DB, validateEnv(), app, express, path, { sequelize }, { validateEnv }

### Community 15 - "auth.controller.js"
Cohesion: 0.18
Nodes (9): { sequelize, User, Representante, Revenda, RdToken, Negociacao }, { AuditLog }, bcrypt, jwt, { User, Revenda }, Negociacao, Representante, Revenda (+1 more)

### Community 16 - "audit.js"
Cohesion: 0.33
Nodes (7): AUDIT_LOGS, AUDIT_USERS, initAuditLogs(), loadAuditLogs(), loadAuditUsers(), renderAuditLogs(), renderAuditPagination()

### Community 17 - "vercel.json"
Cohesion: 0.25
Nodes (7): maxDuration, crons, functions, api/**/*.js, outputDirectory, rewrites, version

### Community 18 - "responsavel.service.js"
Cohesion: 0.33
Nodes (6): fs, jsonPath, lerPlanilhaResponsavel(), loadData(), path, xlsxPath

### Community 19 - "negociacoes.js"
Cohesion: 0.67
Nodes (3): loadNegociacoes(), negociacoes, renderNegociacoes()

### Community 21 - "resend.service.js"
Cohesion: 0.83
Nodes (3): sendEmail(), sendForgotPasswordAlert(), sendWelcomeEmail()

## Knowledge Gaps
- **199 isolated node(s):** `REVENDA_INVALIDOS`, `{ creditarCashback, getCreditosPorLeads }`, `{ getCachedLeads, setCachedLeads, invalidateLeadsCache }`, `{ getLeads, mapDealToCard, updateLead, getTask, updateTask, createTask, getLeadNotes, getCustomField }`, `{ getRepresentativeEmailByName }` (+194 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `{ Sequelize }` connect `{ Sequelize }` to `rd.leads.service.js`, `export.routes.js`, `cashback.routes.js`, `src/app.js`, `admin.routes.js`, `index.js`, `server.js`, `auth.controller.js`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `getLeads()` connect `rd.leads.service.js` to `export.routes.js`, `cashback.routes.js`, `admin.routes.js`, `index.js`, `{ Sequelize }`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `sendEmail()` connect `src/app.js` to `rd.leads.service.js`, `cashback.routes.js`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `REVENDA_INVALIDOS`, `{ creditarCashback, getCreditosPorLeads }`, `{ getCachedLeads, setCachedLeads, invalidateLeadsCache }` to the rest of the system?**
  _199 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `rd.leads.service.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06025039123630673 - nodes in this community are weakly interconnected._
- **Should `admin.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06704260651629072 - nodes in this community are weakly interconnected._
- **Should `export.routes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06968641114982578 - nodes in this community are weakly interconnected._