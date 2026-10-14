// Cliente de baixo nível pra API GraphQL do Pipefy — ver guia_bmax_pipefy.md
// (raiz do repo) seção 5. Cada função aqui espelha um exemplo do guia; as
// marcadas (conferir) não foram testadas na conta real da Boxer e devem ser
// validadas contra a referência (https://api-docs.pipefy.com) antes do uso
// em produção. Desativado por padrão — só é chamado quando CRM_PROVIDER=pipefy
// (ver rd.leads.service.js).
const { logger } = require("../logger");

const PIPEFY_URL = "https://api.pipefy.com/graphql";

async function pipefyFetch(query, variables = {}) {
    const token = process.env.PIPEFY_TOKEN;
    if (!token) throw new Error("PIPEFY_TOKEN não configurada");

    const res = await fetch(PIPEFY_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ query, variables })
    });

    if (res.status === 429) {
        throw new Error("Limite de chamadas do Pipefy atingido (429); tentar mais tarde");
    }

    const corpo = await res.json();

    if (!res.ok) {
        logger.error({ message: "Erro na resposta do Pipefy", status: res.status, body: corpo });
        throw new Error(`Erro Pipefy ${res.status}: ${JSON.stringify(corpo)}`);
    }

    if (corpo.errors?.length) {
        throw new Error(corpo.errors.map(e => e.message).join("; "));
    }

    return corpo.data;
}

// Guia 5.1 (conferir) — acha o card de uma negociação migrada pelo campo
// "ID no RD CRM". Uma busca por negociação; o BMAX deve guardar o id do card
// depois disso e não repetir a busca.
async function findCardByRdId(pipeId, campoId, rdDealId) {
    const QUERY = `
        query($pipeId: ID!, $campo: String!, $valor: String!) {
            findCards(pipeId: $pipeId, search: { fieldId: $campo, fieldValue: $valor }) {
                edges { node { id title current_phase { name } } }
            }
        }`;
    const dados = await pipefyFetch(QUERY, { pipeId, campo: campoId, valor: String(rdDealId) });
    return dados.findCards.edges[0]?.node || null;
}

// Guia 5.2 — lê o card inteiro (fase atual + todos os campos).
async function getCard(cardId) {
    const QUERY = `
        query($id: ID!) {
            card(id: $id) {
                id
                title
                current_phase { id name }
                fields { field { id } name value }
            }
        }`;
    const dados = await pipefyFetch(QUERY, { id: cardId });
    return dados.card;
}

// Guia 5.3 — grava um único campo (testado na conta).
async function updateCardField(cardId, campoId, valor) {
    const MUTATION = `
        mutation($card: ID!, $campo: ID!, $valor: [UndefinedInput]) {
            updateCardField(input: { card_id: $card, field_id: $campo, new_value: $valor }) { success }
        }`;
    return await pipefyFetch(MUTATION, { card: cardId, campo: campoId, valor });
}

// Move o card pra outra fase — mutation separada de updateCardField (ver
// guia seção 1, link "Mover card para outra fase").
async function moveCardToPhase(cardId, faseId) {
    const MUTATION = `
        mutation($card: ID!, $fase: ID!) {
            moveCardToPhase(input: { card_id: $card, destination_phase_id: $fase }) {
                card { id current_phase { id name } }
            }
        }`;
    return await pipefyFetch(MUTATION, { card: cardId, fase: faseId });
}

// Guia 5.7 (testado na conta) — várias gravações de campo num card só, numa
// única chamada (conta como 1 pro limite mensal), via aliases na mutation.
async function updateCardFieldsEmLote(cardId, pares) {
    if (!pares.length) return { success: true };
    const mutations = pares.map(({ campoId, valor }, i) =>
        `m${i}: updateCardField(input: { card_id: "${cardId}", field_id: "${campoId}", new_value: ${JSON.stringify(valor)} }) { success }`
    );
    const MUTATION = `mutation { ${mutations.join("\n")} }`;
    return await pipefyFetch(MUTATION);
}

// Guia 5.4 (testado na conta) — cria um registro no database de Contatos Comercial.
async function createContato(tabelaId, titulo, campos) {
    const MUTATION = `
        mutation($tabela: ID!, $titulo: String!, $campos: [FieldValueInput]) {
            createTableRecord(input: { table_id: $tabela, title: $titulo, fields_attributes: $campos }) {
                table_record { id }
            }
        }`;
    const dados = await pipefyFetch(MUTATION, { tabela: tabelaId, titulo, campos });
    return dados.createTableRecord.table_record;
}

// Guia 5.4 (testado na conta) — cria o card já na fase desejada, ligado ao contato.
async function createCard(pipeId, faseId, titulo, campos) {
    const MUTATION = `
        mutation($pipe: ID!, $fase: ID!, $titulo: String!, $campos: [FieldValueInput]) {
            createCard(input: { pipe_id: $pipe, phase_id: $fase, title: $titulo, fields_attributes: $campos }) {
                card { id }
            }
        }`;
    const dados = await pipefyFetch(MUTATION, { pipe: pipeId, fase: faseId, titulo, campos });
    return dados.createCard.card;
}

// Guia 5.5 (conferir) — procura um contato pelo e-mail, pra não duplicar
// antes de criar um novo (guia seção 5.4: "Antes de criar o contato, procure-o
// pelo e-mail").
async function findContatoPorEmail(tabelaId, campoId, email) {
    const QUERY = `
        query($tabela: ID!, $campo: String!, $valor: String!) {
            findRecords(tableId: $tabela, search: { fieldId: $campo, fieldValue: $valor }) {
                edges { node { id title } }
            }
        }`;
    const dados = await pipefyFetch(QUERY, { tabela: tabelaId, campo: campoId, valor: email });
    return dados.findRecords.edges[0]?.node || null;
}

// (conferir) — não está no guia. Pagina todos os cards de um pipe (query
// padrão da API do Pipefy, https://api-docs.pipefy.com) — é a base do
// dashboard de leads (equivalente a fetchAllDealsFromRD). Validar contra a
// conta real antes de confiar no formato de retorno.
async function allCardsInPipe(pipeId) {
    const QUERY = `
        query($pipeId: ID!, $cursor: String) {
            allCards(pipeId: $pipeId, first: 50, after: $cursor) {
                edges {
                    node {
                        id
                        title
                        current_phase { id name }
                        fields { field { id } name value }
                    }
                }
                pageInfo { hasNextPage endCursor }
            }
        }`;

    let cards = [];
    let cursor = null;
    let hasNext = true;
    let paginas = 0;
    const MAX_PAGINAS = 200; // mesmo teto de segurança usado pro RD (RD_MAX_PAGES)

    while (hasNext && paginas < MAX_PAGINAS) {
        const dados = await pipefyFetch(QUERY, { pipeId, cursor });
        const pagina = dados.allCards;
        cards = cards.concat(pagina.edges.map(e => e.node));
        hasNext = pagina.pageInfo.hasNextPage;
        cursor = pagina.pageInfo.endCursor;
        paginas++;
    }
    if (paginas >= MAX_PAGINAS) {
        logger.error({ message: "allCardsInPipe atingiu o teto de páginas — dados podem estar incompletos", pipeId, maxPaginas: MAX_PAGINAS });
    }
    return cards;
}

module.exports = {
    pipefyFetch,
    findCardByRdId,
    getCard,
    updateCardField,
    moveCardToPhase,
    updateCardFieldsEmLote,
    createContato,
    createCard,
    findContatoPorEmail,
    allCardsInPipe
};
