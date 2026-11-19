# BMAX ↔ Pipefy: terceiro adendo às correções

Complementa o `bmax_pipefy_correcoes.md`, o `bmax_pipefy_correcoes_adendo.md` e o `bmax_pipefy_correcoes_adendo2.md`. Vem da **revisão das correções do segundo adendo**: todos os itens (A1 a A6, B1, B2, B4, C1 e C2) foram implementados, cada um com o seu teste, e os 109 testes passam. Este adendo trata do que a revisão ainda encontrou.

**Onde este adendo e os documentos anteriores divergirem, vale este adendo.** As regras continuam as mesmas, inclusive: **cada correção vem com um teste novo que reproduz o problema**.

---

## 1. Corrigir antes da virada

### A1 · Gravar o cache no banco em lotes

- **Problema:** o `salvarCardsNoBanco` faz **uma consulta ao banco por card**, uma depois da outra. Numa leitura completa do INDÚSTRIA - INTERNO (cerca de 850 cards), são cerca de 850 consultas seguidas, **dentro da própria requisição do painel**. Entre a Vercel e o banco, cada consulta leva algumas dezenas de milissegundos; somadas, podem passar do **tempo-limite da função na Vercel**, e o painel falharia justamente na leitura completa (a inicial e a diária).
- **Onde:** `src/services/pipefyLeads.service.js` (`salvarCardsNoBanco`).
- **Fazer:** gravar em lotes de **100 cards por consulta**, com um único `INSERT ... VALUES (...), (...), ... ON CONFLICT (pipe, card_id) DO UPDATE SET card = EXCLUDED.card, atualizado_em = now()`. Montar os parâmetros com nomes numerados (`:pipe`, `:id0`, `:card0`, `:id1`, `:card1`...) ou com o recurso de lista do Sequelize, **nunca** concatenando o conteúdo dos cards no texto da consulta. Uma falha num lote registra o aviso e segue para o próximo, como hoje.
- **Aceite:** teste com 250 cards: **3 consultas** ao banco (100, 100 e 50), com todos os cards nos parâmetros.

### A2 · Três ajustes no cache

1. **A leitura completa de reserva deve substituir a lista, e não somar a ela.** Quando a leitura incremental falha e o código cai para a leitura completa (`completo = true`, em `atualizarPipeNoCache`), os cards novos são **somados** ao mapa que já existe. Os cards apagados ou movidos para outro pipe continuam no cache até a próxima leitura diária. **Fazer:** nesse caso, substituir o mapa (`entrada.cards = new Map(cards.map(c => [c.id, c]))`), como na leitura completa normal, e passar ao `removerCardsApagadosDoBanco` os IDs dos cards que vieram.
2. **Um card apagado também sai do banco.** No `atualizarCardNoCache`, quando o `getCard` devolve vazio, o card sai do mapa em memória, mas **continua no banco**, e volta na próxima instância nova. **Fazer:** apagar também a linha de `bmax_pipefy_cache_cards` daquele card.
3. **Não mexer no `maiorUpdatedAt` nas gravações do próprio BMAX** (manter como está). Na revisão anterior, isso foi citado como um detalhe a ajustar, mas **o comportamento atual é o correto**: se o `maiorUpdatedAt` passasse para o `updated_at` do card que o BMAX acabou de gravar, as alterações **feitas por outras pessoas** no intervalo entre o valor anterior e esse seriam **puladas** pela leitura incremental seguinte. O único efeito do comportamento atual é o card gravado voltar uma vez na leitura seguinte, sem prejuízo. **Fazer:** só deixar um comentário no `atualizarCardNoCache` explicando isso, para ninguém "corrigir" depois.
- **Aceite:** (a) teste em que a leitura incremental falha e a completa de reserva traz menos cards que o cache tinha: os que não vieram saem do mapa e do banco; (b) teste do `atualizarCardNoCache` com um card apagado: a linha do banco é apagada.

---

## 2. Depende de decisão: o caminho de venda "BOX+REV>IND"

- **Situação:** esse caminho (`aplicarCaminhoVenda`, em `caminhoVenda.service.js`) **muda a negociação de funil** no RD: do funil BMAX para a etapa "Negociação" do INDÚSTRIA - INTERNO. O RD permite isso; **o Pipefy não move cards entre pipes**. Hoje, com `CRM_PROVIDER=pipefy`, o `updateLeadPipefy` lança um erro claro nesse caso, sem gravar nada, o que é o certo enquanto não há uma decisão.
- **Decisão pendente** (de quem mantém o BMAX, com o Comercial): com que frequência esse caminho é usado, e se a solução abaixo é a escolhida. **Não implementar antes dessa decisão.**

### B1 · Solução proposta: card novo no INDÚSTRIA - INTERNO e o card do BMAX como "transferido"

Se a decisão for por esta solução:

1. **Estrutura no Pipefy (feita pela tela, fora do código):** uma fase final nova no pipe BMAX, **"Transferido para a Indústria"**, com as passagens liberadas a partir das outras fases. Depois, gerar o mapa e o `PIPEFY_MAPA_JSON` de novo.
2. **Tabela nova,** criada por um script no estilo dos outros (idempotente): `bmax_pipefy_transferencias` (`card_origem` texto, chave primária; `card_destino` texto; `criado_em`).
3. **No `updateLeadPipefy`,** quando a etapa pedida não existe no pipe do card, **mas** existe em outro pipe (hoje, só este caso: a etapa "Negociação" do INDÚSTRIA - INTERNO, a partir de um card do BMAX):
   1. ler o card de origem (`getCard`);
   2. criar o card no INDÚSTRIA - INTERNO, **direto na fase de destino** (a "NEGOCIAÇÃO"), com o título, o contato (a mesma conexão), os campos personalizados que existirem nos dois pipes, e **sempre o PCI** (obrigatório no INDÚSTRIA - INTERNO; "Sem PCI" se o card de origem não tiver);
   3. comentar nos dois cards a ligação ("Transferido do card X do BMAX" e "Transferido para o card Y do INDÚSTRIA - INTERNO");
   4. mover o card do BMAX para "Transferido para a Indústria";
   5. gravar a ligação em `bmax_pipefy_transferencias`;
   6. aplicar ao card novo o resto do `body` (os campos e o responsável).
4. **No `resolverCardId`:** depois de chegar a um ID de card, conferir se ele está em `bmax_pipefy_transferencias` como `card_origem` e, se estiver, devolver o `card_destino` (seguindo a cadeia, se houver mais de uma transferência). Assim, as tabelas do BMAX que guardam o ID antigo (do RD ou do card do BMAX) **continuam funcionando sem migração**.
5. **Na tabela fase → etapa** (`PIPEFY_FASE_PARA_ETAPA_RD`), a fase "Transferido para a Indústria" do BMAX fica fora do painel e da checagem de duplicidade: mapear para uma etapa já excluída do painel e com `win: null`, e documentar a escolha no comentário da tabela.
- **Aceite:** teste com um card simulado do BMAX recebendo a etapa "Negociação": cria o card no INDÚSTRIA - INTERNO na fase certa (com o PCI), move o de origem para "Transferido para a Indústria" e grava a ligação; e um teste do `resolverCardId` seguindo a ligação.

---

## 3. Testar na conta, antes da virada

Estes três pontos nunca foram testados na conta real do Pipefy. São rápidos, e cada um evita uma surpresa no dia da virada.

### C1 · Um script de conferência, só de leitura

- **Fazer:** `scripts/conferir-pipefy.js <id-do-card>`, que lê um card (uma chamada) e imprime, **sem gravar nada**:
  - o pipe e a fase;
  - o valor **bruto** do campo "Data de criação no RD" e o resultado do `paraDataIso` para ele;
  - o valor **bruto** do campo "Valor total" e o resultado do `parseValorMonetario`;
  - os responsáveis (`assignees`);
  - o resultado do `cardParaDealFake` (a etapa do RD, o `win` e o `created_at`).
- **Para quê:** confirmar, com um card migrado de verdade, **o formato das datas e dos valores** que o Pipefy devolve.

### C2 · Testes manuais, num card ou pipe de teste

Registrar no `PIPEFY_PENDENCIAS.md`, com o resultado de cada um quando forem feitos:

- [ ] **Troca do responsável** (`updateCardAssignees`, que nunca foi testada): num card de teste do pipe BMAX, atribuir um membro pela função e conferir pela tela; depois, desfazer.
- [ ] **Troca das opções de um campo** (`updatePhaseField` com `options`, o item B3 do segundo adendo): num pipe de teste, acrescentar uma opção a um campo de seleção e conferir pela tela que **as opções antigas continuam lá** e que o campo **não mudou de obrigatório para opcional** (ou o contrário). Até esse teste, as renomeações não devem ser usadas em produção.
- [ ] **Paginação do `findCards`:** conferir no log, na primeira busca de um ID do RD, se apareceu o aviso de que o Pipefy não aceita a paginação. Se aparecer, a alternativa já implementada está em uso, e as buscas trazem só uma página (até 50 cards), o que basta para a busca por ID, mas **limita as renomeações** a 50 cards por valor.

---

## 4. Checklist antes da virada (acréscimos)

- [ ] A1 e A2 implementados, com os testes novos passando.
- [ ] A decisão sobre o caminho "BOX+REV>IND" tomada e, se for o caso, o B1 implementado.
- [ ] As tabelas do cache criadas no banco de produção (`scripts/create-pipefy-cache-tables.js`), junto com a `bmax_rd_pipefy_map`.
- [ ] O `conferir-pipefy.js` rodado com pelo menos um card migrado de cada pipe do painel, e os formatos conferidos.
- [ ] Os três testes manuais de C2 feitos e registrados.
