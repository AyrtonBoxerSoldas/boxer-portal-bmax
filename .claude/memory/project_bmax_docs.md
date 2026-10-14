---
name: project-bmax-docs
description: "BMax documentação: Política V5 (Canal Não-BMax), Bíblia V4 (V5 pendente), PPTX Revendas V1 concluída"
metadata: 
  node_type: memory
  type: project
  atualizado: 07/08/2026
  originSessionId: 87fa48d5-0558-4034-9609-8fbcde3f3b32
  modified: 2026-09-24T19:32:53.318Z
---

## Documentação BMax — Estado (07/08/2026)

### Localização
```
C:\Users\andre.coelho.BXSD\BOXER\Dados - Documentos\Comercial\Geral\Estrategia\2026\Projeto BMax\Documentação\
  BMAX CRITERIOS.xlsx                                  ← FONTE MESTRA de classificação (ver seção própria abaixo)
  Documento_Mestre_BMax_V4.docx                        ← Bíblia Mestra V4 (com Diamante)
  Politica_Comercial_Industrial_BMax_V5.docx           ← Política Comercial V5 (Canal Não-BMax, 07/08/2026, publicada no portal)
  Politica_Comercial_Industrial_BMax_V4.docx           ← V4 anterior
  BMax_Apresentacao_Revendas_V1.pptx                   ← Apresentação para Revendas V1 (concluída 07/08/2026)
  Antigos\                                             ← versões anteriores (V1-V3)
```

### `BMAX CRITERIOS.xlsx` — fonte mestra pra cadastrar/classificar revenda (achado 24/09/2026)

Planilha em `Documentação\BMAX CRITERIOS.xlsx`, aba **"REVENDA"** (A1:AI87). Cada linha é uma revenda com zen_id, nome completo, nome fantasia, **representante responsável**, cidade/estado, **classe (Diamante/Ouro/Prata)**, CNPJ, CEP e **e-mail de contato** — é o dado de origem que confirma (ou corrige) o que está em `comercial_revendas_bmax` no Supabase. Ler com `openpyxl` (`data_only=True`); os nomes das abas e valores têm acento em cp1252/latin, não UTF-8 puro — cuidado com encoding ao imprimir.

Outras abas relevantes: **"Representantes"** (lista mestra), **"Regras"** (T148, critérios PCI), **"PCI Versão 2 (atual)"** (a vigente — a "versão 1" é histórico).

**Why:** ao cadastrar uma revenda nova ou resolver divergência de classe/representante, esse Excel é a fonte de verdade — não adivinhar nem inferir só do que já está no Supabase (que pode estar desatualizado ou nunca ter sido preenchido).

**How to apply:** antes de criar/editar cadastro de revenda (classe, rep, e-mail), SEMPRE checar a aba REVENDA desse arquivo primeiro. Confirmado em 24/09/2026 pra Via Soldas (zen 28977: rep Victor VLM, classe Ouro, e-mail ferreira@viasoldas.com.br) e Atual Equipamentos (zen 57857) — bateu 100% com o que já estava correto no Supabase, serve de dupla-checagem.

### Documentos

| Documento | Arquivo | Status |
|---|---|---|
| **Bíblia Mestra (Doc. Mestre)** | `*_V4.docx` | **V4 (02/08/2026).** 21 capítulos + Diamante. **V5 pendente** — precisa inserções Canal Não-BMax equivalentes à Política V5. |
| **Política Comercial Industrial** | `*_V5.docx` | **V5 (07/08/2026).** 13 capítulos. Novidade: Canal Não-BMax (6 inserções). Publicada no portal online. |
| **PPTX Revendas** | `BMax_Apresentacao_Revendas_V1.pptx` | **V1 concluída (07/08/2026).** 13 slides, dark navy, aprovada por André. |
| **Documento Técnico — Portal** | `boxer-portal-bmax/DOCUMENTACAO_TECNICA.md` | **Criado 21/09/2026**, publicado no GitHub. Arquitetura, os 2 bancos Supabase, RD Station V1, fluxo PCI12, cashback/comissão, histórico de bugs de infra. |
| **Documento Técnico — Motor** | `bmax-motor/DOCUMENTACAO_TECNICA.md` | **Criado 21/09/2026**, publicado no GitHub. Achado central: Motor virou somente-leitura em cadastro desde a migration 07 (11/09) — ver [[project-bmax-motor]]. |

### Estrutura da Bíblia Mestra (21 capítulos)

**PARTE I — Regras e Diretrizes**
1. Objetivo | 2. O Programa BMax (2.1 Portal, 2.2 RD Station, 2.3 Motor PCI) | 3. Estrutura Comercial | 4. Revendas BMax (4.1 Prioridade, 4.2 Reavaliação) | **5. Representantes no Programa BMax** | 6. Produtos Elegíveis | 7. Processo de Venda (7.1-7.6) | 8. Tabela de Preços (8.1) | 9. Comissões e Cashback (9.1-9.4) | 10. Condições Comerciais (10.1-10.6) | 11. Frete | 12. Garantia e SAC

**PARTE II — Operação e Referência**
13. Fluxograma | 14. Fichas Técnicas por PCI | 15. Tabela-Resumo | 16. Portal BMax (16.1-16.3) | 17. RD Station CRM (17.1-17.3) | 18. Checklists (18.0-18.3) | 19. Regras de Exceção | 20. FAQ | 21. Glossário

### Correções S37 — regeneração DOCX (25/07/2026)
Ambos documentos foram **regenerados do zero** via python-docx (não editados XML):
- **Cashback:** válido para qualquer produto (máquinas, máscaras, acessórios), exceto peças de reposição e consumíveis
- **Cartão:** juros acima de 10x (não 21x), máximo 21x
- **Vínculo temporal (nova seção 7.7 na Bíblia):** 60 dias para leads de revenda (PCIs 13-16), 30 dias para PCI 12A
- **Typo:** "à mais" → "há mais"
- André revisando visualmente os DOCX gerados

### Alterações aplicadas na Bíblia (S36-S37)
- B1: Cap 5 Representantes como capítulo próprio (não mais sub-seção 11.5)
- B2a-c: Detalhes Portal (Supabase), RD Station (campos obrigatórios), Motor PCI (GitHub Tekweld)
- B3: Fluxo Pipefy no Cap 2.2 + checklist Vendedor (NÃO SDR)
- B5: Definição segmento Grande (300A/80A)
- B6: Checklist SDR (novo)
- B7: "Classificar no Motor PCI" explícito em todos os checklists
- ZEN Observação: nomes e comissões dos envolvidos obrigatórios
- D2-D5: Fluxograma, Fichas PCI, Tabela-Resumo, FAQ — todos implementados
- Todas anotações amarelas do André removidas

### Política Online (futuro)
- Abordagem C aprovada: HTML no GitHub → Netlify auto-deploy, Supabase Auth, logging
- Ainda não iniciado — ver [[project-politica-online-pipeline]]

### PPTX Revendas — V1 concluída (07/08/2026)
13 slides, dark navy ([[feedback-pptx-bmax-style]]), linguagem para donos/funcionários de revenda. 7 blocos: Abertura, Benefícios (cashback+%), Classificação (Ouro/Prata/Diamante), Como Participar (jornada lead), Portal BMax (mockup), Regras (vínculo 60d), Encerramento. Aprovada por André.

### Política V5 — Inserções Canal Não-BMax (07/08/2026)

6 pontos de inserção marcados como "NOVO V5" com fundo amarelo:
1. **Cap 2:** Primeiro acesso ao Motor PCI (contatar Time BMax ou ADM de Vendas)
2. **Cap 4.2:** Revendas Não-BMax (Canal Indicador) — subcapítulo completo com fluxo, comissão majorada, observação ZEN obrigatória
3. **Cap 5:** Representantes Não-BMax — podem operar via política BMax quando lead vem de revenda
4. **Cap 7:** Leads de revendas não-BMax — mesmo processo, revenda obrigatória no Motor e Tabela
5. **Cap 9.3:** Cashback para revendas não-BMax — bonificação direta pós-faturamento (não acumula no Portal)
6. **Cap 13 Glossário:** novo termo "Canal Indicador (Não-BMax)"

### Regras-chave Canal Não-BMax
- Modelo obrigatório: **BOX+REV>IND** (revenda selecionada no Motor e Tabela de Preços como origem)
- Mesma classificação PCI, mesmas comissões, mesma tabela de preços que BMax
- Diferença: sem cashback no Portal — bonificação paga diretamente após faturamento (crédito no próximo pedido ou nota de crédito)
- Rep não-BMax pode conduzir venda ou passar para atendimento interno — ambos recebem comissão
- Registro no RD Station: SDR, Gerente Industrial ou ADM de Vendas
- Observação ZEN obrigatória: "Venda BMax — Revenda Indicadora Não-BMax: [Nome] — PCI [X]"

### Bíblia V5 — pendente
Inserções equivalentes necessárias em: Cap 2.3, 4.3, 5, 7.8, 9, 16, 17, 18.

---

### Pendência: Dashboard Logística + FIFO (registrada 28/07/2026)
Incluir em Política e Bíblia referência ao dashboard de logística (`https://tekweld.github.io/boxer-dashboard/index.html`) no capítulo de Prazo de Entrega. Pontos: disponibilidade atual/futura, pedidos no ZEN sem estoque, faturamento FIFO. Aguardando conclusão do sistema de versões do portal.

**Why:** André quer 3 camadas: Política (prática), Bíblia Mestra (completa), Doc Técnico (para devs). Além dos docs, materiais de comunicação por público-alvo.

**How to apply:** Política V5 pronta e publicada. Pendentes: Bíblia V5, Doc Técnico.
