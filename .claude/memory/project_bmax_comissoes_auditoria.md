---
name: project-bmax-comissoes-auditoria
description: "Auditoria de Comissões (rastreabilidade PCI/Classe em bmax_transacoes) + Segmento/Origem por PCI na Matriz de Comissão"
metadata:
  node_type: memory
  type: project
  modified: 2026-09-14T15:00:00.000Z
  originSessionId: 87fa48d5-0558-4034-9609-8fbcde3f3b32
---

## Auditoria de Comissões e rastreabilidade — implementado 14/09/2026, commit `d8c2bd5`

**Gatilho:** cards de venda mostrando cashback mesmo com PCI/Classe de Preço vazios no RD hoje. Investigação: o cálculo sempre exigiu PCI+Classe válidos NO MOMENTO do crédito (`calcularComissoes` em `cashback.service.js` retorna `faltando:true` e não credita se faltar), mas o campo é mutável no RD e pode ser apagado/trocado DEPOIS do crédito sem deixar rastro nenhum na tela do lead.

### O que foi feito

1. **Migration em produção** (Postgres boxer-bmax): colunas `pci`, `classe_preco`, `comissao_pct` em `bmax_transacoes`. Antes só existia embutido em texto livre em `descricao` (ex: `"Venda 123 — PCI6 (1.5%)"`), e nos ajustes de recálculo ("Ajuste comissão...") nem isso.
2. **`creditarCashback()`** (`src/services/saldo.service.js`) ganhou 6º parâmetro opcional `detalhes:{pci,classePreco,comissaoPct}`, grava nas colunas novas. Atualizados os 3 call sites: venda original (`cashback.routes.js` `/creditar-retroativo`) e ajuste de recálculo (`comissao.service.js` `ajustar()`).
3. **Nova função `auditarComissoes()`** em `comissao.service.js` + rota `GET /api/cashback/auditoria` (admin, só leitura, não credita/debita nada). Compara PCI/Classe gravados no crédito (coluna nova; regex em `descricao` como fallback pros créditos pré-migration) contra o RD **hoje**. Flags: `sem_pci_no_rd`, `sem_classe_no_rd`, `pci_divergente`, `classe_divergente`.
4. **UI**: botão "Auditoria de Comissões" na tela Extrato (ao lado de "Recalcular Comissões"), abre modal (`renderAuditoriaComissoesModal` em `public/js/cashback.js`) listando toda venda creditada com status.

### Achado da auditoria manual (antes da migration, 49 créditos / 19 vendas)

Só 3 tinham Classe vazia hoje; nos 3, o % de Revenda pra aquele PCI (PCI6, PCI12B) é **fixo** (não varia por classe) — nenhum crédito existente estava financeiramente errado por sorte de amostra, não por garantia estrutural. Classe **varia** por classe pra VI/VT e Rep-Exceção na maioria dos PCIs, e pra Revenda em PCI9/12B/13/14/15 — risco real se repetir noutro PCI.

**Pendência de dado (não é bug):** revenda **Rosman Comercio e Servicos** ainda sem Classe de Preço no RD — vai continuar aparecendo na Auditoria até alguém preencher lá.

## Segmento e Origem do Lead por PCI na Matriz de Comissão — mesmo commit

Duas colunas novas na Matriz de Comissão (Gestão → Comissão/Classificação, `admin.js` `renderComissaoMatriz`): **Segmento** (Robô/Laser/Máquina) e **Origem do Lead** (Lead Boxer/Lead Revenda), um dropdown por PCI (não repete nas 4 linhas de agente — só na primeira, igual o nome do PCI já fazia).

- Vive em `pciMeta` dentro do mesmo JSON `comissao_tabela` (chave `comercial_bmax_config`, boxer-sistemas) — zero mudança de backend, que já salva/lê a chave como string opaca.
- Só classificação/documentação — não entra em nenhum cálculo.
- Pré-populado pra todos os 17 PCIs com base no agrupamento já vivo no BMax Motor (`bmax-motor/index.html:2832-2837`): PCI1-3 Robô/Boxer, PCI4-6 Laser/Boxer, PCI7-9 e PCI10-12B Máquina/Boxer, PCI13-16 Máquina/Revenda.

## Export de leads — 504 em produção (causa identificada, sem fix ainda)

`GET /api/export/leads` calcula tudo na hora (varre RD inteiro + resolve comissão de cada lead) quando o cache de leads expirou — passa dos 60s do `vercel.json`, Vercel mata a function, 504 pro usuário. Mesmo padrão de problema que "Consulta de Lead" já teve e resolveu virando índice pré-computado por cron (`3bde7ca`, `a333604`, `sync-consulta-lead`) — o export deveria receber o mesmo tratamento.

**Why:** André queria os créditos existentes 100% verificados antes de confiar no saldo — quase nenhum cashback tinha sido sacado ainda, então havia margem pra corrigir sem impacto real, mas o objetivo era resolver a causa estrutural (falta de auditoria), não só os 3 casos daquele dia.

**How to apply:** qualquer novo ponto que credite/debite cashback deve passar `detalhes:{pci,classePreco,comissaoPct}` pra `creditarCashback()`. Qualquer investigação de "cashback errado" deve começar pela tela Auditoria de Comissões antes de rodar script manual.

## Export de comissões (Excel) — data e colunas — 14/09/2026, commit `18c4d29`

Bug: "Data Fechamento" usava `x.criado_em` (data do lançamento/recálculo no banco), não a data real de fechamento no RD. Fix: `deal?.closed_at || x.criado_em` (fallback só se o deal não existir mais no RD). `closed_at` é o campo certo no RD Station V1 (descoberto via fetch direto de um deal real).

Colunas novas: "Valor Total da Venda (R$)" (`deal.amount_total`), "PCI" (coluna estruturada nova + fallback `extrairPciDoTexto()` pros créditos antigos), "Revenda" (`getCustomField(deal, "REVENDA/LOJA")`). Renomeado "Valor" → "Cashback Creditado (R$)" (ambíguo antes — não dava pra distinguir de valor de venda). `saldo.service.js`: SELECTs de `getExtratoTipoAgente()`/`getExtratoPorAgente()` estendidas pra trazer `pci, classe_preco, comissao_pct`.

**Pendente:** tela on-screen de Extrato (`getExtrato`/`getExtratoGrupo`) não recebeu o mesmo fix — só o export Excel.

## Bug de representantes duplicados + fixes de UX — 14/09/2026

**Duplicidade na listagem `GET /users`:** causa raiz era cruzar `Users.username` (Postgres boxer-bmax, = email desde 11/09/2026) contra `comercial_representantes_bmax.nome` (Supabase boxer-sistemas, nome mutável) sem chave estável comum. Fix: `canonRepsByEmail` (map por email) + fallback nesse map; `nomesComLogin.add()` usa o nome canônico, não o username bruto. **Regra permanente: nunca cruzar Postgres × Supabase por nome — sempre por email.** Revenda/admin não têm esse bug porque já usam chave estável. RD `rd_alias` é mecanismo intencional (não bug) pra reconciliar nome canônico × nome vivo no picklist do RD.

**Fix `/rep-bmax-list` (23505 duplicate key):** faltava `?on_conflict=chave` na URL do upsert — mesma classe de bug já visto em `/comissao-config`. `Prefer: resolution=merge-duplicates` sozinho não ativa upsert no PostgREST, precisa do `on_conflict` na querystring também. Checar isso em qualquer 23505/500 num endpoint de salvar via Supabase REST.

**Erro "CNPJ já existe" em Nova Negociação:** toast sutil demais fazia o André pensar que salvou quando não salvou. Fix: banner fixo vermelho (`#negFormError`) acima do form, "Cadastro NÃO foi salvo: [motivo]", substitui toast em qualquer erro do save.

**PCI12 — verificado ao vivo 14/09/2026:** fluxo (mapeamento 12a/12b, roteamento de notificação, isenção comissão 12A, normalização de case) confirmado correto contra a API real do RD. Achado operacional: 20 leads PCI12 pendentes (até 69 dias), cron de notificação só dispara 1x por lead sem lembrete — não corrigido, só reportado.
