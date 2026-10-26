# Pendências da migração RD Station → Pipefy

Inventário de toda função que fala com o RD Station, pra acompanhar o que já
funciona com `CRM_PROVIDER=pipefy`, o que está bloqueado de propósito (nunca
grava no RD nesse modo) e o que ainda depende de uma decisão de negócio
antes de implementar. Ver `guia_bmax_pipefy.md` (local, não versionado) e o
plano da migração pro contexto completo.

## Migrada (funciona com `CRM_PROVIDER=pipefy`)

| Função | Arquivo | Observação |
|---|---|---|
| `fetchAllDealsFromRD` | `rd.leads.service.js` | Lista cards dos pipes de `PIPEFY_PIPES_PORTAL` (`fetchAllDealsPipefy`, padrão só `INDÚSTRIA - INTERNO`) |
| `createLead` | `rd.leads.service.js` | Cria negociação em `INDÚSTRIA - INTERNO` ou `BMAX` (mesma regra de funil do RD) — liga Empresa pelo CNPJ (acha/cria, 26/10/2026); sem contato vinculado se o formulário não tiver e-mail |
| `updateLead` | `rd.leads.service.js` | Grava etapa/campos/valor/responsável (`updateLeadPipefy`); caminho "BOX+REV>IND" (etapa só existe no INDÚSTRIA - INTERNO) transfere o card do BMAX pra lá (`transferirCardParaIndustria`, Tarefa B1, 26/10/2026) |
| `getLeadByCnpj` | `rd.leads.service.js` | Checagem de duplicata (`getLeadByCnpjPipefy`) — nos pipes de `PIPEFY_PIPES_PORTAL` + `BMAX` sempre |
| `getDealById` | `rd.leads.service.js` | Resolve ID do RD ou do Pipefy (`resolverCardId` + `getDealByIdPipefy`) |
| `createTask` | `rd.leads.service.js` | Vira comentário + campos "Próxima ação"/"Data da próxima ação" |
| `createNote` | `rd.leads.service.js` | Vira comentário |
| `updateTask` | `rd.leads.service.js` | Atualiza campos "Próxima ação"/"Data da próxima ação" |
| `getLeadNotes` | `rd.leads.service.js` | Lê comentários do card |
| `renomearRepresentanteNoRD` | `rd.leads.service.js` | Varre o pipe BMAX, acrescenta a opção nova no campo "Representante" e atualiza os cards em lote (Tarefa 9, 19/10/2026) |
| `renomearRevendaNoRD` | `rd.leads.service.js` | Idem, varre BMAX e REVENDA - INTERNO, campo "Revenda/Loja" |
| `reatribuirRepresentanteDaRevendaNoRD` | `rd.leads.service.js` | Idem, busca por "Revenda/Loja" mas grava em "Representante" |

Consumidores indiretos (chamam `getLeads`/`getCustomField`/`mapDealToCard`,
não precisam de nenhuma mudança própria — já funcionam através do despacho
acima): `leads.controller.js`, `negociacao.service.js`,
`caminhoVenda.service.js`, `saldo.service.js`, `whatsappResumo.service.js`,
`export.routes.js`.

## Bloqueada (lança erro explícito com `CRM_PROVIDER=pipefy`, nunca grava no RD)

| Função | Arquivo | Por quê não foi migrada |
|---|---|---|
| `syncRevendasToRD` | `rd.leads.service.js` | Reescreve picklist de campo do RD — Pipefy usa tabela de Empresas linkada, não picklist |
| `syncRepresentantesToRD` | `rd.leads.service.js` | Mesma razão, campo Representante |
| `createOrg` | `rd.leads.service.js` | Só chamada internamente por `createLead` (RD) — nunca alcançada em modo pipefy na prática, guard mantido por defesa |

Chamadoras diretas de Gestão que ainda dependem do sync de picklist
(`syncRevendasToRD`/`syncRepresentantesToRD`) continuam funcionando
normalmente com `CRM_PROVIDER=rd`; com a flag ligada, essas telas precisam
de uma versão Pipefy própria antes de serem usadas (ver sugestão abaixo) —
`users.controller.js`, `admin.routes.js`. As renomeações em massa (rename de
representante/revenda, reatribuição) já migraram — ver "Migrada" acima.

## Fica sempre no RD, sem bloqueio explícito (leitura, sem risco de gravar errado)

| Função | Arquivo | Observação |
|---|---|---|
| `getContatoPrincipal` | `rd.leads.service.js` | Nome/telefone do cliente pro e-mail de PCI12A — **quebra em modo pipefy** se o `dealId` for um card id do Pipefy (chama a Organização do RD com um ID que não existe lá). Ver sugestão de equivalente abaixo. |
| `getRdUsuariosAtivos` | `rd.leads.service.js` | Lista de usuários ativos do RD (dropdown "Responsável" na Nova Negociação) |
| `getOpcoesRevendaRD` / `getOpcoesRepresentanteRD` | `rd.leads.service.js` | Leitura de picklist, usada como blindagem antes de rename |
| `getOrg` / `getOrgByCNPJ` | `rd.leads.service.js` | `getOrg` parece sem chamador fora do próprio arquivo; `getOrgByCNPJ` só é usada internamente por `createLead` (RD) |
| `buscarLead` / `buildConsultaLeadIndex` / `fetchAllDealsAllPipelines` | `rd.leads.service.js` | Consulta de Lead do Motor — varredura completa dos 5 funis do RD |

## Resolvido no adendo de 19/10/2026 (bmax_pipefy_correcoes_adendo.md)

- **Pipes que o Portal lê** (`PIPEFY_PIPES_PORTAL`): decidido — padrão
  `INDÚSTRIA - INTERNO`, o mesmo (único) funil que o painel RD lê hoje
  (`fetchAllDealsFromRD`/`RD_PIPELINE_INDUSTRIA`). Continua configurável,
  não hardcoded. Cada pipe adicionado precisa da sua própria tabela
  fase→etapa RD em `PIPEFY_FASE_PARA_ETAPA_RD` (`pipefyConstants.js`) — hoje
  cobertos: `BMAX` e `INDÚSTRIA - INTERNO`.
- **Histórico de vendas desde 01/05/2026**: resolvido — o escopo da migração
  cresceu pra incluir as negociações **ganhas e perdidas** desde essa data
  (não só as abertas/pausadas), então saldo/comissão/cashback vão ler isso
  direto do Pipefy, sem cópia local. Pendência nova decorrente disso: os
  campos "Data de fechamento no RD" e "Motivo de perda" (citados no adendo)
  **ainda não existem** no `mapa_pipefy.json` atual — quando forem
  adicionados, só precisam entrar em `ROTULO_RD_POR_CAMPO_PIPEFY`
  (`pipefyLeads.service.js`) pra `cardParaDealFake` passar a lê-los.

## Pendente de decisão (registrado aqui, não implementado)

- **Sincronismo de revenda/representante (picklist)** (`syncRevendasToRD`,
  `syncRepresentantesToRD`): equivalente sugerido — tratar como registros do
  database **Empresas Comercial**/tabela de representantes (criar/atualizar
  via `createTableRecord`/`findRecords`), em vez de reescrever um picklist.
  Precisa de desenho próprio antes de implementar. (Diferente de
  `renomearRepresentanteNoRD`/`renomearRevendaNoRD`/
  `reatribuirRepresentanteDaRevendaNoRD`, que já migraram — ver "Migrada"
  acima.)
- **`getOrgByCNPJ`/`createOrg` no sentido Pipefy**: ainda sem decisão/
  implementação (ex.: sincronizar dados da Org/Empresa além do vínculo
  básico). **Resolvido em 26/10/2026**: `createLeadPipefy` passou a
  achar/criar e ligar o registro de Empresa (database Empresas Comercial)
  pelo CNPJ — mesmo padrão do Contato (achado real: um card sem Empresa não
  tinha o que `transferirCardParaIndustria`/Tarefa B1 copiar nesse campo,
  deixando o card novo sem Empresa depois da transferência). **Ajustado em
  26/10/2026**: confirmado na conta real que o database Empresas Comercial
  grava CNPJ só com números — o CNPJ do formulário é normalizado
  (`normalizeCnpj`) antes de buscar/gravar, pra um CNPJ pontuado não deixar
  de achar o registro existente e criar outro duplicado. Achar/criar a
  Empresa agora também é protegido por try/catch: se falhar, o card é criado
  do mesmo jeito (só sem Empresa vinculada), com aviso em log.
- **`getContatoPrincipal` no sentido Pipefy**: equivalente sugerido — ler o
  registro conectado ao campo "Contato" do card (a mesma tabela Contatos
  Comercial que `createLeadPipefy` já usa pra criar o contato).
- **Consulta de Lead do Motor** (`buscarLead`/`buildConsultaLeadIndex`):
  equivalente sugerido — ler os pipes configurados em `PIPEFY_PIPES_PORTAL`
  usando o cache de `fetchAllDealsPipefy` (Tarefa 4), em vez de uma
  varredura própria.

## Confirmado na conta real em 20/10/2026 (bmax_pipefy_correcoes_adendo.md, atualização)

- **Filtro incremental de `allCards`** (`allCardsAtualizadosDesde`,
  `pipefy.service.js`, Tarefa 4): **testado e funciona** —
  `filter: { field: "updated_at", operator: gt, value: "<ISO 8601 com fuso>" }`
  devolve só os cards alterados depois da referência. A referência usada é o
  maior `updated_at` já visto no cache (não o relógio local do BMAX, pra não
  perder alterações por diferença de fuso/relógio entre os dois servidores).
  Também confirmado: os campos certos são `created_at`/`updated_at` (não
  `createdAt`, como o documento original dizia — já corrigido no código);
  `allCards` só filtra por data, nenhum campo personalizado (por isso
  `findCards` continua sendo o caminho pra achar cards por valor de campo,
  usado em `resolverCardId`/Tarefa 9); e um comentário no card também muda o
  `updated_at` (card comentado reaparece na leitura incremental — inofensivo).
- **`options` em `updatePhaseField`** (`pipefy.service.js`, Tarefa 9): o
  `uuid` obrigatório foi confirmado na conta real (achado do usuário), mas
  alterar a lista de opções de um campo de seleção via `options` não está
  documentado oficialmente — testar `renomearRepresentanteNoRD`/
  `renomearRevendaNoRD`/`reatribuirRepresentanteDaRevendaNoRD` num pipe de
  teste antes de confiar em produção.
- **`findCardsByFieldValue`/`allCardsInPipe` com paginação** (`first`/
  `after`): já eram "(conferir)" desde a Fase 1/2 — desde o 2º adendo
  (23/10/2026, Tarefa B2), `findCardsByFieldValue` já tem um caminho
  alternativo sem paginação, usado automaticamente se o Pipefy recusar
  `first`/`after` (ver item abaixo).

## 2º adendo de revisão de código (23/10/2026, bmax_pipefy_correcoes_adendo2.md)

Revisão do código das Fases 1-3 encontrou várias funções que ainda só
pensavam no pipe BMAX, ou que recebiam IDs do RD onde o Pipefy espera IDs de
card — corrigido:

- **Tradução de ID do RD** passou a acontecer em TODAS as operações
  (`updateLeadPipefy`, `createTaskPipefy`, `updateTaskPipefy`,
  `createNotePipefy`, `getLeadNotesPipefy`), não só em `getDealById` —
  `resolverCardId` também passou a procurar em todos os pipes de
  `pipesParaChecarDuplicata()` (antes só no BMAX).
- **`getDealByIdPipefy`** traduz pela tabela do pipe DO CARD
  (`nomeDoPipePorId`), não sempre BMAX — um card do INDÚSTRIA - INTERNO
  agora volta com etapa/`win` certos.
- **`updateLeadPipefy`/`createTaskPipefy`/`updateTaskPipefy`** descobrem o
  pipe do card (`nomePipeDoCard`) e usam a fase/campos DESSE pipe — com
  tradução reversa etapa do RD → fase, por pipe (`faseParaEtapaRdReversa`).
  Mudança de comportamento: uma etapa sem fase correspondente no pipe do
  card agora **lança erro e não grava nada** (antes só avisava em log e
  seguia gravando o resto).
- **`scripts/gerar-pipefy-mapa-env.js`** passou a incluir sempre BMAX e
  REVENDA - INTERNO no `PIPEFY_MAPA_JSON` gerado, além dos pipes do painel
  (`PIPEFY_PIPES_PORTAL`, lido de `pipefyConstants.js`, não mais um default
  próprio dessincronizado) — sem isso, o mapa reduzido de produção quebraria
  criação de negociação de revenda e as 3 rotinas de renomear.
  `validateEnv.js` agora avisa (sem bloquear) se REVENDA - INTERNO faltar.
- **Checagem de duplicidade de CNPJ** (`getLeadByCnpjPipefy`) não força mais
  leitura COMPLETA quando não acha no cache — força só uma leitura
  INCREMENTAL (`forcarIncremental`), reduzindo de ~18 pra ~2 chamadas por
  negociação nova checada.
- **Cache também persiste no banco** (`bmax_pipefy_cache_cards`/
  `bmax_pipefy_cache_estado`, script `scripts/create-pipefy-cache-tables.js`)
  — uma instância nova da Vercel carrega do banco antes de chamar o Pipefy,
  em vez de sempre começar com leitura completa. Best-effort: falha no banco
  nunca derruba o painel, só cai pra memória.
- **`updateFieldEmVariosCards`** divide em lotes de 30 cards por chamada.
- **`findCardsByFieldValue`** cai pra uma única chamada sem paginação se o
  Pipefy recusar `first`/`after`.
- **`paraDataIso`** (`cardParaDealFake`) trata os 2 formatos possíveis do
  campo "Data de criação no RD" (`AAAA-MM-DD` e `DD/MM/AAAA`, com ou sem
  hora) — formato desconhecido vira `null` com aviso, em vez de uma data
  errada silenciosa.

**Testado na conta real em 26/10/2026 (ver seção do 3º adendo abaixo):**
`updatePhaseField` com `options` **substitui a lista inteira** de opções do
campo — mandar a lista completa (antigas + nova) mantém todas e não muda o
campo de obrigatório↔opcional. Confirmado: as renomeações já podem ser
usadas em produção.

## 3º adendo de revisão de código (23/10/2026, bmax_pipefy_correcoes_adendo3.md)

Revisão das correções do 2º adendo (A1-A6, B1, B2, B4, C1, C2 — todas
implementadas e testadas, 109/109 à época) encontrou mais 2 itens a corrigir
antes da virada, 1 decisão de negócio pendente, e 3 pontos pra testar na
conta real:

- **`salvarCardsNoBanco`** (cache no banco, A6 do 2º adendo) gravava **um
  card por consulta** — numa leitura completa do INDÚSTRIA - INTERNO
  (~850 cards), isso é ~850 consultas seguidas dentro da própria requisição
  do painel, risco real de estourar o tempo-limite da função na Vercel.
  Corrigido: grava em lotes de 100, um único `INSERT ... VALUES (...），(...)...`
  por lote (3 consultas pra 250 cards, por exemplo), sempre com os
  parâmetros via replacements nomeados (nunca concatenando o conteúdo do
  card no texto da consulta).
- **Dois ajustes de consistência no cache** (`atualizarPipeNoCache`/
  `atualizarCardNoCache`): (1) quando a leitura incremental falha e cai pra
  uma leitura completa de reserva, o resultado agora **substitui** o mapa em
  memória (e o que sobrou é passado pro `removerCardsApagadosDoBanco`), em
  vez de só somar — antes, um card apagado/movido pra outro pipe nesse
  cenário ficava preso no cache até a próxima leitura diária; (2) quando
  `atualizarCardNoCache` descobre que um card sumiu (`getCard` devolve
  vazio), a linha correspondente também é apagada de
  `bmax_pipefy_cache_cards` — antes só saía da memória e voltava sozinha na
  próxima instância nova da Vercel. O comportamento de **não** avançar
  `maiorUpdatedAt` na gravação do próprio card foi revisado e mantido de
  propósito (avançar perderia alterações de outras pessoas feitas no
  intervalo) — só ganhou um comentário no código explicando a decisão.

**Decisão tomada e implementada em 26/10/2026 — Tarefa B1 do 3º adendo:** o
caminho de venda "BOX+REV>IND" (`aplicarCaminhoVenda`,
`caminhoVenda.service.js`) pede a etapa "Negociação" pra um card do BMAX —
que não tem essa fase (só existe no INDÚSTRIA - INTERNO, como "NEGOCIAÇÃO").
Como o Pipefy não move card entre pipes, `updateLeadPipefy`
(`pipefyLeads.service.js`, `transferirCardParaIndustria`) agora, nesse caso
específico:
1. lê o card de origem;
2. cria um card NOVO no INDÚSTRIA - INTERNO, direto na fase "NEGOCIAÇÃO",
   copiando os campos que existirem nos dois pipes (Contato, Empresa, CNPJ,
   Cidade, Estado, Representante, Revenda/Loja, Máquina de interesse,
   Oportunidade de venda, Frente de trabalho, Segmento de produto, Classe de
   preço, Fonte, Campanha, ID no RD CRM), sempre com PCI (`"Sem PCI"` se a
   origem não tiver — obrigatório nesse pipe) e com "Valor total"/"Data de
   criação no RD" convertidos do formato BR do Pipefy (`1.234,56`/
   `12/05/2026`, confirmado na conta real) pro formato interno
   (`1234.56`/`AAAA-MM-DD`) — sem "Data de criação no RD" na origem, usa o
   `created_at` do próprio card. **Correção testada na conta real,
   26/10/2026**: "Contato"/"Empresa" são campos de CONEXÃO — o `value` do
   card de origem traz os TÍTULOS dos registros ligados, não os IDs
   (gravar isso de volta faz o Pipefy ignorar a conexão em silêncio, sem
   erro); os IDs de verdade vêm de `array_value`/`connectedRepoItems[].id`
   (`getCard` agora pede os dois — `pipefy.service.js`), confirmados iguais
   entre si na conta real. Sem ID conectado, o campo não é copiado e um
   aviso é logado com os dois IDs de card;
3. comenta a ligação nos dois cards;
4. copia o responsável (assignees) do card de origem pro novo (sobrescrito
   depois se o `body` da chamada trouxer outro `owner_id`);
5. move o card de origem pra uma fase final própria do BMAX, "Transferido
   para a Indústria" (mapeada em `PIPEFY_FASE_PARA_ETAPA_RD.BMAX` pra ficar
   fora do painel e da checagem de duplicidade);
6. grava a ligação em `bmax_pipefy_transferencias` (script
   `scripts/create-pipefy-transferencias-table.js`).

Se a criação do card novo falhar, nada mais acontece (nem o de origem é
movido, nem a ligação é gravada) e o erro sobe. As etapas seguintes (3-6)
falhando só registram o erro em log com os dois IDs, pra correção à mão — o
card novo já existe, que é a parte que importa. `resolverCardId` passa a
seguir a ligação em `bmax_pipefy_transferencias` (até o card vivo, inclusive
em cadeia) depois de resolver um ID do RD, então as tabelas do BMAX que
guardam o ID antigo continuam funcionando sem nenhuma migração.

**Testado na conta real em 26/10/2026 (todos os 4 pontos da seção 3 do 3º
adendo) — resultado de cada um:**

- [x] **Formato de data e valor que o Pipefy devolve de verdade**: datas
  vêm como `DD/MM/AAAA` (ex.: `12/05/2026`) e valores em formato BR
  (ex.: `1.234,56`), **mesmo quando gravados como `2026-05-12` e `1234.56`**
  — o Pipefy normaliza na leitura. `paraDataIso` já cobre `DD/MM/AAAA`; via
  este adendo, `parseValorMonetario` foi corrigido (ver abaixo) pra também
  cobrir o padrão de milhar BR sem vírgula (ex.: `1.000`).
- [x] **Troca do responsável** (`updateCardAssignees`, `updateCard` com
  `assignee_ids`): funciona.
- [x] **Troca das opções de um campo** (`updatePhaseField` com `options`):
  **substitui a lista inteira** de opções — mandar a lista completa
  (antigas + nova) mantém todas as antigas e não muda o campo de
  obrigatório↔opcional. As 3 rotinas de renomear já mandam a lista
  completa (leem via `getStartFormFields`, acrescentam a opção nova,
  mandam tudo de volta) — nenhuma mudança de código necessária aqui, só a
  confirmação. **Renomeações liberadas pra uso em produção.**
- [x] **Paginação do `findCards`**: o Pipefy aceita `first`/`after`
  normalmente — o caminho sem paginação (`findCardsByFieldValueSemPaginacao`,
  Tarefa B2 do 2º adendo) é só um fallback defensivo, não entra em uso na
  prática.

**Dois ajustes feitos a partir desses testes (3º adendo, seção 3, itens 1 e
2 — cada um com teste novo):**

- **`parseValorMonetario`** não tratava corretamente o padrão de milhar BR
  SEM vírgula (ex.: `"1.000"` virava `1`, não `1000` — o `.` era lido como
  ponto decimal). Corrigido: sem vírgula, um valor no formato
  `\d{1,3}(\.\d{3})+` (ex.: `1.000`, `1.234.567`) tem os pontos removidos
  antes de converter. Casos confirmados com teste:
  `"1.234,56"` → `1234.56`, `"1.234.567,89"` → `1234567.89`,
  `"0,50"` → `0.5`, `"1.000"` → `1000`.
- **Rotinas de renomear** (`renomearRepresentanteNoPipefy`/
  `renomearRevendaNoPipefy`/`reatribuirRepresentanteDaRevendaNoPipefy`, via
  `acrescentarOpcaoSeFaltar`) já liam a lista ATUAL do campo
  (`getStartFormFields`) e mandavam a lista completa de volta — confirmado
  com um teste novo (campo com 3 opções, renomeia 1, as outras 2 continuam
  na lista enviada ao `updatePhaseField`).
