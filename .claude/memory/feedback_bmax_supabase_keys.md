---
name: feedback-bmax-supabase-keys
description: BMax uses two separate Supabase projects; use project-specific service keys to avoid API routing errors
metadata:
  type: feedback
  originSessionId: current
  modified: 2026-08-26T15:57:32.712Z
---

**Supabase Project Routing for BMax (2026-08-26)**

BMax stores data in TWO separate Supabase projects. Always use the correct project-specific service key.

**Why:** Mixing projects causes "Could not find column X in schema cache" errors. Revenda data lives in boxer-bmax; other entities in boxer-sistemas.

**The rule:**
- boxer-sistemas (https://bmepxcnrsofofoswubuu.supabase.co): representantes, admins, funcionários → use SUPABASE_SERVICE_KEY_SISTEMAS
- boxer-bmax (https://zsvtxutoewypyitajjwz.supabase.co): comercial_revendas_bmax → use SUPABASE_SERVICE_KEY_BMAX

**Implementation in code:**
- src/controllers/users.controller.js has sbSistemas() and sbBmax() functions
- sbBmax() tries SUPABASE_SERVICE_KEY_BMAX first, falls back to SUPABASE_SERVICE_KEY
- Each API call specifies the right function (e.g., sbBmax('/comercial_revendas_bmax', ...))

**How to apply:** When adding new Supabase calls for revenda data, use sbBmax(). For other roles, use sbSistemas(). If adding a new table, verify which Supabase project it lives in first.

**Environment setup:** SUPABASE_SERVICE_KEY_BMAX is now in Vercel production (confirmed 2026-08-26).
