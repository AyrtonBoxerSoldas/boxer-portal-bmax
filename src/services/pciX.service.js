const { sequelize } = require("../database");
const { QueryTypes } = require("sequelize");

// PCI X = lead de produto NÃO BMax (máquinas pequenas/médias, máscaras, acessórios) que a revenda vende do próprio estoque.
// Regras (André, 23/11/2026): marcado no RD/Pipefy; chega direto para a revenda (sem aceite); SEM comissão/cashback;
// prazo de 30 dias; vencido, o card só fica vermelho-claro (NÃO muda de etapa) até a revenda ou o admin marcar Vendido/Perdido;
// a revenda recebe alertas por e-mail durante o prazo e depois dele.
const PRAZO_DIAS = 30;
const MARCOS_ALERTA = [15, 25, 30];     // dias desde que o Portal viu o lead; depois de 30, a cada 7 dias
const ehPciX = pci => String(pci || "").replace(/\s/g, "").toUpperCase() === "PCIX";

function deveAlertar(dias, ultimoAlertaDia) {
    const d = Math.floor(dias);
    const marco = d > PRAZO_DIAS ? (d - PRAZO_DIAS) % 7 === 0 : MARCOS_ALERTA.includes(d);
    return marco && d > (ultimoAlertaDia || 0);
}
function situacao(iniciadoEm, agora = Date.now()) {
    const dias = (agora - new Date(iniciadoEm).getTime()) / 86_400_000;
    return { dias: Math.floor(dias), restantes: Math.ceil(PRAZO_DIAS - dias), vencido: dias >= PRAZO_DIAS };
}

async function garantirTabela() {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS bmax_pcix_prazo (
        deal_id TEXT PRIMARY KEY, iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(), ultimo_alerta_dia INT NOT NULL DEFAULT 0,
        ultimo_alerta_em TIMESTAMPTZ, encerrado_em TIMESTAMPTZ)`, { type: QueryTypes.RAW });
}
async function registrar(dealId, quando = null) {
    await sequelize.query(`INSERT INTO bmax_pcix_prazo (deal_id, iniciado_em) VALUES (:d, COALESCE(:q, now())) ON CONFLICT (deal_id) DO NOTHING`, { replacements: { d: dealId, q: quando }, type: QueryTypes.INSERT });
}
async function todos() { return sequelize.query(`SELECT deal_id, iniciado_em, ultimo_alerta_dia, encerrado_em FROM bmax_pcix_prazo`, { type: QueryTypes.SELECT }); }
async function marcarAlerta(dealId, dia) { await sequelize.query(`UPDATE bmax_pcix_prazo SET ultimo_alerta_dia=:dia, ultimo_alerta_em=now() WHERE deal_id=:d`, { replacements: { d: dealId, dia }, type: QueryTypes.UPDATE }); }
async function encerrar(dealId) { await sequelize.query(`UPDATE bmax_pcix_prazo SET encerrado_em=now() WHERE deal_id=:d AND encerrado_em IS NULL`, { replacements: { d: dealId }, type: QueryTypes.UPDATE }); }
// Mapa dealId -> situação (abertos), para o card
async function situacaoPorDeal(dealIds) {
    if (!dealIds.length) return new Map();
    const rows = await sequelize.query(`SELECT deal_id, iniciado_em FROM bmax_pcix_prazo WHERE deal_id = ANY(:ids) AND encerrado_em IS NULL`, { replacements: { ids: dealIds }, type: QueryTypes.SELECT });
    return new Map(rows.map(r => [r.deal_id, situacao(r.iniciado_em)]));
}

module.exports = { PRAZO_DIAS, MARCOS_ALERTA, ehPciX, deveAlertar, situacao, garantirTabela, registrar, todos, marcarAlerta, encerrar, situacaoPorDeal };
