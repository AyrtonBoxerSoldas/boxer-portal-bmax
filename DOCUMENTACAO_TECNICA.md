# Documento Técnico — Portal BMax

> Referência técnica para quem for manter ou estender o Portal BMax. Descreve o que o código faz hoje (21/09/2026), não o que deveria fazer. Complementa a Bíblia Mestra e a Política Comercial (regras de negócio, público leigo) — este documento é para desenvolvedores.

## 1. O que é

Portal web para gestão de leads comerciais do programa BMax — o intermediário entre revendas parceiras, representantes comerciais e o RD Station CRM. Três papéis de login: **revenda**, **representante**, **adm**. Também gerencia cashback (crédito comercial que revendas acumulam por venda) e comissão de representantes.

## 2. Arquitetura

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express 4, serverless na Vercel (`api/app.js`, maxDuration 60s) |
| ORM | Sequelize + `pg`, Postgres hospedado no Supabase (projeto **boxer-bmax**, `sa-east-1`) |
| Auth | JWT local (bcryptjs), expira em 1 dia. Não usa Supabase Auth. |
| CRM | RD Station CRM **API V1** (`https://crm.rdstation.com/api/v1`, token simples via query `?token=`) |
| Config compartilhada | Supabase **boxer-sistemas** (projeto separado do boxer-bmax!) — tabelas `comercial_*`, lidas via REST (`sbSistemasAnon`/`sbSistemasService`) |
| Email | Resend API (`RESEND_API_KEY`) |
| Frontend | SPA estática: `public/index.html` (markup) + `public/css/style.css` + `public/js/*.js` (sem bundler, sem framework) |
| Deploy | Vercel — **auto-deploy em produção a cada `git push origin main`**, sem etapa de aprovação intermediária |

**Dois bancos Postgres/Supabase diferentes, sem FK entre eles:**
- **`boxer-bmax`** (Postgres via Sequelize) — `Users`, `Revendas`, `RevendaFiliais`, `Representantes`, `Negociacoes`, `AuditLogs`, `RateLimitHits`, `bmax_saldo`, `bmax_transacoes`, `bmax_saques`, `bmax_pci12_tracking`, `bmax_grupos`. Acesso via Sequelize/`DATABASE_URL`.
- **`boxer-sistemas`** (Supabase, REST) — `comercial_revendas_bmax`, `comercial_representantes_bmax`, `comercial_bmax_config`, `comercial_bmax_admins`. Esse projeto é **compartilhado com o BMax Motor** (ver `bmax-motor/DOCUMENTACAO_TECNICA.md`) — é de lá que vem a tabela de comissão (`comercial_bmax_config`, chave `comissao_tabela`) que o Portal lê pra calcular cashback.

**Regra crítica de integridade:** nunca cruzar um registro do Postgres (`boxer-bmax`) com um do Supabase (`boxer-sistemas`) por nome/username — não existe FK real, e nomes de exibição mudam. Sempre por e-mail (ou outra chave estável explícita). Username do Postgres é o e-mail de login desde 11/09/2026 (antes era nome de exibição) — qualquer lookup antigo por nome quebra silenciosamente pra quem já migrou.

## 3. Modelo de dados (boxer-bmax, via Sequelize)

| Tabela | Propósito | Pontos de atenção |
|---|---|---|
| `Users` | Login (id, username=e-mail, password bcrypt, role) | role ENUM: adm/representante/revenda/funcionario |
| `Revendas` | 1:1 com User (PK = `user_id`). name, email, telefone, **grupo**, cnpj (unique), cep, cidade, estado | `grupo` agrupa lojas multi-filial do RD (ex: Luitex Sumaré/Americana/... todas sob grupo "Luitex") via tabela `bmax_grupos` |
| `RevendaFiliais` | Filiais de uma revenda (sede + adicionais) | **Criada manualmente em produção em 21/09/2026** — o `CREATE TABLE` nunca tinha rodado apesar do model/controller existir há tempo; toda criação de revenda nova quebrava com 500 até então. Ver seção 8. |
| `Representantes` | 1:1 com User. email | nome de exibição de verdade fica em `comercial_representantes_bmax` (Supabase), não aqui |
| `Negociacoes` | "Reserva" local de uma negociação nova criada pelo Portal (CNPJ, revenda, representante, `expires_at` = +60 dias) | é o registro do formulário "Nova Negociação", não reflete status do RD depois de criado |
| `AuditLogs` | Log de ações sensíveis (login, reset senha, etc) | escrita via `AuditLog(req, {...})` em `audit.service.js`; degrada graciosamente se a tabela não existir (`isAuditTableAvailable()`) |
| `RateLimitHits` | Rate limiting próprio (não usa lib externa) | `rateLimit.js` |
| `bmax_grupos` | Mapeia nome de loja no RD (`REVENDA/LOJA`) → `grupo` da revenda no Portal + `email_responsavel` | raw SQL via `sequelize.query`, não é model Sequelize |
| `bmax_saldo` | Saldo atual por `(tipo_agente, revenda)` — `revenda` aqui é "nome do agente" (revenda, representante ou vendedor_interno), coluna renomeável só no nome, não na função | `tipo_agente`: `revenda` \| `representante` \| `vendedor_interno` |
| `bmax_transacoes` | Histórico de crédito/débito, com `pci`, `classe_preco`, `comissao_pct` (colunas adicionadas 14/09/2026 — créditos antigos só têm isso embutido em texto livre na `descricao`) | `lead_id` referencia o deal no RD |
| `bmax_saques` | Pedido de saque de cashback (revenda solicita, representante aprova/recusa, gera código de cheque `BMAX-<ano>-<5 dígitos>`) | |
| `bmax_pci12_tracking` | Rastreia troca automática de responsável (48h) enquanto um PCI12 está pendente | `deal_id`, `owner_original_id/nome`, `detectado_em`, `email_24h_enviado_em`, `revertido_em`, `resolvido_em` |

## 4. Modelo de dados (boxer-sistemas, via REST — compartilhado com o Motor)

| Tabela | Propósito |
|---|---|
| `comercial_revendas_bmax` | Cadastro-mestre de revendas, **importado do ZEN** (`zen_id`, `rep`, lat/lng, `classe` Ouro/Prata/Diamante). Não é 1:1 com login do Portal — é normal ter cadastro sem login (revendas pequenas/inativas) e vice-versa. Editável via Gestão → Revendas (campo `ativo` controla se aparece na listagem por padrão). |
| `comercial_representantes_bmax` | Nome canônico, e-mail, `rd_alias` (reconcilia nome canônico com o nome vivo no picklist do RD, quando divergem), `ativo`, `tem_login` |
| `comercial_bmax_config` | Key-value genérico. Chaves conhecidas: `comissao_tabela` (tabela de comissão do Motor, lida pelo cashback do Portal), `representantes_bmax` (espelho legado que o Motor lê direto), `revenda_rd_snapshot`/`pci12_leads_avisados` (snapshots de controle dos crons do Portal) |
| `comercial_bmax_admins` | Quem tem acesso ao Motor (Supabase Auth, sistema separado do login do Portal) |

**Duas chaves de acesso:** `sbSistemasAnon` (anon key, maioria das leituras/escritas) e `sbSistemasService` (service_role, exigido só por `comercial_revendas_bmax`/`comercial_bmax_config`/`comercial_bmax_cobertura`/`comercial_bmax_vendedores` desde a "Lote 7" de centralização).

**Upsert via REST — armadilha recorrente:** `Prefer: resolution=merge-duplicates` sozinho não basta, precisa de `?on_conflict=<coluna>` na URL. Pior: um `PATCH` filtrado por chave que não acha nenhuma linha devolve `200 OK` com array vazio — **não lança erro**. Um padrão comum no código antigo era `PATCH(...).catch(() => POST(...))` pra "criar se não existir" — isso nunca funcionava pra registro genuinamente novo, porque o `.catch()` nunca disparava. Já corrigido em `saveSnapshot` (app.js), criação de representante (`admin.routes.js`) e no espelho legado — mas **auditar qualquer upsert novo antes de copiar o padrão antigo de algum lugar não revisado**.

## 5. RD Station CRM V1 — integração

- Todas as escritas do Portal usam **um único token de integração** (`RD_CRM_TOKEN`), não OAuth por usuário — o RD não distingue quem no Portal disparou a chamada.
- Pipeline principal: **Indústria Interno** (`66151c1470449b000d54e914`). Existe também o pipeline **BMax** (`6a2bff35a294cf00226dd600`) — usado só no fechamento final (Vendido/Perdido). **Nunca mover um lead pendente pra esse pipeline por engano**: o dashboard do Portal só busca deals do pipeline Indústria Interno, então mover pra qualquer outro faz o card desaparecer do painel pra sempre, mesmo que o RD continue "correto" por fora. Isso já aconteceu e foi corrigido em 16-17/09/2026.
- **Anotações do RD não funcionam** — nem leitura (`GET /annotations?deal_id=`) nem escrita (`POST /deals/:id/annotations`, `/annotations`, `/deals/:id/notes`, `/notes` — todos 404). O mecanismo real pra "deixar um registro" num deal é **Tarefa** (`createTask()`), que funciona normalmente.
- Campo `REVENDA/LOJA` e `REPRESENTANTE` são picklists estritos (`allow_new:false`) — o RD aceita a chamada mas descarta silenciosamente qualquer valor fora da lista de opções. Por isso o picklist precisa ser sincronizado (`syncRevendasToRD`/`syncRepresentantesToRD`) **antes** de tentar gravar um nome novo em qualquer deal, ou a escrita simplesmente não persiste.
- IDs de custom field principais: `CNPJ=66549f56`, `ESTADO=67407ad5`, `CIDADE=69de7c5f`, `REPRESENTANTE=687562da` (label real tem espaço no fim: `"REPRESENTANTE "`), `REVENDA/LOJA=69a19ce3`, `MÁQUINA=69a1eaa6`, `PERFIL PCI=6a3ae566`, `SEGMENTO DE PRODUTO=6aa346e64ea34c002966dda8` (obrigatório pra aceitar a etapa Negociação — sempre "Máquinas" pra PCI12).

## 6. PCI12 — fluxo de caminho duplo

O caso mais complexo do sistema. PCI12 genérico vira um de dois caminhos quando a revenda/representante/adm escolhe no card:

- **PCI 12a = BOX>REV** — revenda atende o cliente diretamente. Responsável continua André (pseudo-dono fixo `RD_OWNERS["Revenda"]`).
- **PCI 12b = BOX+REV>IND** — Boxer assume a venda. Responsável = `lerPlanilhaResponsavel(cidade,estado)` (lookup em `src/data/ibge_responsaveis.json`, 10.741 municípios) ou o dono original pré-troca se a cidade não for encontrada.

**Nunca inverter esse mapeamento** (já aconteceu uma vez, 10/08/2026). Os dois caminhos **ficam no mesmo pipeline** (Indústria Interno), só mudam de etapa pra "Negociação" — nunca mudam de funil (ver seção 5).

**Troca automática de responsável (regra de 48h):** ao detectar um PCI12 pendente (cron diário `sync-revenda-rep-rd`), o responsável no RD vira André até a revenda escolher o caminho, ou até 48h sem resposta (aí volta pro original). Tracking em `bmax_pci12_tracking`. Cron `pci12-followup` roda 4x/dia (Vercel Hobby só permite 1x/dia por `schedule`, daí múltiplas entradas em `vercel.json`) e manda lembrete às 24h + reverte às 48h. **Escopo intencional:** só entram no tracking os leads que `getLeads("admin","adm")` retorna (pipeline Indústria Interno, criados a partir de 01/05/2026, excluindo Perdido/Excluído) — o mesmo recorte que aparece pro Portal. Não é bug trocar responsável só desses; leads fora desse recorte não são visíveis/acionáveis pela revenda de qualquer forma.

**Privacidade do contato do cliente:** nome/telefone só aparecem no drawer do card (e no e-mail) quando `pci === "PCI12A"` — regra que não pode ser esquecida, nunca em outro cenário/PCI. Fonte: `GET /organizations/:id` (não vem no payload do deal, precisa chamada extra — `getContatoPrincipal()`).

## 7. Cashback e comissão

- **Cálculo:** PCI + classe de preço → percentual em `comercial_bmax_config` (chave `comissao_tabela`, mesma fonte do Motor) → multiplica pelo `amount_total` do deal. Só calcula pra deals em "Venda Efetivada". PCIs 13/14/15 variam por classe (`por_classe`); os demais são percentual fixo.
- **Três tipos de agente creditado por venda:** `revenda`, `representante`, `vendedor_interno` — cada um com seu próprio saldo em `bmax_saldo`/`bmax_transacoes` (`tipo_agente`).
- **Cron `recalcular-comissoes`** (4x/dia): reconcilia o saldo real contra o que a regra de comissão diz que deveria estar creditado agora, pra toda venda efetivada — idempotente, só lança a diferença. Endpoint manual equivalente: `POST /api/cashback/creditar-retroativo`.
- **"Sem Revenda" nunca recebe crédito de revenda** (fix 21/09/2026) — é um valor legítimo pra dado (venda direta, sem parceira), mas não é uma conta que existe pra receber comissão. Constante `REVENDA_SEM_CREDITO` (`constants.js`) usada nos pontos de crédito/agregação — nunca na validação de dado, onde "Sem Revenda" continua opção normal.
- **Cards de venda mostram valor histórico**, não recalculam com a comissão atual — usam `creditosMap` (valores reais de `bmax_transacoes`) quando o lead já foi creditado. Só recalcula ao vivo quando não há crédito ainda. **Essa regra só se aplica ao papel `revenda`/`adm` em `mapDealToCard`** — o card do `representante` sempre recalcula ao vivo, nunca usa `creditosMap`. Ou seja, a "Comissão Total" que o representante vê no dashboard é uma ESTIMATIVA ao vivo dos leads visíveis na tela, não o saldo realmente creditado. O saldo real do representante existe (`tipo_agente='representante'`, alimentado pelo mesmo cron) mas **não há tela nenhuma que mostre esse número** — só existe "Saldo Revendas" (saldo real, mas das revendas parceiras que ele acompanha, não dele).
- **Créditos expiram em 6 meses**, cheques (saque aprovado) em 30 dias. Cron `expirar-cashback` diário processa expirados e avisa 30/15 dias antes.
- **Sem proteção de dedup por `lead_id`** em `creditarCashback` — mesmo lead marcado vendido duas vezes gera crédito duplo (pendência conhecida, não corrigida).

## 8. Bugs de infraestrutura já encontrados e corrigidos (histórico útil pra não repetir)

- **Tabela `RevendaFiliais` nunca existia** em produção (21/09/2026) — bloqueava a criação de qualquer revenda nova (não só filiais), porque toda revenda nova cria uma "filial principal" dentro da mesma transação Sequelize. Se aparecer `relation "X" does not exist` em produção, checar se a tabela foi realmente criada — não existe pipeline de migration automática nesse projeto (sem sequelize-cli, sem pasta `migrations/`); tabelas novas em `src/models/` precisam de `CREATE TABLE` manual em produção.
- **`public/js/*.js` são referenciados com `?v=N`** em `index.html` — editar o JS sem subir o `N` faz o navegador continuar servindo a versão cacheada antiga, mesmo com o arquivo novo já publicado (já causou "corrigi mas não aparece" 2x). Sempre bumpar no mesmo commit.
- **`git push origin main` dispara deploy automático em produção** (integração GitHub↔Vercel) — não existe "só commitar local com segurança"; qualquer push posterior leva junto todo commit ainda não enviado, mesmo commits que não deveriam ir ao ar ainda.
- **Filtro de revenda multi-loja no frontend** (`leads.js`) chegou a refiltrar `API_LEADS` por igualdade exata de nome, duplicando (mal) o que o backend já faz certo via `bmax_grupos` — só "funcionava" pra Luitex por um hack de substring hardcoded. Removido; o backend já entrega a lista certa pro papel `revenda`, o front não deveria refiltrar de novo.
- **`resend.service.js` é código morto** — duplica `email.service.js` quase byte a byte, nunca é importado em lugar nenhum. Candidato a remoção numa limpeza futura.
- **E-mails de "Nova Negociação"** (`negociacao.service.js`) ainda usam `getRepresentativeEmailByName()` puro, sem o fallback `rdToEmail` que foi adicionado em 17/09/2026 pros e-mails de caminho PCI12 — mesma classe de bug (username hoje é e-mail, não nome) pode estar afetando esse fluxo também; não verificado/corrigido ainda.

## 9. Crons (Vercel, `vercel.json`)

| Rota | Horário (UTC) | Faz |
|---|---|---|
| `/api/cron/expirar-cashback` | 10:00 (1x/dia) | Processa créditos/cheques expirados, avisa 30/15 dias antes |
| `/api/cron/sync-revenda-rep-rd` | 10:30 (1x/dia) | Sincroniza picklists RD, detecta PCI12 novo (avisa + inicia tracking 48h) |
| `/api/cron/sync-consulta-lead` | 12:00, 17:00, 21:00 | Pré-computa índice de "Consulta de Lead" (evita timeout de 60s calculando na hora) |
| `/api/cron/recalcular-comissoes` | 12:00, 15:00, 18:00, 21:00 | Reconcilia saldo real vs regra de comissão atual |
| `/api/cron/pci12-followup` | 09:00, 13:00, 17:00, 21:00 | Lembrete 24h + reversão 48h dos PCI12 pendentes |

Todas autenticadas via header `Authorization: Bearer <CRON_SECRET>`. Vercel Hobby só permite 1 `schedule` por entrada rodando 1x/dia — múltiplos horários no mesmo cron = múltiplas entradas em `vercel.json`, não uma única com "várias vezes ao dia".

## 10. Papel no ecossistema BMax

- **RD Station CRM V1** — fonte de verdade dos deals/leads.
- **BMax Motor** (`bmax-motor`, ver `DOCUMENTACAO_TECNICA.md` de lá) — classifica leads nos 16 PCIs, calcula a tabela de comissão que o Portal lê via `comercial_bmax_config`. Compartilha o Supabase `boxer-sistemas` com o Portal, mas é um app separado (Supabase Auth, hospedagem própria).
- **Política Comercial / Bíblia Mestra** — definem as regras de negócio que o código aqui implementa.
