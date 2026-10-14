---
name: project-bmax-api-fields
description: RD Station CRM V1 API fields available per deal in batch listing and individual fetch
metadata: 
  node_type: memory
  type: project
  originSessionId: 87fa48d5-0558-4034-9609-8fbcde3f3b32
  modified: 2026-08-20T12:36:27.717Z
---

## RD Station CRM V1 — Campos por Deal

Referência de campos retornados pela API para o Portal BMax. [[project_bmax_portal]]

### Deal Custom Fields (listagem em lote /deals?...)

| Label na API | Exemplo | Observação |
|---|---|---|
| CNPJ | 23.093.714/0001-97 | Também na Organization |
| ESTADO | SP | Também na Organization |
| CIDADE | ITAQUAQUECETUBA | Também na Organization |
| NOTAS | (texto livre) | |
| OPORTUNIDADE DE VENDA | SIM / (vazio) | |
| FRENTE DE TRABALHO | (texto livre) | |
| REPRESENTANTE  | Caio Tito | **ATENÇÃO: label tem trailing space** |
| MÁQUINA DE INTERESSE | ALUMIG 400 DP | |
| REVENDA/LOJA | D. Soldas | |
| PERFIL PCI | PCI 12 | Sem espaço entre PCI e número na API, mas Excel headers são PCIX (sem espaço) |
| CLASSE DE PREÇO | 3 | Mapeado como `classePreco` no portal (extraído com `.replace(/\D/g, "")`) — necessário para PCIs 13/14/15 |

### Deal Non-Custom Fields (top-level)

| Campo | Tipo | Exemplo |
|---|---|---|
| _id / id | string | 69e0d420b52e28001d1da2e3 |
| name | string | FOCO SOLUCOES ENERGETICAS LTDA |
| amount_total | number | 17828.6 |
| amount_montly | number | 0 |
| amount_unique | number | 17828.6 |
| created_at | ISO date | 2026-04-16T09:20:48.378-03:00 |
| updated_at | ISO date | |
| closed_at | ISO date / null | |
| prediction_date | date / null | |
| win | boolean / null | |
| rating | number | |
| hold | boolean | |
| interactions | number | |
| last_note_content | string | |
| user | object {name, _id} | Lorena Leite (responsável/dono no RD) |
| organization | object | Contém organization_custom_fields |
| deal_pipeline | object | {_id, name} |
| deal_stage | object | {_id, id, name, nickname} |
| deal_stage_histories | array | Histórico de mudanças de etapa |
| deal_products | array | Produtos vinculados |
| deal_source_id | string / null | |
| campaign_id | string / null | |

### Organization Custom Fields

Retornam com `custom_field: null` na listagem em lote (labels como N/A), mas valores estão presentes. No deal individual, labels aparecem corretamente.

**Bug descoberto 2026-08-14:** O label "REPRESENTANTE " vem com espaço extra no final na API. O código precisa de `.trim()` na comparação.

**Why:** Referência para debug e novos campos no portal.
**How to apply:** Consultar ao adicionar/editar campos exibidos no portal ou ao debugar dados "?????".
