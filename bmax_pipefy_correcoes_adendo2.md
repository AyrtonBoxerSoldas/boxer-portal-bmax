# BMAX ↔ Pipefy: segundo adendo às correções

Complementa o `bmax_pipefy_correcoes.md` e o `bmax_pipefy_correcoes_adendo.md`. Vem da **revisão do código** já implementado (o diff das tarefas 1 a 13 e do primeiro adendo) e da saída do `npm test` (84 testes, todos passando).

**A implementação está boa no geral:** a configuração por variável de ambiente, a tabela fase → etapa do INDÚSTRIA - INTERNO (cada etapa conferida com as constantes do RD), a leitura incremental com a referência pelo maior `updated_at`, o bloqueio das gravações no RD com `CRM_PROVIDER=pipefy`, a validação do PCI e a criação nos dois pipes. Os problemas abaixo são, quase todos, **lugares que ainda pensam só no pipe BMAX** ou que **recebem IDs do RD onde esperam IDs do Pipefy**. Os testes atuais passam porque não exercitam essas situações.

**Onde este adendo e os documentos anteriores divergirem, vale este adendo.**

---

## 1. Regras

As mesmas dos documentos anteriores, mais uma:

- **Cada correção vem com um teste novo que reproduz o problema** (que falharia antes da correção e passa depois). Os critérios de aceite abaixo dizem qual.

---

## 2. Corrigir antes do commit

### A1 · Traduzir os IDs do RD em todas as operações, e não só no `getDealById`

- **Problema:** as tabelas do BMAX (`bmax_pci12_tracking`, `bmax_pci12a_prazo`, o saldo e outras) guardam **IDs de negociação do RD**. Só o `getDealByIdPipefy` passa o ID pelo `resolverCardId`. As outras funções mandam o ID recebido **direto ao Pipefy**: com uma negociação migrada (por exemplo, no cron do prazo do PCI 12A), o Pipefy recebe um ID do RD e a operação falha.
- **Onde:** `src/services/pipefyLeads.service.js`: `updateLeadPipefy`, `createTaskPipefy`, `updateTaskPipefy`, `createNotePipefy` e `getLeadNotesPipefy`.
- **Fazer:** no começo de cada uma, `const cardId = await resolverCardId(idRecebido);` e usar o `cardId` dali em diante. Para um ID que já é de card, o `resolverCardId` devolve o próprio ID, sem chamada nenhuma.
- **Aceite:** um teste para cada função, chamando-a com um **ID do RD** (24 caracteres hexadecimais) presente na `bmax_rd_pipefy_map` simulada, e conferindo que a chamada ao Pipefy usa o **ID do card**.

### A2 · Descobrir o pipe do card no `getDealByIdPipefy`, e procurar o ID do RD em todos os pipes

- **Problema 1:** o `getDealByIdPipefy` traduz todo card com a tabela do **BMAX** (`cardParaDealFake(card, "BMAX")`). Um card do INDÚSTRIA - INTERNO volta **sem etapa e sem `win`**, e a proteção do `caminhoVenda.service.js` (que impede redefinir o caminho de uma negociação já vendida ou perdida) deixa de funcionar para ele.
- **Problema 2:** quando o ID do RD não está na `bmax_rd_pipefy_map`, o `resolverCardId` procura o card **só no pipe BMAX**. As negociações migradas do INDÚSTRIA - INTERNO não são encontradas.
- **Onde:** `src/services/pipefyLeads.service.js` (`getDealByIdPipefy`, `resolverCardId`) e `src/config/pipefyConstants.js`.
- **Fazer:**
  1. Em `pipefyConstants.js`, uma função `nomeDoPipePorId(pipeId)`, que devolve o nome do pipe (a chave em `mapa.pipes`) a partir do ID.
  2. No `getDealByIdPipefy`: `cardParaDealFake(card, nomeDoPipePorId(card.pipe?.id) || "BMAX")`. O `getCard` já pede `pipe { id name }`.
  3. No `resolverCardId`, quando o ID não estiver na tabela: procurar em **todos os pipes de `pipesParaChecarDuplicata()`** (o BMAX e os do painel), um de cada vez, cada um com o **seu** campo "ID no RD CRM" (pelo `pipeConfig` do pipe), e parar no primeiro que achar. Gravar o resultado na tabela, como hoje.
- **Aceite:** (a) `getDealByIdPipefy` com um card simulado do INDÚSTRIA - INTERNO na fase "VENDA EFETIVADA" devolve `deal_stage.id === RD_STAGE_VENDA_EFETIVADA` e `win === true`; (b) `resolverCardId` com um ID do RD que só existe no INDÚSTRIA - INTERNO acha o card e grava na tabela.

### A3 · Mudar a etapa e os campos pelo pipe do card, no `updateLeadPipefy`

- **Problema:** o `updateLeadPipefy` traduz o `stage_id` do RD para uma fase **do BMAX** (`PIPEFY_FASES`) e usa os campos do BMAX (`PIPEFY_CAMPOS`) para qualquer card. Mover uma negociação do INDÚSTRIA - INTERNO falha.
- **Onde:** `src/services/pipefyLeads.service.js` (`updateLeadPipefy`) e `src/config/pipefyConstants.js`.
- **Fazer:**
  1. Descobrir o pipe do card: primeiro no cache (`_cachePorPipe`, procurando o ID do card em cada pipe); se não estiver, com um `getCard` (uma chamada) e o `nomeDoPipePorId` do item A2.
  2. Uma tradução **inversa**, etapa do RD → nome da fase, **por pipe**, a partir de `PIPEFY_FASE_PARA_ETAPA_RD`. Onde a mesma etapa do RD corresponde a mais de uma fase, a escolha precisa ser **explícita**, numa tabela de preferência em `pipefyConstants.js`. Hoje há um caso:
     - **BMAX, `RD_STAGE_PERDIDO`** → **"Prazo Vencido"** (é a etapa que o cron do prazo do PCI 12A grava; a fase "Perdido" é só para perdas marcadas à mão no Pipefy).
  3. Usar o ID da fase **do pipe do card** no `moveCardToPhase`, e os **campos do pipe do card** (pelo `pipeConfig`) para os campos personalizados, o "Valor total" e os campos da próxima ação (também no `createTaskPipefy` e no `updateTaskPipefy`).
  4. Uma etapa do RD sem fase correspondente no pipe do card **lança um erro claro**, sem gravar nada.
- **Aceite:** (a) mudar a etapa de um card do INDÚSTRIA - INTERNO para `RD_STAGE_NEGOCIACAO` move o card para a fase "NEGOCIAÇÃO" desse pipe; (b) `RD_STAGE_PERDIDO` num card do BMAX move para "Prazo Vencido"; (c) uma etapa sem correspondência lança erro e não chama o Pipefy.

### A4 · Incluir sempre o BMAX e o REVENDA - INTERNO no `PIPEFY_MAPA_JSON`

- **Problema:** o `scripts/gerar-pipefy-mapa-env.js` ainda usa o padrão antigo (`PIPEFY_PIPES_PORTAL` = `"BMAX"`) e inclui **só os pipes do painel**. Com o padrão novo (INDÚSTRIA - INTERNO), o `PIPEFY_MAPA_JSON` da produção sairia **sem o BMAX e sem o REVENDA - INTERNO**, e a criação de negociações de revenda, a checagem de duplicidade e as varreduras de renomear quebrariam.
- **Onde:** `scripts/gerar-pipefy-mapa-env.js` e `src/config/validateEnv.js`.
- **Fazer:**
  1. O padrão de `PIPEFY_PIPES_PORTAL` no script passa a ser `"INDÚSTRIA - INTERNO"`, igual ao de `pipefyConstants.js` (de preferência, lendo de lá, para não haver dois padrões).
  2. O JSON reduzido inclui **sempre**: os pipes do painel, o **BMAX** e o **REVENDA - INTERNO** (usado pelas varreduras de revenda). Corrigir também o comentário do topo.
  3. Separar a montagem do JSON numa função exportada (`montarMapaReduzido(mapaCompleto, pipesPortal)`), para poder testá-la.
  4. No `validateEnv.js`: com `CRM_PROVIDER=pipefy`, **avisar** (no log, sem bloquear a inicialização) se o REVENDA - INTERNO faltar no mapa.
- **Aceite:** teste do `montarMapaReduzido` com um mapa completo simulado e `PIPEFY_PIPES_PORTAL` sem valor: o resultado tem o INDÚSTRIA - INTERNO, o BMAX e o REVENDA - INTERNO, além dos contatos, das empresas e dos membros.

### A5 · Não forçar leitura completa na checagem de duplicidade

- **Problema:** quando o `getLeadByCnpjPipefy` **não** acha a duplicata (o caso normal de toda negociação nova), ele apaga o cache dos pipes e força uma **leitura completa**: cerca de 18 chamadas por negociação (17 do INDÚSTRIA - INTERNO e 1 do BMAX). Com 10 negociações por dia, cerca de **5.400 chamadas por mês**, metade do limite da empresa inteira. (A origem é o documento de correções, que pedia para "buscar de novo".)
- **Onde:** `src/services/pipefyLeads.service.js` (`getLeadByCnpjPipefy`, e também `varrerEAtualizarCampoNoPipefy`, que apaga o cache depois das varreduras).
- **Fazer:** em vez de apagar o cache, **forçar só a leitura incremental** dos pipes: por exemplo, um parâmetro `{ forcarIncremental: true }` em `atualizarPipeNoCache`, que ignora o tempo do `PIPEFY_CACHE_MIN` e faz a leitura incremental na hora (1 chamada por pipe, normalmente). A leitura completa continua só no cache vazio e na leitura diária.
- **Aceite:** teste em que o CNPJ não é encontrado: a segunda busca chama o `allCardsAtualizadosDesde` (uma vez por pipe) e **não** chama o `allCardsInPipe`.

### A6 · Guardar o cache no banco, para sobreviver às novas instâncias da Vercel

- **Problema:** o cache fica na memória. Na Vercel, cada nova instância da função começa com o cache vazio e faz uma **leitura completa** (cerca de 18 chamadas). Se o BMAX tiver muitas "partidas a frio" por dia, o consumo sobe sem aviso, e a leitura incremental quase não é usada.
- **Onde:** `src/services/pipefyLeads.service.js` e um script novo de criação de tabelas.
- **Fazer:**
  1. Duas tabelas, criadas por um script no mesmo estilo do `create-rd-pipefy-map-table.js` (idempotente):
     - `bmax_pipefy_cache_cards` (`pipe` texto, `card_id` texto, `card` JSONB, `atualizado_em`; chave primária em `pipe` + `card_id`);
     - `bmax_pipefy_cache_estado` (`pipe` texto como chave, `maior_updated_at` texto, `ultima_leitura_completa` timestamp).
  2. No `atualizarPipeNoCache`, quando o cache **em memória** estiver vazio: **carregar do banco** (sem chamar o Pipefy) e, a partir daí, seguir com a leitura incremental normal. A leitura completa só acontece se o banco também estiver vazio, ou se a última leitura completa (gravada no estado) tiver mais de 24 horas.
  3. Depois de cada leitura (completa ou incremental) e de cada `atualizarCardNoCache`, gravar no banco os cards alterados e o estado. Numa leitura completa, apagar do banco os cards do pipe que não vieram (foram apagados ou movidos).
  4. Se o banco falhar, seguir só com a memória (como hoje) e registrar um aviso: o cache nunca pode derrubar o painel.
- **Aceite:** teste que simula uma nova instância (o cache em memória vazio, com o banco simulado já preenchido): a primeira listagem **não** chama o `allCardsInPipe` e chama o `allCardsAtualizadosDesde` com o `maior_updated_at` do banco.

---

## 3. Importantes

### B1 · Dividir em lotes as gravações em vários cards

- **Onde:** `src/services/pipefy.service.js` (`updateFieldEmVariosCards`).
- **Problema:** todos os cards vão numa só chamada, sem limite. Numa renomeação com centenas de cards, o pedido pode passar do tamanho ou da complexidade que o Pipefy aceita.
- **Fazer:** dividir em lotes de **30** cards por chamada, e somar os resultados. Uma falha num lote não impede os outros, e a função devolve quantos foram atualizados e quantos falharam.
- **Aceite:** teste com 75 cards: 3 chamadas (30, 30 e 15).

### B2 · Paginação do `findCards` com alternativa

- **Onde:** `src/services/pipefy.service.js` (`findCardsByFieldValue`).
- **Problema:** não foi confirmado na conta se o `findCards` aceita `first`/`after`. Se não aceitar, a busca por ID do RD e as varreduras quebram.
- **Fazer:** se a chamada com paginação voltar com um erro que mencione os argumentos `first` ou `after`, **repetir sem paginação** (uma página só) e registrar um aviso.
- **Aceite:** teste em que a primeira chamada falha com "Field 'findCards' doesn't accept argument 'first'": a função repete sem paginação e devolve os cards.

### B3 · Testar na conta, antes da virada, a troca das opções de um campo

- **O quê:** o `updatePhaseField` com `options` (usado nas renomeações) não está documentado pelo Pipefy.
- **Fazer:** **não é código**: documentar no `PIPEFY_PENDENCIAS.md` o teste manual num pipe de teste: acrescentar uma opção a um campo de seleção e conferir pela tela que **as opções antigas continuam lá** e que o campo **não mudou de obrigatório para opcional** (ou o contrário). Até esse teste, as renomeações não devem ser usadas em produção.

### B4 · Ler as datas dos campos do Pipefy nos dois formatos

- **Onde:** `src/services/pipefyLeads.service.js` (`cardParaDealFake`, a leitura do campo "Data de criação no RD").
- **Problema:** não foi confirmado em que formato o Pipefy devolve o valor de um campo de data. Se vier como `12/05/2026`, o `new Date(...)` do JavaScript o lê como **5 de dezembro**, e o filtro do painel (negociações criadas desde 01/05/2026) erra sem avisar.
- **Fazer:** uma função `paraDataIso(valor)` que aceite `AAAA-MM-DD` (com ou sem hora) e `DD/MM/AAAA` (com ou sem hora) e devolva a data no formato ISO; um valor em formato desconhecido vira `null`, com um aviso no log. Usar no `created_at` e em qualquer outro campo de data lido do Pipefy.
- **Aceite:** testes com `"2026-05-12"`, `"12/05/2026"`, `"12/05/2026 10:30"` e `"lixo"`.

---

## 4. Menores

### C1 · Testar de verdade a tradução do responsável

- **Problema:** na saída do `npm test`, aparece "Falha ao carregar alias" com o erro `sbSistemasService is not a function`. No teste da atribuição do responsável, a função `getAliasMaps` falha no ambiente de teste, e o código segue pelo caminho de "responsável não encontrado". Então o caminho principal (o ID do RD → o nome → o e-mail → o membro do Pipefy) **não está sendo testado**.
- **Fazer:** simular a dependência (`sbSistemasService` ou o próprio `getAliasMaps`) no teste, com um vendedor de exemplo.
- **Aceite:** teste em que o `owner_id` de um vendedor do RD resulta em `updateCardAssignees` chamado com o **ID do membro** certo.

### C2 · Pequenos ajustes

- No `textoTarefa`, trocar o `"?????"` por `"não informado"` quando não houver responsável.
- No contador de chamadas (`contarChamadaPipefy`), registrar cada chamada no nível **debug**, e só a cada 50 chamadas (e na primeira do dia) no nível **info**, para não poluir o log.

---

## 5. Checklist antes da virada (acréscimos)

- [ ] As correções A1 a A6 implementadas, com os testes novos passando.
- [ ] O `PIPEFY_MAPA_JSON` gerado de novo, com o script corrigido (A4), a partir do mapa mais recente, e conferido: ele tem o INDÚSTRIA - INTERNO, o BMAX e o REVENDA - INTERNO.
- [ ] As tabelas do cache (A6) e a `bmax_rd_pipefy_map` criadas no banco de produção.
- [ ] O teste manual das opções de campo (B3) feito num pipe de teste.
- [ ] O formato das datas (B4) conferido com um card real.
- [ ] Na primeira semana depois da virada, acompanhar no log o total de chamadas por dia e quantas leituras completas aconteceram.
