# Portal BMax — Boxer Soldas

Portal de gestão de leads comerciais do programa BMax.  
Intermediário entre revendas e o RD Station CRM.

## Stack

- **Backend:** Node.js + Express 4 (serverless via Vercel)
- **Banco:** PostgreSQL (Supabase, projeto `boxer-bmax`)
- **ORM:** Sequelize + pg
- **Auth:** JWT (bcryptjs), expira 1 dia
- **CRM:** RD Station CRM API V1 (token simples)
- **Frontend:** SPA (HTML/CSS/JS puros)

## Desenvolvimento local

```bash
cp .env.example .env   # preencher variáveis
npm install
npm run dev            # http://localhost:3000
```

## Deploy

Vercel (serverless) com auto-deploy via GitHub push em `main`.  
Entry point: `api/app.js`

## Migração RD Station → Pipefy (ATIVA em produção desde 23/11/2026)

O Portal fala com o **Pipefy** em vez do RD Station CRM, atrás da variável
`CRM_PROVIDER` (`pipefy` em produção; `rd` é o padrão/fallback de código e
pode ser religado a qualquer momento, sem novo deploy, se precisar reverter).
Detalhes completos em `DOCUMENTACAO_TECNICA.md`; resumo das variáveis:

| Variável | Obrigatória quando | Descrição |
|---|---|---|
| `CRM_PROVIDER` | sempre (padrão `rd`) | `rd` ou `pipefy` |
| `PIPEFY_TOKEN` | `CRM_PROVIDER=pipefy` | Token da conta de serviço do Pipefy |
| `PIPEFY_MAPA_JSON` | `CRM_PROVIDER=pipefy`, em produção | IDs de pipes/fases/campos/databases do Pipefy, num JSON só — gerar com `node scripts/gerar-pipefy-mapa-env.js` a partir de um `mapa_pipefy.json` local (nunca commitar esse arquivo — está no `.gitignore`, tem e-mail de funcionário) |
| `PIPEFY_CACHE_MIN` | opcional | Minutos de cache da listagem de cards do Pipefy (padrão 30) |
| `PIPEFY_PIPES_PORTAL` | opcional | Lista de pipes (nomes, separados por vírgula) que o Portal lê — padrão `CRM BOXER SOLDAS` (substitui `INDÚSTRIA - INTERNO`, usado até a Fase 5 da migração) |

Em desenvolvimento local, um `mapa_pipefy.json` na raiz do projeto substitui
a variável `PIPEFY_MAPA_JSON`.

**Cache obrigatório em produção** (`scripts/create-pipefy-cache-tables.js` +
`scripts/pre-aquecer-cache-pipefy.js`, rodados uma vez contra o banco de
produção em 23/11/2026): sem o cache já pré-aquecido, a primeira leitura
completa do pipe principal (milhares de cards) estoura o `maxDuration: 60`
da Vercel e o painel mostra "0 leads" sem erro. Se o cache do banco for
perdido/resetado, os dois scripts precisam ser rodados de novo (ver
`PIPEFY_PENDENCIAS.md`, seção "Incidente de ativação").

## Estrutura

```
api/app.js              → Entry point Vercel
public/                 → Frontend (SPA)
src/config/constants.js → IDs, mapeamentos, aliases centralizados
src/controllers/        → Handlers das rotas
src/services/           → Lógica de negócio e integrações
src/models/             → Sequelize models
src/routes/             → Definição de rotas Express
src/data/               → Planilhas de referência (cashback, IBGE)
```

## Legado

O código da versão TurboCloud (MySQL, OAuth V2, FTP) está preservado na branch `legacy/turbocloud`.
