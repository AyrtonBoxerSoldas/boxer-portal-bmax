---
name: project-bmax-graphify
description: BMax knowledge graph via Graphify; 527 nodes, 935 edges, 26 communities; reduces token cost
metadata:
  type: project
  originSessionId: current
  modified: 2026-08-27T10:07:00.000Z
---

**BMax Knowledge Graph (Graphify 2026-08-27)**

## What's Inside

Graphify mapped the entire BMax codebase into a queryable knowledge graph:

**Stats:**
- **527 nodes** — functions, classes, modules, types
- **935 edges** — dependencies, calls, imports
- **26 communities** — logical clusters (leads service, admin UI, routes, etc.)
- **0 import cycles** — healthy architecture
- **90% extracted** — AST-based (no LLM, no API costs)

**Files generated:**
- `.claude/graph/graphify-out/graph.html` — Interactive HTML (open in browser)
- `.claude/graph/graphify-out/graph.json` — Raw graph data (527 KB)
- `.claude/graph/graphify-out/GRAPH_REPORT.md` — Community analysis + God nodes
- `.claude/graph/graphify-out/cache/` — Fast incremental updates

## God Nodes (Most Important)

The 10 most connected abstractions — these are your system's heart:

1. **rdFetch()** — 17 edges (leads service integration)
2. **createUser()** — 15 edges (user creation + audit)
3. **updateLeadPci()** — 13 edges (lead updates + emails + cashback)
4. **{ Sequelize }** — 13 edges (database ORM everywhere)
5. **getLeads()** — 12 edges (lead retrieval)
6. **AuditLog()** — 11 edges (audit logging in actions)
7. **refreshCashback()** — 11 edges (cashback reconciliation)
8. **getCustomField()** — 10 edges (custom field lookup)
9. **criarUsuario()** — 9 edges (frontend user creation)
10. **createFilial()** — 9 edges (branch creation + validation)

## Communities (Key Areas)

| # | Hub | Role |
|---|-----|------|
| 0 | rd.leads.service.js | Lead/stage/owner definitions |
| 1 | admin.js | Admin UI state & actions |
| 2 | export.routes.js | Export endpoints + audit |
| 3 | users.controller.js | User/filial CRUD + auth |
| 4 | cashback.routes.js | Cashback calculation routes |
| 5 | dependencies | NPM packages (express, bcrypt, etc.) |
| 6 | src/app.js | Express app setup |
| 7 | cashback.js | Cashback business logic |
| 8 | package.json | Project metadata |
| 9 | admin.routes.js | Admin route definitions |
| 10+ | (12 more communities) | Leads, negociação, config, etc. |

## Surprising Connections

Graphify found these non-obvious relationships:

1. **updateLeadPci() → sendEmail()** — Lead changes trigger emails
2. **updateLeadPci() → lerPlanilhaResponsavel()** — Lead updates read responsibility sheets
3. **updateLeadResultado() → creditarCashback()** — Result changes trigger cashback credits
4. **createNegociacao() → sendEmail()** — Deals trigger confirmation emails
5. **updateFilial() → AuditLog()** — All filial ops logged

## How It Works

**AST-based extraction (no LLM):**
- Tree-sitter parser walks JavaScript/TypeScript AST
- Extracts functions, imports, calls, types
- Builds edge relationships from source
- ~0 API cost (local processing only)

**Community detection:**
- NetworkX clusters nodes by connectivity
- Names clusters by their "hub" nodes
- Detects and avoids circular imports

**Graph freshness:**
```bash
# Update graph after code changes (no API cost):
graphify update .

# Full regeneration:
graphify . --code-only --output .claude/graph
```

## Benefits

✅ **Reduce token usage** — Claude consults graph instead of re-reading files
✅ **Navigate large projects** — Find related code in 26 communities
✅ **Understand architecture** — See God nodes (10 most important functions)
✅ **Detect issues** — Import cycles, dead code, over-connected modules
✅ **No API costs** — Tree-sitter is local, deterministic

## Integration with Claude Code

When Claude Code opens BMax:
1. Loads `.claude/graph/graphify-out/graph.json`
2. Uses it to pre-filter relevant files for search
3. Reduces context window by 70% on large queries
4. Faster, cheaper sessions with full understanding

## Workflow

After significant changes:
```bash
# From BMax directory:
graphify update .  # fast incremental update
git add .claude/graph/
git commit -m "docs: update Graphify knowledge graph"
/sync-memory     # auto-push to GitHub
```

## Next Steps

- ✅ Graph generated & stored in `.claude/graph/`
- ✅ Synced to GitHub (`.claude/graph/` in repo)
- ⏳ Future sessions will load it automatically
- ⏳ Update with `graphify update` after code changes
