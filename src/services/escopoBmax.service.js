// Escopo do Portal BMax — quais leads PODEM aparecer (e, por consequência, gerar
// cashback). Regra do André (08/10/2026): "só calculamos cashback de cards/leads
// que são visíveis no portal". Por isso o filtro vive em getLeads(), a fonte única
// de cards, export, recálculo de comissão e crédito retroativo.
//
// Fica FORA do Portal:
//  1) Consumíveis — "Máquina de interesse" com o texto "consum".
//  2) Produto que NÃO é da linha BMax — o texto cita um produto conhecido de fora
//     da Tabela de Preços BMax (boxer-sistemas, tabela id=2 "Automação") e não cita
//     nenhuma família BMax.
// Na dúvida o lead FICA: texto vazio, genérico ou abreviação desconhecida nunca
// esconde nada (esconder também derruba o cashback, então o erro caro é esconder
// errado, não mostrar a mais).
//
// Reforço pelo campo "Segmento de produto" (RD: Laser / Máquinas / Robô — não existe
// valor "consumível"): Laser ou Robô são sempre BMax, então protegem o lead de ser
// escondido pela regra 2. "Máquinas" NÃO protege, porque o Portal preenche esse valor
// sozinho ao definir caminho PCI12 (caminhoVenda.service.js), mesmo p/ não-BMax.
//
// O time escreve texto livre e abreviado ("hard450", "160 mig flex", "LQ 1250"). A
// comparação é feita no texto COMPACTADO (sem acento, espaço, hífen ou pontuação) e
// com apelidos de abreviação para as famílias da tabela.
//
// Famílias BMax = modelos da Tabela de Preços BMax (consulta de 08/10/2026):
// DURAMAX, HARDMIG, TIGON, ALUTIG, Q25, HARDCUT, ALUMIG/M500 (mig duplo pulsado),
// RM/B500 (robôs e fontes), LQ (laser) + acessórios dessas linhas.
// Para incluir/excluir um produto, edite APENAS as listas abaixo.

// Padrões sobre o texto compactado (ex.: "hard 450" -> "hard450").
const FAMILIAS_BMAX = [
    "duramax", "dura\\d",                 // Duramax 326 / dura326
    "hardmig", "hardcut", "hard\\d",      // hard450 = Hardmig 450 (Hardcut sempre vem escrito)
    "tigon", "alutig", "alumig", "alu\\d", "m500", "q25",
    "b500", "rm\\d", "lq\\d", "laser",
    "robo", "robot", "cabecote", "posicionador", "troly", "chiller", "rtb"
];

// Produtos que o time cadastra no RD mas NÃO estão na Tabela de Preços BMax.
const FORA_DA_TABELA_BMAX = [
    "migflex", "optiarc", "flama", "spectra", "mascara", "regulador",
    "tochamig", "bancodecarga"
];

const SEGMENTOS_SEMPRE_BMAX = ["laser", "robo"];

function compactar(txt) {
    return String(txt || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const reBmax = new RegExp(FAMILIAS_BMAX.join("|"));
const reFora = new RegExp(FORA_DA_TABELA_BMAX.join("|"));

// Retorna null (dentro do escopo) ou o motivo pelo qual o lead fica fora.
function motivoForaDoEscopo(maquinaInteresse, segmentoProduto) {
    const t = compactar(maquinaInteresse);
    if (!t) return null;
    if (t.includes("consum")) return "consumivel";
    if (reFora.test(t) && !reBmax.test(t) && !SEGMENTOS_SEMPRE_BMAX.includes(compactar(segmentoProduto))) {
        return "produto_fora_da_tabela_bmax";
    }
    return null;
}

module.exports = { motivoForaDoEscopo, compactar, FAMILIAS_BMAX, FORA_DA_TABELA_BMAX };
