# BMAX ↔ Pipefy: correções antes da virada

Especificação para implementação. Ela vem de uma revisão do código da integração com o Pipefy (`src/services/pipefy.service.js`, `src/services/pipefyLeads.service.js`, `src/config/pipefyConstants.js` e os pontos de `src/services/rd.leads.service.js` que despacham para eles), feita com o contexto completo da migração RD Station → Pipefy.

**Objetivo:** deixar o BMAX pronto para funcionar com `CRM_PROVIDER=pipefy` no dia da virada, sem quebrar nada enquanto o padrão continua sendo `rd`.

---

## 1. Contexto

### 1.1 A migração

- A empresa sai do **RD Station CRM** e vai, **provisoriamente**, para o **Pipefy**, até a plataforma própria (Boxer Station) ficar pronta.
- **Escopo da migração para o Pipefy:** só as negociações **abertas e pausadas** do RD CRM, com os contatos e empresas ligados a elas, as notas (como comentários) e as tarefas em aberto (como comentário mais os campos "Próxima ação" e "Data da próxima ação"). **As negociações ganhas e perdidas não vão para o Pipefy.**
- **Estrutura no Pipefy:** um pipe por funil do RD (`INDÚSTRIA - INTERNO`, `FUNIL SDR`, `REVENDA - INTERNO`, `BMAX`), com as fases iguais às etapas do RD. Contatos no database **Contatos Comercial**, empresas no **Empresas Comercial**.
- **Pipe BMAX, fases:** `Leads Revenda`, `Prazo Vencido`, `Venda Efetivada` (final, ganho) e `Perdido` (final, perdido; criada no Pipefy, não existe no funil BMAX do RD).
- **Cada card migrado tem o campo "ID no RD CRM"** com o ID da negociação no RD.
- **Na virada, o RD CRM passa a ser só de consulta.** A partir daí, **nada pode gravar no RD CRM**.

### 1.2 O que os testes na conta real do Pipefy mostraram

- **Endpoint:** `https://api.pipefy.com/graphql`, com `Authorization: Bearer <token>`. Só administradores usam a API; para produção, usar o token de uma **conta de serviço**.
- **Limites do plano Enterprise:** **10.000 chamadas por mês para a organização inteira** (o BMAX divide esse limite com a carga da migração e com a integração RD Marketing → Pipefy, no Power Automate) e 500 chamadas a cada 30 segundos. **Economia de chamadas é requisito, não otimização.**
- **O Pipefy devolve erros com código HTTP 200**, dentro de `errors` no corpo. O `pipefyFetch` já trata isso.
- **`findRecords` exige `tableId: String!`**, e não `ID!` (confirmado com erro real: "Type mismatch on variable $t and argument tableId (ID! / String!)").
- **`findCards(pipeId: ID!, search: {fieldId, fieldValue})`** funciona.
- **`createCard` aceita `phase_id`:** o card é criado direto na fase. **`createTableRecord` usa `table_id: ID!`** e funciona.
- **Várias mutations num só pedido** (com apelidos) funcionam e contam como **uma** chamada.
- **Campos de opções aceitam só valores exatamente iguais às opções** (sem espaços a mais). Um valor fora da lista faz o Pipefy recusar a operação inteira.
- **Um campo de conexão só aceita registros do database ao qual ele está ligado.** Um registro de outro database é **ignorado sem erro**.
- **O Pipefy mostra o primeiro campo como o nome do card** (no BMAX, o campo "Título").
- **Mover um card entre fases** só funciona se a passagem estiver liberada nas configurações da fase (feito pela tela, não pela API). **Não existe mutation para mover um card para outro pipe.**

### 1.3 A configuração

O `mapa_pipefy.json` é gerado pela ferramenta da migração e tem, para cada pipe, o ID do pipe, os IDs das fases (por nome) e os IDs dos campos (por rótulo); os IDs dos databases de contatos e empresas e dos campos deles; e os membros da organização (e-mail → ID). **Ele está no `.gitignore`** (tem e-mails de funcionários) e **por isso não chega à produção** se a publicação na Vercel vem do Git.

---

## 2. Regras para a implementação

1. **Com `CRM_PROVIDER=rd` (o padrão), o comportamento atual não muda em nada.** Toda alteração do lado Pipefy fica atrás da opção.
2. **Com `CRM_PROVIDER=pipefy`, nenhuma chamada grava no RD CRM.** Uma operação ainda não migrada deve **falhar de forma explícita** (erro claro e log), e nunca gravar no RD em silêncio. Leituras no RD continuam permitidas só onde estiver dito.
3. **Nenhum token, senha ou e-mail de funcionário no código ou nos testes.**
4. **Testes com Jest (`npm test`), com o `fetch` simulado.** Os testes **nunca** chamam a API real do Pipefy nem a do RD.
5. **Uma tarefa por vez, na ordem deste documento**, com os testes da tarefa passando antes de seguir.
6. **Comentários em português**, no mesmo estilo do código atual.
7. **Marcar com `(conferir)`** qualquer chamada ao Pipefy que não estiver na lista da seção 1.2, para ser testada na conta antes do uso.

---

## 3. Tarefas, na ordem

### Tarefa 1 · Corrigir o tipo da busca de contatos (rápida)

- **Onde:** `src/services/pipefy.service.js`, `findContatoPorEmail`.
- **Problema:** declara `$tabela: ID!`; o Pipefy exige `String!` no `findRecords`. A busca falha sempre.
- **Fazer:** trocar para `query($tabela: String!, $campo: String!, $valor: String!)`. Atualizar o comentário: deixa de ser "(conferir)", porque foi testado na conta.
- **Aceite:** teste unitário confirmando que a query enviada declara `$tabela: String!`.

### Tarefa 2 · Configuração do Pipefy por variável de ambiente (rápida)

- **Onde:** `src/config/pipefyConstants.js`, `src/config/validateEnv.js`, `README.md`.
- **Problema:** o mapa vem de um arquivo ignorado pelo Git, que não existe na produção.
- **Fazer:**
  1. Ler a configuração da variável **`PIPEFY_MAPA_JSON`**, com o arquivo `mapa_pipefy.json` como alternativa só para uso local:
     ```js
     let mapa = {};
     if (process.env.PIPEFY_MAPA_JSON) {
         mapa = JSON.parse(process.env.PIPEFY_MAPA_JSON);
     } else {
         try { mapa = require("../../mapa_pipefy.json"); } catch (e) { /* esperado fora do ambiente local */ }
     }
     ```
  2. Criar um script, `scripts/gerar-pipefy-mapa-env.js`, que lê o `mapa_pipefy.json` local e imprime um JSON **reduzido** para colar na variável: só os pipes usados pelo portal (ver tarefa 11), `contatos`, `empresas` e, dos `membros`, só os e-mails dos responsáveis que o BMAX atribui (ver tarefa 6).
  3. No `validateEnv.js`: com `CRM_PROVIDER=pipefy`, exigir `PIPEFY_MAPA_JSON` na produção (ou o arquivo, fora dela) e validar que o JSON tem `pipes.BMAX.id`.
  4. Documentar no `README.md` como gerar e onde configurar a variável (Vercel → Environment Variables).
- **Aceite:** com a variável definida, as constantes vêm dela; sem a variável e sem o arquivo, o `validateEnv` acusa a falta quando `CRM_PROVIDER=pipefy`.

### Tarefa 3 · O card traduzido com os dados completos (bloqueante)

- **Onde:** `src/services/pipefy.service.js` (`allCardsInPipe`, `getCard`) e `src/services/pipefyLeads.service.js` (`cardParaDealFake`).
- **Problema:** o `cardParaDealFake` devolve `created_at: null`, `amount_total: 0`, `user: null`, `win: null` e o **nome** da fase em `deal_stage.id`. Consequências:
  - o `getLeads` descarta tudo o que foi criado antes de 01/05/2026, e `new Date(null)` é 1970: **o portal fica vazio**;
  - o resto do código compara `deal_stage.id` com **IDs de etapa do RD** (`RD_STAGE_VENDA_EFETIVADA`, `RD_STAGE_PERDIDO`, `RD_STAGE_VENDIDO`...), e nenhuma comparação bate;
  - comissão e cashback exigem `amount_total > 0` e usam `deal.user.name`.
- **Fazer:**
  1. Nas queries de `allCardsInPipe` e `getCard`, pedir também `created_at`, `updated_at` e `assignees { id name email }` (os campos de data usam sublinhado; testado na conta).
  2. No `cardParaDealFake`:
     - **`created_at`:** o valor do campo **"Data de criação no RD"**, se houver (negociações migradas); senão, o `created_at` do card (negociações novas).
     - **`amount_total`:** o valor do campo **"Valor total"**, convertido em número. O formato do valor de campos de moeda devolvido pela API deve ser conferido; a conversão precisa aceitar tanto `"1234.56"` quanto `"R$ 1.234,56"`.
     - **`user`:** `{ name, email }` do primeiro `assignee`, ou `null`. Se o nome do membro no Pipefy for diferente do nome do usuário no RD, reaproveitar o mapa de apelidos (`getAliasMaps`).
     - **`deal_stage.id`:** o **ID da etapa do RD** correspondente à fase, por uma tabela explícita **por pipe**, em `pipefyConstants.js`, para o resto do código continuar comparando com as constantes do RD. Guardar também o nome da fase em `deal_stage.name` e a origem em `deal_stage.pipefy_phase`.
     - **`win`:** `true` nas fases finais de ganho, `false` nas finais de perda, `null` nas demais.
  3. **A tabela fase → etapa do RD precisa ser confirmada** com o RD, porque os nomes nas constantes podem estar desatualizados (por exemplo, o código trata a etapa `6a2bff35a294cf00226dd603` como "Perdido", mas o `app.js` a usa como "Prazo Vencido"). Hipótese inicial para o pipe BMAX, **a confirmar** (consultando `GET /deal_pipelines/{RD_PIPELINE_BMAX_INTERNO}` no RD, ou perguntando ao usuário):

     | Fase no Pipefy | Etapa no RD (hipótese) |
     |---|---|
     | Leads Revenda | `RD_STAGE_ASSUMIDO` (`6a2bff35a294cf00226dd602`) |
     | Prazo Vencido | `RD_STAGE_PERDIDO` (`6a2bff35a294cf00226dd603`) |
     | Venda Efetivada | `RD_STAGE_VENDIDO` (`6a5a200c4d3424002786a346`) |
     | Perdido | sem etapa equivalente no funil BMAX do RD; tratar como perda (`win: false`) e incluir no conjunto de etapas excluídas do `getLeads` |

     Se o portal passar a ler outros pipes (tarefa 11), cada um precisa da sua tabela.
- **Aceite:** testes do `cardParaDealFake` com cards simulados em cada fase do BMAX, conferindo `created_at`, `amount_total`, `user`, `deal_stage.id` e `win`; e um teste do `getLeads` com `CRM_PROVIDER=pipefy` e cards simulados, mostrando que as negociações aparecem e que as perdidas são excluídas.

### Tarefa 4 · Cache e economia de chamadas (bloqueante)

- **Onde:** `src/services/pipefyLeads.service.js` (`fetchAllDealsPipefy`) e `src/services/pipefy.service.js`.
- **Problema:** o caminho do Pipefy não tem cache, e o `getLeads` é chamado em pelo menos 10 lugares (painel, saldo, comissão, cashback, admin, resumo do WhatsApp). Cada chamada percorre o pipe inteiro, de 50 em 50 cards. Com qualquer uso real, o limite mensal da empresa se esgota.
- **Fazer:**
  1. Cache em memória para `fetchAllDealsPipefy`, com validade configurável por **`PIPEFY_CACHE_MIN`** (padrão **30** minutos), no mesmo padrão do `_leadsCache` do RD.
  2. **Invalidar** o cache sempre que o próprio BMAX gravar no Pipefy (`createLeadPipefy`, `updateLeadPipefy`, comentários).
  3. Evitar buscas simultâneas duplicadas: se uma busca já está em andamento, as outras chamadas aguardam a mesma promessa.
  4. **Contar as chamadas** ao Pipefy (`pipefyFetch`) e registrar o total por dia no log (`logger.info`), para acompanhar o consumo desde a primeira semana.
  5. Deixar registrado, num comentário, o próximo passo para depois da virada: um **índice local atualizado por webhooks do Pipefy**, que zera as leituras periódicas.
- **Aceite:** teste mostrando que duas chamadas seguidas a `fetchAllDealsPipefy` fazem **uma** busca, e que uma gravação invalida o cache.

### Tarefa 5 · Valores válidos ao criar e gravar (rápida)

- **Onde:** `src/services/pipefyLeads.service.js` (`createLeadPipefy`, `updateLeadPipefy`).
- **Problemas:**
  - `createLeadPipefy` envia `""` em campos de opções (Revenda/Loja e Representante, quando vazios), e o Pipefy pode recusar o card inteiro;
  - nomes de revenda e de representante podem vir com espaços nas pontas (o RD guarda alguns assim);
  - o PCI não é validado antes da gravação (`PIPEFY_PCI_OPCOES` existe, mas não é usado), e um valor inválido derruba a gravação em lote inteira.
- **Fazer:**
  1. Uma função que monta `fields_attributes` **sem os valores vazios** (`null`, `undefined`, `""` e listas vazias), usada no `createLeadPipefy` e no `updateLeadPipefy`.
  2. `trim()` nos valores de texto antes do envio.
  3. Validar o PCI contra `PIPEFY_PCI_OPCOES` antes de gravar; se inválido, lançar um erro claro, sem chamar o Pipefy.
- **Aceite:** testes com campos vazios (não enviados), com espaços (enviados sem espaços) e com um PCI inválido (erro sem chamada).

### Tarefa 6 · Valor e responsável no `updateLeadPipefy`

- **Onde:** `src/services/pipefyLeads.service.js` (`updateLeadPipefy`) e `src/services/pipefy.service.js`.
- **Problema:** `amount_total` e `owner_id` são ignorados. A troca de responsável no fluxo do PCI 12 depende disso.
- **Fazer:**
  1. **Valor:** gravar `amount_total` no campo **"Valor total"**, junto com os demais campos no mesmo lote.
  2. **Responsável:** uma função `updateCardAssignees(cardId, assigneeIds)`, com a mutation `updateCard(input: { id, assignee_ids })` **(conferir)**. O `owner_id` vem do RD (ID de usuário do RD); traduzir para o **membro do Pipefy** pelo e-mail (RD → e-mail pelo `rdToEmail` do `getAliasMaps`; e-mail → ID do membro pelos `membros` da configuração). Se o responsável não for membro do Pipefy, registrar um aviso e não falhar.
- **Aceite:** testes com o lote incluindo "Valor total", e com a tradução RD → e-mail → membro (com um caso de responsável que não é membro).

### Tarefa 7 · Tarefas e notas como comentários

- **Onde:** `src/services/rd.leads.service.js` (`createTask`, `updateTask`, `createNote`, `getLeadNotes`) e `src/services/pipefy.service.js`.
- **Problema:** com `pipefy`, `createTask` é descartada, e `createNote`, `updateTask` e `getLeadNotes` chamam o RD.
- **Fazer**, seguindo o padrão usado na migração:
  1. Uma função `createComment(cardId, texto)`, com a mutation `createComment(input: { card_id, text })` (testada na conta).
  2. **`createTask`:** criar um comentário no formato `[Tarefa · <tipo> · prazo <dd/mm/aaaa> · responsável <nome>]\n<assunto e notas>` e gravar os campos **"Próxima ação"** (assunto) e **"Data da próxima ação"** (prazo), num só pedido.
  3. **`createNote`:** criar um comentário com o texto.
  4. **`getLeadNotes`:** ler os comentários do card (`card(id) { comments { text created_at author { name } } }`, **(conferir)**) e devolvê-los no formato que o portal espera.
  5. **`updateTask`:** com `pipefy`, atualizar os campos "Próxima ação" e "Data da próxima ação".
- **Aceite:** testes de cada função com `CRM_PROVIDER=pipefy`, confirmando que **nenhuma** chamada vai ao RD.

### Tarefa 8 · IDs das negociações antigas e `getDealById`

- **Onde:** `src/services/rd.leads.service.js` (`getDealById`), `src/services/caminhoVenda.service.js` e `src/app.js` (os usos de `getDealById`), e um script e uma tabela novos.
- **Problema:** as tabelas do BMAX guardam IDs de negociação do RD (comissão por `lead_id`, acompanhamento do PCI 12...). Depois da virada, cada negociação migrada tem um ID de card novo no Pipefy. Com `pipefy`, o `getDealById` procuraria no RD um ID que pode ser de card, e vice-versa.
- **Fazer:**
  1. Uma tabela **`bmax_rd_pipefy_map`** (`rd_deal_id` texto, chave; `pipefy_card_id` texto, único; `criado_em`).
  2. Um script, `scripts/importar-mapa-rd-pipefy.js`, que importa um CSV com as colunas `rd_deal_id,pipefy_card_id`. **Esse CSV é gerado pela ferramenta da migração depois da carga real** (ela guarda a correspondência de cada negociação), então nenhuma chamada ao Pipefy é necessária.
  3. Uma função `resolverCardId(id)`: se o ID tem o formato de um ID do RD (24 caracteres hexadecimais), procura na tabela; se não achar, usa `findCardByRdId` **uma vez** e grava o resultado na tabela; se o ID já for de um card (numérico), devolve-o como está.
  4. **`getDealById`**, com `pipefy`: resolve o ID, busca o card (`getCard`) e devolve-o traduzido pelo `cardParaDealFake`.
  5. Revisar os usos de `getDealById` em `caminhoVenda.service.js` e `app.js` (incluindo a confirmação de "Prazo Vencido" na linha que compara com `RD_STAGE_PERDIDO`), para funcionarem com o card traduzido.
- **Aceite:** testes do `resolverCardId` (ID do RD presente na tabela, ausente e com consulta ao Pipefy, e ID de card) e do `getDealById` com `pipefy`.

### Tarefa 9 · Inventário das operações do RD e bloqueio das não migradas

- **Onde:** `src/services/rd.leads.service.js` e todos os arquivos que chamam o RD (incluindo `users.controller.js`, `admin.routes.js`, `cashback.routes.js`, `config.routes.js`, `export.routes.js`, `caminhoVenda.service.js`, `whatsappResumo.service.js`).
- **Problema:** só 4 operações foram migradas. As demais continuam no RD mesmo com `pipefy`, e gravariam num sistema que fica só para consulta na virada.
- **Fazer:**
  1. Criar um documento **`PIPEFY_PENDENCIAS.md`** na raiz do repositório com uma tabela de **todas** as funções que chamam o RD: nome, arquivo, se lê ou grava, quem usa, e a situação com `pipefy` (**migrada**, **bloqueada** ou **pendente de decisão**).
  2. **Toda função que grava no RD e não foi migrada** passa a lançar, com `pipefy`, um erro explícito (`"Operação X ainda não migrada para o Pipefy"`) e registrar no log. Isso inclui, pelo menos: `syncRevendasToRD`, `syncRepresentantesToRD`, `renomearRepresentanteNoRD`, `renomearRevendaNoRD`, `reatribuirRepresentanteDaRevendaNoRD`, `varrerEAtualizarDealsNoRD` e `createOrg`.
  3. **Sugestões de equivalentes** (implementar só depois de decididas, marcadas como (conferir)):
     - **listas de revendas e representantes:** atualizar as opções dos campos "Revenda/Loja" e "Representante" nos pipes (`updatePhaseField` com as opções);
     - **empresas** (`createOrg`, `getOrgByCNPJ`): registros do database **Empresas Comercial** (`findRecords` pelo CNPJ e `createTableRecord`), ligados ao card pelo campo "Empresa";
     - **contato principal** (`getContatoPrincipal`): o registro conectado ao campo "Contato" do card;
     - **Consulta de Lead do Motor** (`buscarLead`, `fetchAllDealsAllPipelines`): ler os pipes configurados, com o cache da tarefa 4.
- **Aceite:** o `PIPEFY_PENDENCIAS.md` lista todas as funções; um teste mostra que, com `pipefy`, as funções de gravação não migradas lançam erro **sem** chamar o RD.

### Tarefa 10 · Verificação de duplicidade por CNPJ

- **Onde:** `src/services/pipefyLeads.service.js` (`getLeadByCnpjPipefy`).
- **Problema:** percorre ao vivo o pipe BMAX inteiro a cada negociação nova (consumo alto) e só olha o BMAX (no RD, olha os 5 funis).
- **Fazer:** usar a lista em cache da tarefa 4, de **todos os pipes configurados** (tarefa 11), com o CNPJ normalizado dos dois lados. Antes de criar o card, invalidar o cache e buscar de novo **só se** o CNPJ não foi encontrado, para reduzir o risco de duplicar uma negociação criada nos últimos minutos.
- **Aceite:** testes com o CNPJ formatado de jeitos diferentes e com uma duplicata em outro pipe.

### Tarefa 11 · Quais pipes o portal lê (decisão pendente; deixar configurável)

- **Problema:** hoje o painel lê o funil **INDÚSTRIA - INTERNO** do RD; o caminho do Pipefy lê só o pipe **BMAX**. O conteúdo do portal mudaria na virada.
- **Fazer:** uma variável **`PIPEFY_PIPES_PORTAL`**, com a lista de pipes (pelo nome, como no mapa) que alimentam o `getLeads`, com o padrão `BMAX`, e cada pipe com a sua tabela fase → etapa do RD (tarefa 3). **Não escolher o conjunto definitivo:** isso será decidido com quem usa o portal. Registrar a decisão pendente no `PIPEFY_PENDENCIAS.md`.
- **Aceite:** teste com dois pipes configurados, juntando os cards dos dois.

### Tarefa 12 · Histórico de vendas (decisão pendente; não implementar ainda)

- **Problema:** as vendas efetivadas desde 01/05/2026, que o saldo, a comissão e o cashback leem ao vivo pelo `getLeads`, **não vão para o Pipefy**. Os créditos já lançados ficam em `bmax_transacoes`, mas tudo o que é recalculado a partir das vendas perderia esse histórico.
- **Fazer agora:** só registrar no `PIPEFY_PENDENCIAS.md` as duas saídas possíveis, para decisão: (a) incluir na migração para o Pipefy as vendas efetivadas desde 01/05/2026; (b) o BMAX guardar uma cópia local dessas vendas antes da virada, numa tabela própria, e o `getLeads` juntá-las aos cards do Pipefy. Indicar quais funções dependem do histórico (`recalcularComissoes`, o cálculo de saldo e os recálculos de cashback).

### Tarefa 13 · Testes e documentação

1. Garantir que `npm test` passa (no CI, `.github/workflows/test.yml`).
2. Atualizar o `guia_bmax_pipefy.md` local: a busca de contatos usa `tableId: String!`.
3. Atualizar o `DOCUMENTACAO_TECNICA.md` com a seção do Pipefy: as variáveis (`CRM_PROVIDER`, `PIPEFY_TOKEN`, `PIPEFY_MAPA_JSON`, `PIPEFY_CACHE_MIN`, `PIPEFY_PIPES_PORTAL`), o cache, a contagem de chamadas, a tabela `bmax_rd_pipefy_map` e o `PIPEFY_PENDENCIAS.md`.

---

## 4. O que não fazer

- **Não** mudar o padrão de `CRM_PROVIDER` (continua `rd`).
- **Não** chamar a API real do Pipefy ou do RD nos testes.
- **Não** versionar o `mapa_pipefy.json`, tokens ou e-mails de funcionários.
- **Não** decidir sozinho as tarefas 11 e 12: deixá-las configuráveis e registradas como pendentes.
- **Não** criar consultas periódicas ao Pipefy (por agendamento) sem o cache: cada consulta consome o limite mensal da empresa.

---

## 5. Antes da virada (fora do código; para o responsável pelo projeto)

- [ ] Confirmar a tabela fase → etapa do RD de cada pipe usado pelo portal (tarefa 3).
- [ ] Decidir os pipes do portal (tarefa 11) e o histórico de vendas (tarefa 12).
- [ ] Decidir cada operação "pendente de decisão" do `PIPEFY_PENDENCIAS.md`.
- [ ] Conferir, pela tela do Pipefy, que as passagens entre as fases do pipe BMAX que o BMAX usa estão liberadas.
- [ ] Conferir que os vendedores e responsáveis que o BMAX atribui são membros do Pipefy, com o mesmo e-mail do RD.
- [ ] Gerar o `PIPEFY_MAPA_JSON` a partir do mapa **mais recente** e configurá-lo na Vercel, junto com o `PIPEFY_TOKEN` da conta de serviço.
- [ ] Depois da carga real, importar a correspondência de IDs (tarefa 8).
- [ ] Na virada: `CRM_PROVIDER=pipefy` e, na primeira semana, acompanhar no log o total de chamadas por dia.
