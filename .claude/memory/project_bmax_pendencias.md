---
name: project-bmax-pendencias
description: "Pendências abertas do Portal BMax (consolidação de nomes de revenda, WhatsApp, limpeza de testes) que o André pediu para eu lembrar até concluir; atualizado em 15/10/2026"
metadata:
  node_type: memory
  type: project
  originSessionId: 87fa48d5-0558-4034-9609-8fbcde3f3b32
  modified: 2026-10-15T15:43:21.487Z
---

André (15/10/2026) pediu: **me lembrar das pendências a cada sessão até concluirmos** e dizer o que ele precisa fazer.

**1. Consolidação de nomes de revenda (UM nome por loja) — aguardando o André**
- Planilha: `Projeto BMax/Documentação/Consolidacao_nomes_revendas_14-10-2026.xlsx` (abas Decisões, Lojas, Variantes, Logins). Ele disse que devolve em 15/10/2026 (salvar na mesma pasta com outro nome, ex. `_respondida.xlsx`, ou responder só as exceções).
- Como aplico: ler respostas → simulação (sem gravar) → backup em `scripts/backups/` → após OK: preencher "Nome no RD" (11 lojas), renomear ~23 leads com nome antigo no RD, tirar nomes antigos dos grupos, ativar/desativar logins decididos, trava de nome obrigatório+único e conferência diária; auditoria no fim.
- Decisões em aberto: WST (2 cadastros ativos: segunda loja ou duplicata?), Locsoldas (4 leads sem cadastro ativo), 32 logins sem loja ativa, 8 logins inativos caso a caso.

**2. WhatsApp do Portal — aguardando o André** (detalhes em [[project-bmax-whatsapp]])
chip pré-pago do BMAX → número como sender na Twilio → 2 modelos (sem botão, Utilidade) aprovados pela Meta (passar códigos `HX...`) → celulares das revendas em Gestão→Usuários (só 3 de 63 válidos) e aceite → eu faço cron de envio com dedupe.

**3. Limpeza de testes (André faz no RD):** cards EmpresaTeste3 (5 notas de teste) e EmpresaTeste4; 13 leads de teste no funil BMAX (manter "Fabio Alessandro"). O RD v1 não apaga deals pela API.

**4. Outros:** conferir visual do Playbook novo (2 páginas); André deve trocar a senha dele (passou pelo chat em 15/10/2026); sem link "Esqueci a senha" na tela de login (só existe o endpoint) — oferecido, não pedido.

**Entregue em 14-15/10/2026 (já em produção, commit e6b774b):** prazos 24h/48h só em dias úteis (60 dias do PCI12a seguem corridos); robôs sync-revenda-rep-rd e pci12-followup às 07h/10h/14h/17h; Playbook da revenda em 2 páginas (Nova Negociação+trava de CNPJ, % de comissão da revenda, FAQ); orçamento na Nova Negociação — OBRIGATÓRIO, 1 a 3 arquivos, Storage do Supabase + nota com link HTML fixo sem login no card (ver [[feedback-portal-bmax-logica]]).

**Why:** o André usa o Claude como gerente de projeto das pendências; esquecer item aberto custa retrabalho.
**How to apply:** no início de cada sessão do BMax, listar o que continua aberto e o próximo passo do André; marcar como feito só quando ele confirmar.
