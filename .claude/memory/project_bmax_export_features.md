---
name: project-bmax-export-features
description: "Portal BMax export functionality; CSV columns include \"Data\" and \"Oportunidade\"; field name is \"OPORTUNIDADE DE VENDA\" in RD"
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-27T18:46:46.461Z
  originSessionId: 5de70a59-62da-4f78-b792-593a6ad6143e
---

## BMax Portal Export Features — Phase 1 Complete

**Status:** 3 features implemented 2026-08-27

### What's Done

1. **Alert Card: "Leads sem Oportunidade de Venda"**
   - Visual: Alert bar in `public/index.html:106-110`
   - Logic: Counter in `public/js/leads.js` (filter + display)
   - Shows count of leads missing "Oportunidade de Venda" field
   - Clickable to filter view to only those leads

2. **Export CSV Columns**
   - Headers shortened for readability: UF, Rep, Oportunidade
   - Added: "Data" (creation date from RD) and "Oportunidade" (custom field)
   - File: `src/routes/export.routes.js:29`
   - All data fits in one line; column names concise

3. **RD Field Integration**
   - Field name in RD Station: **"OPORTUNIDADE DE VENDA"** (exact)
   - Resolved via `getCustomField(deal, "OPORTUNIDADE DE VENDA")`
   - Integrated into `mapDealToCard()` output (src/services/rd.leads.service.js:429)

### Commits

- `afc7290` — Shorten CSV headers (UF, Rep, Oportunidade)
- `7554220` — Add Oportunidade field + alert card
- Previous: Rollback due to filter logic breaking leads load (reverted, then re-applied simpler approach)

### Not Yet Implemented

- Filter-based export (export only filtered leads)
  - Blocked on: Detecting active filter in export button click
  - Approach: Use `.active` class on alert bars to detect filter state
  - Next step: Add to `public/js/app.js` export handler

### Key Learning

- RD custom field names are case-sensitive and must match exactly
- Simple approach better: add field + alert first, then filter export
- Complex filter detection via variable scope issues; use DOM state instead

### Files Modified

- `src/services/rd.leads.service.js` — mapDealToCard() output
- `src/routes/export.routes.js` — CSV headers and column mapping
- `public/index.html` — Alert card element
- `public/js/leads.js` — Alert counter logic and filter logic
- `src/config/constants.js` — RD_CUSTOM_FIELDS (for reference)
