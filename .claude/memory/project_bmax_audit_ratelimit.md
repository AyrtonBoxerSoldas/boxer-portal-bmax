---
name: project-bmax-audit-ratelimit
description: BMax audit logging and rate limiting implementation (2026-08-26); tracks all user actions, protects against brute-force
metadata:
  type: project
  originSessionId: current
  modified: 2026-08-26T20:55:40.176Z
---

**BMax Audit Logging & Rate Limiting (2026-08-26)**

## What Was Built

**1. Audit Log** — Full audit trail of user actions
- Model: `AuditLog` (already existed)
- Integrated into: createUser, createFilial, updateFilial, deleteFilial
- Fields tracked: user_id, username, role, action, entity_type, entity_id, status, ip_address, user_agent, metadata
- Actions logged: create_adm, create_representante, create_revenda, create_filial, update_filial, delete_filial
- Status: "success" or "error" (e.g., when validation fails or permission denied)
- Metadata: dynamic object with role/email/name for users, changes dict for filial updates
- Query endpoint: GET `/api/audit` (authorized for adm only)

**2. Rate Limiting** — Protect against brute-force and spam
- loginRateLimit: 10 attempts / 15 minutes (login endpoint)
- createUserRateLimit: 20 requests / 15 minutes (POST /users)
- filialRateLimit: 20 requests / 15 minutes (POST/PUT/DELETE filiais)
- Mechanism: In-memory Map tracking IP + timestamps, auto-cleanup of old entries
- Error: HTTP 429 "Muitas requisições. Tente novamente em 15 minutos."

**3. CEP Duplicado Validation** — Prevent duplicate branch CEPs per revenda
- Check: Before creating/updating filial, verify CEP doesn't already exist for same revenda
- Error: "Esta revenda já possui uma filial com este CEP"
- Logged: Failed attempt recorded in audit log with status="error"

## Files Changed

- `src/controllers/users.controller.js` — Added AuditLog import; calls AuditLog() after success/error
- `src/middlewares/rateLimit.js` — Expanded with createUserRateLimit, filialRateLimit helpers
- `src/routes/users.routes.js` — Applied rate limit middlewares to POST/PUT/DELETE routes

## Implementation Details

**Audit Log calls:**
```javascript
await AuditLog(req, {
    action: "create_filial",
    entityType: "RevendaFilial",
    entityId: filial.id,
    status: "success",
    metadata: { revenda_user_id: id, nome, cep, cidade, estado }
});
```

**Rate limit in routes:**
```javascript
router.post("/:id/filiais", authenticate, authorize(...), filialRateLimit, createFilial);
```

**CEP duplicate check:**
```javascript
const existingFilial = await RevendaFilial.findOne({
    where: { user_id: id, cep: cleanCep, id: { [Op.ne]: filial_id } }
});
if (existingFilial) return res.status(400).json({ error: "..." });
```

## Deploy Status

✅ **Production:** 2026-08-26 ~19:45 via `vercel --prod`
- URL: https://boxer-portal-bmax.vercel.app
- Alias: https://bmax.boxersoldas.com.br

## How to Apply

- **Audit trail:** ADM can query `/api/audit?userId=X&page=1&pageSize=20` to see all actions by user X
- **Rate limits:** Automatic; users over limit get 429 response; resets after 15 min window
- **CEP validation:** Users/admins cannot create duplicate CEP branches for same revenda
