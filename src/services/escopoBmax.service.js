// Escopo do Portal BMax — quais leads PODEM aparecer (e, por consequência, gerar
// cashback). Regra do André (08/10/2026): "só calculamos cashback de cards/leads
// que são visíveis no portal". Por isso o filtro vive em getLeads(), a fonte única
// de cards, export, recálculo de comissão e crédito retroativo.
//
// Fica FORA do Portal:
//  1) Consumíveis — qualquer "Máquina de interesse" com o texto "consum".
//  2) Produto que NÃO é da linha BMax — texto cita um produto conhecido de fora
//     da Tabela de Preços BMax (boxer-sistemas, tabela id=2 "Automação") e não cita
//     nenhuma família BMax. Texto vazio/genérico NUNCA é escondido (não dá pra julgar).
//
// Famílias BMax = modelos da Tabela de Preços BMax (consulta de 08/10/2026):
// DURAMAX, HARDMIG, TIGON, ALUTIG, Q25, HARDCUT, ALUMIG/M500 (mig duplo pulsado),
// RM/B500 (robôs e fontes), LQ (laser) + acessórios dessas linhas.
// Para incluir/excluir um produto, edite APENAS as duas listas abaixo.

const FAMILIAS_BMAX = [
    "duramax", "hardmig", "tigon", "alutig", "q25", "hardcut", "alumig", "m500",
    "b5 ?00", "\\brm ?\\d", "\\blq ?\\d", "laser", "rob[oô]", "robot",
    "cabecote", "posicionador", "troly", "chiller", "rtb"
];

// Produtos que o time cadastra no RD mas NÃO estão na Tabela de Preços BMax.
const FORA_DA_TABELA_BMAX = [
    "migflex", "optiarc", "flama", "spectra", "mascara", "regulador",
    "tocha mig", "banco de carga"
];

function normalizar(txt) {
    return String(txt || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const reBmax = new RegExp(FAMILIAS_BMAX.map(normalizar).join("|"));
const reFora = new RegExp(FORA_DA_TABELA_BMAX.map(normalizar).join("|"));

// Retorna null (dentro do escopo) ou o motivo pelo qual o lead fica fora.
function motivoForaDoEscopo(maquinaInteresse) {
    const t = normalizar(maquinaInteresse);
    if (!t.trim()) return null;
    if (t.includes("consum")) return "consumivel";
    if (reFora.test(t) && !reBmax.test(t)) return "produto_fora_da_tabela_bmax";
    return null;
}

module.exports = { motivoForaDoEscopo, FAMILIAS_BMAX, FORA_DA_TABELA_BMAX };
