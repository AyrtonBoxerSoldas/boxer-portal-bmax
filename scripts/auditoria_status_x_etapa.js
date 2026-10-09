// Auditoria somente-leitura: lead com status FINAL no RD (win = true "ganha" / false "perdida")
// mas ainda numa etapa de andamento (ex.: Negociação). Regra do André (09/10/2026): nenhum
// lead vendido ou perdido pode ficar em etapa de negociação.
//   node scripts/auditoria_status_x_etapa.js
require("dotenv").config({ quiet: true });
const l = require("../src/services/rd.leads.service");
const C = require("../src/config/constants");

const FINAIS = new Set([C.RD_STAGE_VENDA_EFETIVADA, C.RD_STAGE_ENTREGA_TECNICA, C.RD_STAGE_EXCLUIDO, C.RD_STAGE_VENDIDO, C.RD_STAGE_PERDIDO]);
const PIPES = { [C.RD_PIPELINE_INDUSTRIA]: "INDÚSTRIA", [C.RD_PIPELINE_BMAX_INTERNO]: "BMAX" };

(async () => {
    const deals = (await l.fetchAllDealsAllPipelines()).filter(d => PIPES[d._pipelineId]);
    console.log("deals nos funis Indústria + BMAX:", deals.length);
    const win = deals.reduce((m, d) => { const k = String(d.win); m[k] = (m[k] || 0) + 1; return m; }, {});
    console.log("campo win:", win);

    const incoerentes = deals.filter(d => (d.win === true || d.win === false) && !FINAIS.has(d.deal_stage?.id));
    console.log("\nwin final + etapa de andamento:", incoerentes.length);
    incoerentes.forEach(d => console.log(" ", d.id, "|", (d.name || "").trim(), "|", PIPES[d._pipelineId], "/", d.deal_stage?.name, "| win:", d.win, "| PCI:", l.getCustomField(d, "PERFIL PCI"), "| rev:", l.getCustomField(d, "REVENDA/LOJA"), "| fechado:", d.closed_at ? d.closed_at.slice(0, 10) : "-"));

    // inverso: etapa final de venda/perda mas win ainda aberto (não é o caso pedido, só informativo)
    const inverso = deals.filter(d => (d.win === null || d.win === undefined) && [C.RD_STAGE_VENDA_EFETIVADA, C.RD_STAGE_VENDIDO, C.RD_STAGE_PERDIDO, C.RD_STAGE_ENTREGA_TECNICA].includes(d.deal_stage?.id));
    console.log("\n(informativo) etapa final de venda/perda com win aberto:", inverso.length);
    process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
