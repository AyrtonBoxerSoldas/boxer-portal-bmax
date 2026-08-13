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
