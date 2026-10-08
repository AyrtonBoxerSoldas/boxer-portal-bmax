// Quais cards ficam FORA do Portal pela regra de escopo BMax (somente leitura).
// Uso: node scripts/auditoria_escopo_bmax.js
require("dotenv").config({ quiet: true });
const { fetchAllDealsFromRD, getLeads, getCustomField } = require("../src/services/rd.leads.service");
const { motivoForaDoEscopo } = require("../src/services/escopoBmax.service");
const { RD_STAGES } = require("../src/config/constants");
const { sequelize } = require("../src/database");
const { QueryTypes } = require("sequelize");
(async () => {
    const visiveis = await getLeads("admin", "adm");
    const idsVis = new Set(visiveis.map(d => d.id || d._id));
    const todos = (await fetchAllDealsFromRD()).filter(d => d.deal_stage && !["66151c4859f00e001209d066", "6a2bff35a294cf00226dd603"].includes(d.deal_stage.id) && new Date(d.created_at) >= new Date("2026-05-01T00:00:00"));
    const fora = todos.filter(d => !idsVis.has(d.id || d._id));
    const cred = await sequelize.query(`SELECT lead_id, tipo_agente, SUM(CASE WHEN tipo='credito' THEN valor ELSE -valor END) v FROM bmax_transacoes WHERE lead_id IS NOT NULL GROUP BY 1,2`, { type: QueryTypes.SELECT });
    const cm = {}; cred.forEach(c => { (cm[c.lead_id] = cm[c.lead_id] || {})[c.tipo_agente] = Number(c.v); });
    console.log("visíveis:", visiveis.length, "| fora do escopo:", fora.length);
    const porMotivo = {}, porEtapa = {}, porRev = {};
    let totalCred = 0, comCred = 0;
    fora.forEach(d => {
        const m = motivoForaDoEscopo(getCustomField(d, "MÁQUINA DE INTERESSE"), getCustomField(d, "SEGMENTO DE PRODUTO"));
        porMotivo[m] = (porMotivo[m] || 0) + 1;
        const e = RD_STAGES[d.deal_stage.id]; porEtapa[e] = (porEtapa[e] || 0) + 1;
        const r = getCustomField(d, "REVENDA/LOJA") || "(vazio)"; porRev[r] = (porRev[r] || 0) + 1;
        const c = cm[d.id || d._id];
        if (c) { comCred++; totalCred += Object.values(c).reduce((a, b) => a + b, 0); }
    });
    console.log("por motivo:", porMotivo, "\npor etapa:", porEtapa, "\npor revenda:", porRev);
    console.log("com cashback já lançado:", comCred, "| soma líquida (todos os agentes) R$", totalCred.toFixed(2));
    console.log("\nlista dos que saem por 'produto fora da tabela':");
    fora.filter(d => motivoForaDoEscopo(getCustomField(d, "MÁQUINA DE INTERESSE"), getCustomField(d, "SEGMENTO DE PRODUTO")) !== "consumivel").forEach(d => console.log("  ", d.id, "|", d.name, "|", getCustomField(d, "MÁQUINA DE INTERESSE"), "|", RD_STAGES[d.deal_stage.id], "|", getCustomField(d, "REVENDA/LOJA")));
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
