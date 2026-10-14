// Implementação Pipefy das 4 operações preparadas nesta primeira leva (ver
// guia_bmax_pipefy.md e o plano da migração): criar negociação, gravar
// etapa/campos, listar leads e checar duplicata por CNPJ. Só é usada quando
// CRM_PROVIDER=pipefy (ver rd.leads.service.js, que despacha pra cá) —
// desativada por padrão, RD continua sendo o provedor ativo.
//
// Tudo o mais (sync de picklist revenda/representante, Consulta de Lead do
// Motor, contato principal/notas do PCI12A, criação de tarefa) continua
// sempre no RD, mesmo com a flag ligada — são operações de varredura
// completa do funil ou sem equivalente direto no Pipefy, e exigem um
// redesenho à parte (webhook + índice local) antes de migrar de fato.
const { logger } = require("../logger");
const { RD_STAGES } = require("../config/constants");
const {
    PIPEFY_PIPE_BMAX,
    PIPEFY_FASES,
    PIPEFY_CAMPOS,
    PIPEFY_TABELA_CONTATOS,
    PIPEFY_CAMPO_CONTATO_NOME,
    PIPEFY_CAMPO_CONTATO_EMAIL,
    exigirConfig
} = require("../config/pipefyConstants");
const {
    allCardsInPipe,
    createCard,
    createContato,
    findContatoPorEmail,
    moveCardToPhase,
    updateCardFieldsEmLote
} = require("./pipefy.service");

function normalizeCnpj(raw) {
    return (raw || "").replace(/[.\-\/\s]/g, "");
}

// Mesma regra de "bloqueia duplicata" do RD (dealBloqueiaDuplicata em
// rd.leads.service.js): etapas finais (vendido/excluído/perdido) não contam
// como duplicata. O pipe BMAX só tem 4 fases (mapa_pipefy.json): "Leads
// Revenda", "Prazo Vencido", "Venda Efetivada", "Perdido".
const FASES_NAO_BLOQUEIAM = new Set(["Venda Efetivada", "Perdido"]);
function cardBloqueiaDuplicata(dealFake) {
    const faseNome = dealFake.deal_stage?.id;
    return !FASES_NAO_BLOQUEIAM.has(faseNome);
}

// getCustomField (rd.leads.service.js) procura um custom field pelo RÓTULO
// do RD (ex: "PERFIL PCI", "REVENDA/LOJA") — essa tabela traduz o rótulo do
// campo no Pipefy (como aparece em mapa_pipefy.json → pipes.BMAX.campos)
// pro rótulo RD equivalente, só pros campos que getCustomField/mapDealToCard
// de fato consultam hoje.
const ROTULO_RD_POR_CAMPO_PIPEFY = {
    "PCI": "PERFIL PCI",
    "CNPJ": "CNPJ",
    "Cidade": "CIDADE",
    "Estado": "ESTADO",
    "Representante": "REPRESENTANTE",
    "Revenda/Loja": "REVENDA/LOJA",
    "Máquina de interesse": "MÁQUINA DE INTERESSE",
    "Segmento de produto": "SEGMENTO DE PRODUTO",
    "Classe de preço": "CLASSE DE PREÇO",
    "Notas": "NOTAS",
    "Oportunidade de venda": "OPORTUNIDADE DE VENDA"
};

// Traduz um card do Pipefy pro mesmo formato de objeto "deal" que o resto do
// Portal já sabe ler (getCustomField, mapDealToCard, cálculo de cashback,
// auditoria, motivoForaDoEscopo) — assim nenhuma dessas funções precisa saber
// que existe Pipefy. `deal_stage.id` aqui guarda o NOME da fase do Pipefy
// (current_phase.name) em vez de um id numérico do RD — é só lido via
// RD_STAGES/comparação direta, nunca usado como id de escrita de volta.
function cardParaDealFake(card) {
    const valorPorCampoId = {};
    for (const f of card.fields || []) valorPorCampoId[f.field.id] = f.value;

    const dealCustomFields = Object.entries(PIPEFY_CAMPOS)
        .filter(([rotuloPipefy, campoId]) => ROTULO_RD_POR_CAMPO_PIPEFY[rotuloPipefy] && campoId in valorPorCampoId)
        .map(([rotuloPipefy, campoId]) => ({
            custom_field: { label: ROTULO_RD_POR_CAMPO_PIPEFY[rotuloPipefy] },
            value: valorPorCampoId[campoId]
        }));

    return {
        id: card.id,
        name: card.title,
        deal_custom_fields: dealCustomFields,
        deal_stage: { id: card.current_phase?.name || null },
        amount_total: 0,
        user: null,
        next_task: {},
        win: null,
        created_at: null
    };
}

async function fetchAllDealsPipefy() {
    const pipeId = exigirConfig(PIPEFY_PIPE_BMAX, "o ID do pipe BMAX (pipes.BMAX.id)");
    const cards = await allCardsInPipe(pipeId);
    return cards.map(cardParaDealFake);
}

async function getLeadByCnpjPipefy(cnpj) {
    const cnpjClean = normalizeCnpj(cnpj);
    if (!cnpjClean) return null;

    // Só varre o pipe BMAX (diferente do RD, que varre os 5 funis) — escopo
    // combinado desta primeira preparação. Documentado como limitação
    // conhecida: um CNPJ já existente só em outro pipe não é pego aqui.
    const deals = await fetchAllDealsPipefy();
    const encontrado = deals.find(d => cardBloqueiaDuplicata(d) && normalizeCnpj(
        (d.deal_custom_fields.find(f => f.custom_field.label === "CNPJ") || {}).value
    ) === cnpjClean);

    return encontrado || null;
}

async function createLeadPipefy(negociacao) {
    const pipeId = exigirConfig(PIPEFY_PIPE_BMAX, "o ID do pipe BMAX (pipes.BMAX.id)");
    const faseInicial = exigirConfig(PIPEFY_FASES["Leads Revenda"], "o ID da fase 'Leads Revenda' (pipes.BMAX.fases)");
    const campoTitulo = exigirConfig(PIPEFY_CAMPOS["Título"], "o ID do campo Título (pipes.BMAX.campos)");
    const campoPci = exigirConfig(PIPEFY_CAMPOS["PCI"], "o ID do campo PCI (pipes.BMAX.campos)");

    const camposCard = [
        { field_id: campoTitulo, field_value: negociacao.nome }
    ];

    // O formulário de Nova Negociação do Portal hoje só coleta dado de
    // empresa (CNPJ/nome/cidade/CEP), não um contato individual (nome/e-mail
    // de uma pessoa) — o guia (seção 5.4) pressupõe achar/criar um contato
    // por e-mail antes do card. Gap conhecido: sem e-mail no formulário, o
    // card é criado SEM contato vinculado. Resolver isso (adicionar e-mail
    // de contato no formulário, ou outra fonte) antes da virada real.
    if (negociacao.email) {
        const campoContato = exigirConfig(PIPEFY_CAMPOS["Contato"], "o ID do campo Contato (pipes.BMAX.campos)");
        let contato = await findContatoPorEmail(PIPEFY_TABELA_CONTATOS, PIPEFY_CAMPO_CONTATO_EMAIL, negociacao.email);
        if (!contato) {
            contato = await createContato(PIPEFY_TABELA_CONTATOS, negociacao.nome, [
                { field_id: PIPEFY_CAMPO_CONTATO_NOME, field_value: negociacao.nome },
                { field_id: PIPEFY_CAMPO_CONTATO_EMAIL, field_value: negociacao.email }
            ]);
        }
        camposCard.push({ field_id: campoContato, field_value: [contato.id] });
    } else {
        logger.warn({ message: "Negociação criada no Pipefy sem contato vinculado (sem e-mail no formulário)", nome: negociacao.nome });
    }

    if (PIPEFY_CAMPOS["CNPJ"]) camposCard.push({ field_id: PIPEFY_CAMPOS["CNPJ"], field_value: negociacao.cnpj || "" });
    if (PIPEFY_CAMPOS["Cidade"]) camposCard.push({ field_id: PIPEFY_CAMPOS["Cidade"], field_value: negociacao.cidade || "" });
    if (PIPEFY_CAMPOS["Revenda/Loja"]) camposCard.push({ field_id: PIPEFY_CAMPOS["Revenda/Loja"], field_value: negociacao.revenda || "" });
    if (PIPEFY_CAMPOS["Representante"]) camposCard.push({ field_id: PIPEFY_CAMPOS["Representante"], field_value: negociacao.representante || "" });
    if (PIPEFY_CAMPOS["Máquina de interesse"]) camposCard.push({ field_id: PIPEFY_CAMPOS["Máquina de interesse"], field_value: negociacao.maquinainteresse || "" });
    camposCard.push({ field_id: campoPci, field_value: "Sem PCI" });

    const card = await createCard(pipeId, faseInicial, negociacao.nome, camposCard);
    return { id: card.id };
}

// Mesmos slugs genéricos de RD_CF_SLUG_MAP (src/config/constants.js) que
// aplicarCaminhoVenda/controllers já usam em updateLead — traduzidos aqui
// pro rótulo do campo equivalente no Pipefy. "classe-de-preco" fica de fora
// (null), igual no RD: não é gravável por esse caminho em nenhum dos dois.
const CAMPO_PIPEFY_POR_SLUG = {
    "perfil-pci": "PCI",
    "cnpj": "CNPJ",
    "cidade": "Cidade",
    "estado": "Estado",
    "revenda-loja": "Revenda/Loja",
    "representante": "Representante",
    "maquina-de-interesse-1": "Máquina de interesse",
    "notas": "Notas",
    "seguimento-do-produto": "Segmento de produto",
    "classe-de-preco": null
};

async function updateLeadPipefy(cardId, body) {
    if (body?.data?.owner_id) {
        logger.warn({ message: "updateLeadPipefy: atribuição de responsável (owner_id) sem equivalente no guia do Pipefy — ignorado", cardId });
    }
    if (body?.data?.amount_total !== undefined) {
        logger.warn({ message: "updateLeadPipefy: gravação de valor (amount_total) sem equivalente validado no guia do Pipefy — ignorado", cardId });
    }

    if (body?.data?.stage_id) {
        // body.data.stage_id é um ID de ETAPA DO RD (ex: RD_STAGE_NEGOCIACAO),
        // que pode pertencer a um pipeline do RD diferente do pipe BMAX do
        // Pipefy. Caso confirmado (ver "Limitações conhecidas" no plano da
        // migração): aplicarCaminhoVenda usa a etapa "Negociação" (caminho
        // BOX+REV>IND), que no RD vive no pipeline Indústria-Interno, não no
        // funil BMAX — e a API do Pipefy NÃO tem mutation pra mover um card
        // pra outro pipe (confirmado na documentação oficial, 14/10/2026;
        // moveCardToPhase só aceita destination_phase_id, sem pipe). Isso é
        // um bloqueio de estrutura, não um bug de código — só avisa e grava
        // o PCI mesmo assim (que é o essencial); mover o card de fato pra
        // outro pipe depende de uma decisão de quem desenha a estrutura no
        // Pipefy (ex: automação "Pipe Connection" configurada na própria UI).
        const nomeFase = RD_STAGES[body.data.stage_id] || body.data.stage_id;
        // "Vendido" é o nome dessa etapa só no pipeline Indústria-Interno do
        // RD — no pipe BMAX do Pipefy a fase equivalente de venda ganha
        // chama-se "Venda Efetivada" (mesmo nome usado nos outros 3 pipes do
        // mapa_pipefy.json). Confirmado no teste simulado: sem esse alias, a
        // etapa "Vendido" nunca batia com nenhuma fase do pipe BMAX.
        const faseId = PIPEFY_FASES[nomeFase] || (nomeFase === "Vendido" ? PIPEFY_FASES["Venda Efetivada"] : null);
        if (faseId) {
            await moveCardToPhase(cardId, faseId);
        } else {
            logger.warn({ message: "updateLeadPipefy: etapa do RD sem fase correspondente no pipe BMAX do Pipefy — etapa não alterada", cardId, nomeFase });
        }
    }

    if (body?.data?.custom_fields) {
        const pares = Object.entries(body.data.custom_fields)
            .map(([slug, valor]) => ({ campoId: PIPEFY_CAMPOS[CAMPO_PIPEFY_POR_SLUG[slug]], valor }))
            .filter(p => p.campoId);
        if (pares.length) await updateCardFieldsEmLote(cardId, pares);
    }

    return { id: cardId };
}

module.exports = {
    fetchAllDealsPipefy,
    createLeadPipefy,
    updateLeadPipefy,
    getLeadByCnpjPipefy
};
