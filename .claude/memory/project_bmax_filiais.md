---
name: project-bmax-filiais
description: BMax revendas can now have multiple branch locations (filiais); implemented with RevendaFilial model
metadata:
  type: project
  originSessionId: current
  modified: 2026-08-26T20:55:20.640Z
---

**BMax Filiais Implementation (2026-08-26)**

Revendas now support multiple branch locations (filiais). Each revenda has a main office (sede/principal) automatically created, plus optional additional branches.

**What was built:**
- `RevendaFilial` Sequelize model with fields: nome, telefone, email, cep, cidade, estado, endereco, numero, complemento, principal (boolean)
- Routes: GET/POST/PUT/DELETE `/users/:id/filiais` (authorized for adm + revenda roles)
- UI: "+ Adicionar Filial" button when creating revenda; "Filiais" button per revenda in admin panel
- Main office is auto-created from revenda data; cannot be deleted. Additional branches can be added/removed.

**Database:**
- Table: `RevendaFiliais` (PostgreSQL)
- FK: user_id → Revendas(user_id) with ON DELETE CASCADE
- Relationship: Revenda.hasMany(RevendaFilial)

**Admin UI:**
- View filiais: admin clicks "Filiais" button on revenda row
- Add at create time: form shows "+ Adicionar Filial" when role=revenda selected
- Delete: click "Deletar" on non-principal branches

**Validations (2026-08-26 Phase 2):**
- CEP duplicado: Rejeita tentativa de adicionar filial com CEP que já existe para a mesma revenda
- Format validation: CEP (8 dígitos), Estado (UF válida), Email, Telefone (10-11 dígitos)
- Permission check: Revenda A não consegue criar/editar/deletar filials de Revenda B
- Audit log: Cada create/update/delete registra ação com IP, user, changes

**How to apply:** When revendas need multiple addresses/locations, use filiais. Main office stays locked. API supports programmatic adds/edits via PUT /users/:id/filiais/:filial_id. All operations are logged in audit trail.

**Deployed:** Vercel production live. Phase 2 (audit/rate-limit/CEP-dupe) deployed 2026-08-26 ~19:45.
