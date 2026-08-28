---
name: project-bmax-validations-improvements
description: BMax validations and security improvements implemented 2026-08-26; CNPJ/email/CEP validation, filial permissions, better error messages
metadata:
  type: project
  originSessionId: current
  modified: 2026-08-26T20:55:27.273Z
---

**BMax Validations & Security Improvements (2026-08-26)**

## What Was Done

**5 Melhorias implementadas e deployadas:**

1. **Permissões de filial (CRÍTICA)** — Revendedor A não consegue mais criar/editar filial de revendedor B. Adicionada validação `req.user.id === filial.user_id` em createFilial, updateFilial, deleteFilial.

2. **CEP validation** — Tratamento de 3 cenários: (a) CEP não existe → "CEP não existe ou logradouro não encontrado", (b) CEP válido → auto-fill, (c) CEP sem logradouro → aviso "Complete manualmente"

3. **CNPJ checksum** — Validador real com dígitos verificadores. Rejeita CNPJ como "11222333000180" mas aceita "11222333000181"

4. **Email format** — Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Rejeita "123" mas aceita "test@test.com"

5. **Telefone validation** — 10-11 dígitos obrigatório

**Extras:**
- Estado validation (whitelist de 27 UFs brasileiras)
- Mensagens de erro específicas em todos os endpoints
- Arquivo `src/utils/validators.js` reutilizável para futuras validações

## Files Changed

### Phase 1 (2026-08-26 initial)
- ✅ `src/utils/validators.js` — Novo arquivo (isValidEmail, isValidCNPJ, isValidCEP, isValidState, isValidPhone)
- ✅ `src/controllers/users.controller.js` — Validações em createUser, createFilial, updateFilial, deleteFilial + permissões filial
- ✅ `public/js/admin.js` — Validadores no frontend + fetchCEP melhorado + criarUsuario com validações

### Phase 2 (2026-08-26 additional)
- ✅ `src/controllers/users.controller.js` — AuditLog integrado em createUser, createFilial, updateFilial, deleteFilial + CEP duplicado validation
- ✅ `src/middlewares/rateLimit.js` — Expandido: loginRateLimit, createUserRateLimit, filialRateLimit
- ✅ `src/routes/users.routes.js` — Rate limit middlewares aplicados em POST/PUT/DELETE rotas

## Deploy Status

✅ **Production:** https://boxer-portal-bmax.vercel.app  
**Deploy time:** 2026-08-26 ~17:45

## Test Plan

Plano de testes completo salvo em audit report. Cenários testáveis manualmente:
- CNPJ inválido rejeita (checksum errado)
- Email inválido rejeita (sem @)
- Telefone < 10 dígitos rejeita
- CEP 99999999 (não existe) rejeita com mensagem específica
- CEP 01310100 (válido) preenche automático

Testes deixados para fazer depois.

## Phase 2: Audit Log + Rate Limiting + CEP Duplicado (2026-08-26)

✅ **3 Melhorias Adicionais Implementadas:**

1. **Audit Log** — Registro de ações em createUser, createFilial, updateFilial, deleteFilial
   - AuditLog model já existia
   - Integrado em `src/controllers/users.controller.js`
   - Metadados: role, email, name, changes, cep, etc.
   - Logs rastreiam quem criou/editou/deletou + quando + IP

2. **Rate Limiting** — Proteção contra force brute/spam
   - loginRateLimit: 10 tentativas/15min
   - createUserRateLimit (POST /users): 20 req/15min
   - filialRateLimit (POST/PUT/DELETE filiais): 20 req/15min
   - Implementado em `src/middlewares/rateLimit.js`
   - Aplicado nas rotas críticas em `src/routes/users.routes.js`

3. **CEP Duplicado por Revenda** — Validação ao criar/atualizar filial
   - Rejeita tentativa de adicionar filial com CEP já existente para a mesma revenda
   - Erro específico: "Esta revenda já possui uma filial com este CEP"
   - Registrado em audit log como erro

## Pending

- [ ] Manual testing de audit log, rate limit, CEP duplicado
- [ ] Dashboard de auditoria (consulta visual dos logs)
