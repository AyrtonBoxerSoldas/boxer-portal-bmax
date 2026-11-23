const { sequelize } = require("../database");
const { QueryTypes } = require("sequelize");
const { logger } = require("../logger");

// Andamento da negociação do lead que a revenda atende (PCI12a e, depois, PCI X) + motivo de perda.
// Cada registro vai pro histórico do Portal (bmax_lead_andamento) E vira uma ANOTAÇÃO no card (RD/Pipefy via createNote).
const STATUS = ["Pendente", "Sem retorno", "Em contato", "Proposta enviada", "Em negociação", "Aguardando pagamento", "Aguardando decisão do cliente"];
const MOTIVOS_PERDA = ["Já comprou a máquina", "Preço acima do esperado", "Sem contato com o cliente", "Optou por outra marca", "Desistiu da compra", "Prazo de entrega", "Falta de crédito/financiamento", "Outro"];

const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); // nota do RD corrompe acento
const limpa = (s, max = 1000) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

async function garantirTabela() {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS bmax_lead_andamento (
        id BIGSERIAL PRIMARY KEY, deal_id TEXT NOT NULL, tipo TEXT NOT NULL CHECK (tipo IN ('status','perda','venda')),
        status TEXT, motivo TEXT, observacao TEXT, pci TEXT, revenda TEXT, usuario TEXT, nota_gravada BOOLEAN NOT NULL DEFAULT false,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now())`, { type: QueryTypes.RAW });
    await sequelize.query(`CREATE INDEX IF NOT EXISTS bmax_lead_andamento_deal_idx ON bmax_lead_andamento (deal_id, criado_em DESC)`, { type: QueryTypes.RAW });
}

function validar({ tipo, status, motivo, observacao }) {
    if (tipo === "status") {
        if (!STATUS.includes(status)) return "Status inválido";
    } else if (tipo === "perda") {
        if (!MOTIVOS_PERDA.includes(motivo)) return "Informe o motivo da perda";
        if (motivo === "Outro" && !limpa(observacao)) return "Para o motivo \"Outro\", descreva na observação";
    } else if (tipo !== "venda") return "Tipo inválido";
    return null;
}

// Grava no histórico e escreve a anotação no card. A anotação falhar NÃO perde o registro (nota_gravada=false para reenvio).
async function registrar({ dealId, tipo, status, motivo, observacao, pci, revenda, usuario }, createNote) {
    const erro = validar({ tipo, status, motivo, observacao }); if (erro) { const e = new Error(erro); e.status = 400; throw e; }
    const obs = limpa(observacao);
    const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const linhas = tipo === "perda" ? [`PERDIDO PELA REVENDA - Motivo: ${motivo}`]
        : tipo === "venda" ? ["VENDIDO PELA REVENDA"] : [`ANDAMENTO DA NEGOCIACAO - Status: ${status}`];
    if (obs) linhas.push(`Obs: ${obs}`);
    linhas.push(`Por ${usuario || revenda || "revenda"}${revenda ? " (" + revenda + ")" : ""} em ${quando}`);
    const [row] = await sequelize.query(
        `INSERT INTO bmax_lead_andamento (deal_id,tipo,status,motivo,observacao,pci,revenda,usuario) VALUES (:dealId,:tipo,:status,:motivo,:obs,:pci,:revenda,:usuario) RETURNING id`,
        { replacements: { dealId, tipo, status: status || null, motivo: motivo || null, obs: obs || null, pci: pci || null, revenda: revenda || null, usuario: usuario || null }, type: QueryTypes.SELECT });
    let notaOk = false;
    try { await createNote(dealId, semAcento(linhas.join(" | "))); notaOk = true; await sequelize.query(`UPDATE bmax_lead_andamento SET nota_gravada=true WHERE id=:id`, { replacements: { id: row.id }, type: QueryTypes.UPDATE }); }
    catch (e) { logger.error({ message: "Andamento gravado, mas a anotação no card falhou", dealId, error: e.message }); }
    return { id: row.id, notaGravada: notaOk };
}

// Último andamento por card (para o chip no card) — uma consulta só.
async function ultimosPorDeal(dealIds) {
    if (!dealIds.length) return new Map();
    const rows = await sequelize.query(
        `SELECT DISTINCT ON (deal_id) deal_id, tipo, status, motivo, observacao, usuario, criado_em FROM bmax_lead_andamento WHERE deal_id = ANY(:ids) ORDER BY deal_id, criado_em DESC`,
        { replacements: { ids: dealIds }, type: QueryTypes.SELECT });
    return new Map(rows.map(r => [r.deal_id, r]));
}
async function historico(dealId) {
    return sequelize.query(`SELECT tipo,status,motivo,observacao,usuario,criado_em FROM bmax_lead_andamento WHERE deal_id=:d ORDER BY criado_em DESC LIMIT 100`, { replacements: { d: dealId }, type: QueryTypes.SELECT });
}
// Relatório de motivos de perda (admin)
async function relatorioPerdas({ de, ate } = {}) {
    return sequelize.query(
        `SELECT COALESCE(revenda,'(sem revenda)') revenda, motivo, count(*)::int qtd FROM bmax_lead_andamento
         WHERE tipo='perda' AND (:de::timestamptz IS NULL OR criado_em >= :de::timestamptz) AND (:ate::timestamptz IS NULL OR criado_em < :ate::timestamptz)
         GROUP BY 1,2 ORDER BY 1, qtd DESC`, { replacements: { de: de || null, ate: ate || null }, type: QueryTypes.SELECT });
}

module.exports = { STATUS, MOTIVOS_PERDA, garantirTabela, registrar, ultimosPorDeal, historico, relatorioPerdas, validar };
