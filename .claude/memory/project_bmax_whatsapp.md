---
name: project-bmax-whatsapp
description: Avisos por WhatsApp do Portal BMax (canal só de comunicação, Twilio): decisões, o que já está pronto e o que falta
metadata:
  type: project
  originSessionId: 87fa48d5-0558-4034-9609-8fbcde3f3b32
  modified: 2026-10-14T11:41:30.334Z
---

WhatsApp do Portal BMax é **só aviso com endereço do Portal no texto** — nada executa por lá, **sem botão**. Provedor **Twilio** (mesma conta do PMA), **número novo exclusivo do BMAX**; a Boxer só tem URA nas linhas fixas, então o caminho é **chip pré-pago** (verificação por SMS) — número ainda a obter (André, 14/10/2026).

**Why:** revenda precisa saber rápido de lead novo, decisão PCI12, cashback e registro Vendido/Perdido; não misturar com PMA (nota de qualidade da Meta por número) nem com o número da SDR (API tira o número do app).

**How to apply:**
- Textos aprovados (14/10): `bmax_pci12_decisao` e `bmax_resumo_diario` (utilidade). `bmax_incentivo_negociacao` = fase 2, desligado (`WHATSAPP_INCENTIVO=1` liga). Fonte do texto: `MODELOS` em `src/services/whatsappResumo.service.js`; cópia p/ colar na Twilio: `Documentação/Modelos_WhatsApp_BMAX_para_aprovacao.md`.
- Regras: sem novidade não envia; só revenda ativa com celular válido + aceite (`Revendas.whatsapp_aceite_em`); sem nome de cliente nem % de comissão; variável sem quebra de linha.
- **PENDÊNCIAS DO ANDRÉ (pediu em 14/10/2026 para eu LEMBRAR a cada sessão até concluir; atualizar o status aqui):**
  1. [ ] Comprar chip pré-pago e ativar o número do BMAX
  2. [ ] Twilio: registrar o número como sender WhatsApp (conta Meta do PMA, código por SMS, nome de exibição)
  3. [ ] Twilio: criar os 2 modelos (sem botão, categoria Utilidade) copiando o texto do doc e enviar para aprovação da Meta; me passar os códigos `HX...`
  4. [ ] Preencher celulares em Gestão → Usuários → botão WhatsApp e registrar aceite de cada revenda (só 3 de 63 válidos)
  5. [ ] Depois (eu): cron de envio com dedupe + credenciais só na Vercel; testar com o celular do André antes das revendas
  Também aberto fora do WhatsApp: devolver `Consolidacao_nomes_revendas_14-10-2026.xlsx` com decisões.
- Pronto: validação de celular (`telefone.service.js`), botão/coluna WhatsApp em Usuários, aba WhatsApp em Gestão (prévia, `GET /admin/whatsapp/previa`), tabela `bmax_whatsapp_envios` (dedupe). Faltam: número + Twilio + modelos aprovados na Meta, cron de envio com dedupe (credenciais só em variáveis da Vercel, nunca no chat) e preencher celulares (só 3 de 63 logins válidos).
