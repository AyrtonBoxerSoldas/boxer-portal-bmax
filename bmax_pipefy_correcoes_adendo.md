# BMAX ↔ Pipefy: adendo às correções

Complementa o `bmax_pipefy_correcoes.md`. Vem do levantamento de como o BMAX usa hoje os funis do RD e de decisões tomadas depois daquele documento. **Onde este adendo e o documento original divergirem, vale este adendo.**

---

## 1. O que mudou desde o documento original

- **O escopo da migração para o Pipefy aumentou:** além das negociações abertas e pausadas, vão para o Pipefy as **ganhas e perdidas criadas a partir de 01/05/2026**, nas fases finais de cada pipe, com a data de fechamento (campo "Data de fechamento no RD") e o motivo de perda (campo "Motivo de perda", na fase final de perda). As negociações abertas paradas em etapas de fechamento também vão, como estão.
- **Por isso, a tarefa 12 (histórico de vendas) está resolvida:** as vendas desde maio, que o saldo, as comissões e o cashback usam, vão estar no Pipefy. Não há cópia local a fazer.
- **Testado na conta (teste do filtro por data de atualização):**
  - a listagem de cards aceita o filtro `filter: {field: "updated_at", operator: gt, value: "<data e hora ISO 8601 com fuso>"}` e devolveu **só o card alterado** depois da hora pedida;
  - os campos de data do card se chamam **`updated_at`** e **`created_at`** (com sublinhado). **O documento original, na tarefa 3, diz `createdAt`: está errado**; use `created_at`;
  - **um comentário também muda o `updated_at`** do card (além das alterações de campos);
  - segundo o Pipefy, **o `allCards` não filtra por campos personalizados**: o único filtro é o de data de atualização. Para achar cards pelo valor de um campo, use o `findCards`.
- **O PCI é obrigatório no formulário inicial do pipe INDÚSTRIA - INTERNO** (testado na conta: o Pipefy recusa pela API um card sem PCI nesse pipe, com "O campo PCI é obrigatório"). Nos outros pipes, o PCI continua opcional.

## 2. Como o BMAX usa os funis do RD hoje (levantamento)

| Funil no RD | ID | Uso |
|---|---|---|
| INDÚSTRIA - INTERNO | `66151c1470449b000d54e914` (`RD_PIPELINE_INDUSTRIA`) | **Único funil lido pelo painel** (`fetchAllDealsFromRD` → `getLeads`) |
| BMAX | `6a2bff35a294cf00226dd600` (`RD_PIPELINE_BMAX_INTERNO`) | Destino do `createLead` quando a negociação é de revenda (ou de representante ou admin que não escolheu "indústria"); varrido em `renomearRepresentanteNoRD`, `renomearRevendaNoRD` e `reatribuirRepresentanteDaRevendaNoRD` |
| REVENDA - INTERNO | `68b19e2883a5f700170072d3` (`RD_PIPELINE_REVENDAS`) | Varrido só em `renomearRevendaNoRD` e `reatribuirRepresentanteDaRevendaNoRD` |

No Pipefy, cada funil é um pipe com o mesmo nome.

---

## 3. Alterações nas tarefas

### Tarefa 11 · Pipes do portal: decidido

- **`PIPEFY_PIPES_PORTAL` passa a ter o padrão `INDÚSTRIA - INTERNO`** (e não `BMAX`), para o portal mostrar o mesmo conjunto de hoje.
- O filtro de data do `getLeads` (negociações criadas a partir de 01/05/2026) continua valendo, agora sobre o `created_at` traduzido pela tarefa 3 (o campo "Data de criação no RD", nas negociações migradas). O pipe no Pipefy tem também negociações abertas criadas antes de maio, que o filtro continua tirando do painel, como hoje.
- Atualizar o `PIPEFY_PENDENCIAS.md`: a decisão deixa de ser pendente.

### Tarefa 3 · Tradução fase → etapa do RD: priorizar o INDÚSTRIA - INTERNO

A tabela fase → etapa do RD precisa existir **primeiro para o INDÚSTRIA - INTERNO**, que é o pipe do painel. As fases têm os mesmos nomes das etapas do RD: `LEAD`, `EM CONTATO`, `NEGOCIAÇÃO`, `DEMONSTRAÇÃO`, `VENDA EFETIVADA` (final, ganho), `PERDIDOS | SEM PERFIL` (final, perda) e `ENTREGA TECNICA`. Usar as constantes de etapa do INDÚSTRIA que já existem em `src/config/constants.js` e confirmar cada correspondência com o usuário. Regras do `win`:

- `VENDA EFETIVADA` e `ENTREGA TECNICA` → `win: true` (a entrega técnica vem depois da venda);
- `PERDIDOS | SEM PERFIL` → `win: false`;
- as demais → `win: null`.

A tabela do pipe BMAX continua necessária para o `getDealById` e para a criação de negociações, mas deixa de ser a do painel.

**Campos de data do card (testado na conta):** nas queries de `allCards` e `getCard`, pedir **`created_at`** e **`updated_at`** (e não `createdAt`, como dizia o documento original). O `created_at` do card é a data de criação no Pipefy: para as negociações migradas, a data de criação certa continua sendo o campo "Data de criação no RD"; o `created_at` vale para as negociações criadas depois da virada.

### Tarefa 4 · Cache: trocar a leitura completa pela leitura incremental (bloqueante)

**O problema ficou maior com o novo escopo.** O pipe INDÚSTRIA - INTERNO vai ter **cerca de 850 cards** (as abertas, as paradas em etapas de fechamento e as 519 ganhas e perdidas desde maio). Uma leitura completa gasta **cerca de 17 chamadas** (50 cards por chamada). Com o cache de 30 minutos do documento original, seriam 48 leituras por dia, ou **cerca de 24 mil chamadas por mês**, mais que o dobro do limite de 10 mil da **empresa inteira**. Mesmo com uma hora de cache, seriam cerca de 12 mil.

**Fazer:**

1. **Uma leitura completa só quando o cache está vazio** (ao iniciar o BMAX, ou depois de um erro).
2. **Depois, leitura incremental (testada na conta):** a cada atualização (a cada `PIPEFY_CACHE_MIN` minutos), buscar **só os cards alterados** com
   ```graphql
   allCards(pipeId: $p, first: 50, after: $cursor,
            filter: { field: "updated_at", operator: gt, value: "<referência>" }) {
     edges { node { id title created_at updated_at ... } }
     pageInfo { hasNextPage endCursor }
   }
   ```
   e juntá-los ao cache, substituindo os cards com o mesmo ID. Detalhes que importam:
   - **A referência é o maior `updated_at` que já está no cache**, e não a hora do computador onde o BMAX roda. Assim, uma diferença de relógio entre o servidor do BMAX e o do Pipefy não faz perder alterações. A data vai no formato ISO 8601 com fuso, como o Pipefy devolve (por exemplo, `2026-10-20T10:54:17+00:00`).
   - Usar `gt` (maior que) com essa referência. Se houver o risco de duas alterações no mesmo segundo, use `gte` e ignore os cards que já estão no cache com o mesmo `updated_at`.
   - **Paginar** com `pageInfo` quando vierem mais de 50 alterações (por exemplo, depois de uma alteração em massa).
   - Comentários também mudam o `updated_at` (testado), então um card comentado volta na leitura incremental. Isso é esperado e inofensivo.
3. **Cards apagados ou movidos para outro pipe** não aparecem na leitura incremental. Fazer uma leitura completa por dia (por exemplo, de madrugada) para corrigir o cache.
4. **Invalidar só o card alterado** quando o próprio BMAX gravar algo (criação, mudança de PCI, de fase etc.), em vez de esvaziar o cache inteiro, para não forçar uma leitura completa a cada gravação.
5. Manter a contagem de chamadas por dia no log (item 4 do documento original) e **registrar à parte** as leituras completas e as incrementais.
6. **Meta:** com atualização a cada 30 minutos, cerca de 1 chamada por atualização (quando há menos de 50 cards alterados), mais a leitura completa diária: na casa de **2 mil chamadas por mês**.
7. O filtro foi testado e funciona; o índice local por webhooks fica só como melhoria futura, se o consumo medido na primeira semana justificar.

**Aceite:** testes com a listagem simulada, mostrando que (a) a primeira atualização faz a leitura completa; (b) as seguintes pedem só os alterados e os juntam ao cache; (c) uma gravação do BMAX atualiza só o card alterado; (d) a leitura completa diária substitui o cache.

### Tarefa 5 e 6 · Criação de negociações em dois pipes

Hoje, com o Pipefy, o `createLeadPipefy` só cria no pipe BMAX. Ele precisa seguir a mesma regra do `createLead` do RD:

1. **Escolher o pipe:** INDÚSTRIA - INTERNO quando o usuário escolhe "indústria"; BMAX nos demais casos (revenda, ou representante ou admin que não escolheu "indústria").
2. **Escolher a fase inicial** de cada pipe pela mesma lógica da etapa inicial do RD (traduzida pela tabela da tarefa 3), e criar o card direto nela (`createCard` com `phase_id`).
3. **No INDÚSTRIA - INTERNO, enviar sempre o PCI.** Sem ele, o Pipefy recusa o card. Se o usuário não informou o PCI, enviar `"Sem PCI"` (é uma das 21 opções e cumpre a regra). Validar contra `PIPEFY_PCI_OPCOES` (tarefa 5).
4. Os IDs dos campos de cada pipe vêm da configuração (`PIPEFY_MAPA_JSON`), por pipe: os IDs do mesmo rótulo podem ser diferentes entre pipes.
5. **A verificação de duplicidade por CNPJ (tarefa 10)** passa a olhar o INDÚSTRIA - INTERNO e o BMAX (os dois destinos possíveis), no cache.

**Aceite:** testes criando negociação com "indústria" (card no INDÚSTRIA - INTERNO, com o PCI, inclusive o padrão "Sem PCI") e sem "indústria" (card no BMAX).

### Tarefa 9 · Varreduras de renomear e reatribuir: especificar o equivalente no Pipefy

As três varreduras (`renomearRepresentanteNoRD`, `renomearRevendaNoRD` e `reatribuirRepresentanteDaRevendaNoRD`) continuam **bloqueadas** com `CRM_PROVIDER=pipefy` até serem reimplementadas assim:

1. **Pipes varridos:** BMAX nas três, e REVENDA - INTERNO nas duas de revenda (como hoje no RD).
2. **Encontrar os cards** com o valor antigo no campo "Representante" ou "Revenda/Loja" com `findCards` pelo campo **(conferir)**, em vez de percorrer o pipe inteiro.
3. **Atualizar os cards** com o valor novo, várias alterações numa só chamada (`updateCardField` com apelidos), e respeitando as opções do campo: o valor novo precisa existir entre as opções.
4. **Renomear ou acrescentar a opção** no campo de seleção de cada pipe com `updatePhaseField`, que **exige o `id` e o `uuid` do campo, mais o rótulo** (sem o `uuid`, o Pipefy responde "Acesso negado"; testado na conta). O `uuid` vem da consulta `pipe(id) { start_form_fields { id uuid label } }`.
5. **Ordem:** primeiro acrescentar a opção nova no campo, depois atualizar os cards, e só então tirar a opção antiga, se for o caso.

**Aceite:** testes com cards simulados nos dois pipes, mostrando a busca, a atualização em lote e a ordem das operações.

---

## 4. Checklist antes da virada (acréscimos)

- [ ] Confirmar a tabela fase → etapa do RD do INDÚSTRIA - INTERNO (tarefa 3).
- [x] Confirmar na conta o filtro por data de atualização da listagem de cards (tarefa 4): **confirmado**.
- [ ] Medir o consumo de chamadas do BMAX num dia de uso, depois da virada.
- [ ] Testar a criação de uma negociação "indústria" no pipe INDÚSTRIA - INTERNO, com e sem PCI informado.
