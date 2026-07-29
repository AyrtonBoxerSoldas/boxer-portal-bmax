# Portal BMax — Boxer Soldas

Portal de gestão de leads comerciais do programa BMax.  
Intermediário entre revendas e o RD Station CRM.

## Stack

- **Backend:** Node.js + Express 5
- **ORM:** Sequelize + MySQL
- **Auth:** JWT (bcryptjs)
- **Integração:** RD Station CRM v2
- **Frontend:** SPA (HTML/JS)

## Desenvolvimento

```bash
cp .env.example .env   # preencher variáveis
npm install
npm run dev
```

## Deploy

Backend hospedado no Railway com deploy automático via GitHub push.
