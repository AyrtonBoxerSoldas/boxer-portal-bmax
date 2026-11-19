// Tarefa C1 (3º adendo, bmax_pipefy_correcoes_adendo3.md, 23/10/2026) —
// script de conferência, SÓ DE LEITURA (uma única chamada ao Pipefy, nenhuma
// gravação): lê um card real e imprime o formato bruto das datas/valores que
// o Pipefy devolve, pra confirmar paraDataIso/parseValorMonetario antes da
// virada.
//
//   node scripts/conferir-pipefy.js <id-do-card>
require("dotenv").config({ quiet: true });

const { getCard } = require("../src/services/pipefy.service");
const { cardParaDealFake, paraDataIso, parseValorMonetario } = require("../src/services/pipefyLeads.service");
const { nomeDoPipePorId } = require("../src/config/pipefyConstants");
const { RD_STAGES } = require("../src/config/constants");

function campoPorNome(card, nome) {
    return (card.fields || []).find(f => f.name === nome) || null;
}

(async () => {
    const cardId = process.argv[2];
    if (!cardId) {
        console.error("Uso: node scripts/conferir-pipefy.js <id-do-card>");
        process.exit(1);
    }

    try {
        const card = await getCard(cardId);
        if (!card) {
            console.error(`Card "${cardId}" não encontrado no Pipefy.`);
            process.exit(1);
        }

        const nomePipe = nomeDoPipePorId(card.pipe?.id) || "(desconhecido)";
        console.log("Pipe:", nomePipe, `(id ${card.pipe?.id})`);
        console.log("Fase:", card.current_phase?.name, `(id ${card.current_phase?.id})`);

        const campoData = campoPorNome(card, "Data de criação no RD");
        console.log("\n-- Data de criação no RD --");
        console.log("Valor bruto:", campoData ? campoData.value : "(campo não encontrado no card)");
        console.log("paraDataIso:", paraDataIso(campoData?.value));

        const campoValor = campoPorNome(card, "Valor total");
        console.log("\n-- Valor total --");
        console.log("Valor bruto:", campoValor ? campoValor.value : "(campo não encontrado no card)");
        console.log("parseValorMonetario:", parseValorMonetario(campoValor?.value));

        console.log("\n-- Responsáveis (assignees) --");
        console.log(card.assignees && card.assignees.length ? card.assignees : "(nenhum)");

        console.log("\n-- cardParaDealFake --");
        const deal = cardParaDealFake(card, nomePipe === "(desconhecido)" ? "BMAX" : nomePipe);
        console.log("Etapa RD:", deal.deal_stage.id, deal.deal_stage.id ? `(${RD_STAGES[deal.deal_stage.id] || "?"})` : "(sem equivalente)");
        console.log("win:", deal.win);
        console.log("created_at:", deal.created_at);

        process.exit(0);
    } catch (e) {
        console.error("ERRO:", e.message);
        process.exit(1);
    }
})();
