---
name: project-bmax-cep-autofill
description: BMax revenda/filial registration starts with CEP; auto-fills address via ViaCEP API
metadata:
  type: project
  originSessionId: current
  modified: 2026-08-26T17:21:30.928Z
---

**BMax CEP Auto-fill Feature (2026-08-26)**

Revenda and filial creation now starts with CEP, auto-populating address fields via ViaCEP API.

**UX Flow:**
1. User enters CEP (8 digits)
2. On blur, fetchCEP() queries ViaCEP
3. Auto-fills: endereço, cidade, estado (readonly fields)
4. User adjusts: número, complemento (editable)
5. User enters: nome da filial/revenda, email, telefone

**Implementation:**
- Frontend: admin.js has fetchCEP(cep, card) function for revenda + filial cards
- Labels show "(auto)" and "(auto-preenchido)" to indicate auto-filled fields
- Readonly fields: dark background (rgba 8%) to show they're pre-filled
- Modal: increased to 680px with overflow-y scroll

**Backend:**
- Model Revenda: added endereco, numero, complemento fields
- Controller: validates all required fields before create
- Filial principal auto-created with full address data
- Migration applied: supabase/migrations/*_add_endereco_to_revendas.sql

**Database:**
- Columns added to Revendas table via direct SQL execution (sequelize.query)
- RevendaFiliais already had endereco, numero, complemento from earlier implementation

**How to apply:** When users create revendas/filiais, they now start with CEP. The auto-fill reduces manual entry errors and matches Motor BMax UX pattern already familiar to users.

**Tested:** CEP lookup works (ViaCEP API responsive), field population correct, validation enforces required fields, form submission saves all data. Removed redundant "+ Nova Revenda" button (now only "Novo Usuário" exists).
