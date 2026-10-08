// Preenche o acompanhamento de prazo dos leads PCI12 JÁ pendentes (regra de 08/10/2026):
// o prazo de 48h conta a partir da DATA DE CRIAÇÃO do lead (decisão do André). Leads que
// já têm registro não são alterados. Não escreve nada no RD.
//   node scripts/backfill-pci12-prazos.js [--aplicar]   (sem a flag, só lista)
require("dotenv").config({ quiet: true });
const { getLeads, getCustomField } = require("../src/services/rd.leads.service");
const { registrarTroca } = require("../src/services/pci12Tracking.service");
const { RD_OWNERS } = require("../src/config/constants");
const { sequelize } = require("../src/database");
const { QueryTypes } = require("sequelize");

(async () => {
    const aplicar = process.argv.includes("--aplicar");
    const deals = await getLeads("admin", "adm");
    const existentes = new Set((await sequelize.query("SELECT deal_id FROM bmax_pci12_tracking", { type: QueryTypes.SELECT })).map(r => r.deal_id));
    const pend = deals.filter(d => {
        const pci = (getCustomField(d, "PERFIL PCI") || "").replace(/\s/g, "").toUpperCase();
        const rev = getCustomField(d, "REVENDA/LOJA") || "";
        return pci === "PCI12" && rev && rev !== "?????" && rev !== "Sem Revenda";
    });
    let novos = 0;
    for (const d of pend) {
        const id = d.id || d._id;
        const ownerId = d.user?._id || d.user?.id || "";
        const jaAndre = ownerId === RD_OWNERS["Revenda"];
        const horas = Math.round((Date.now() - new Date(d.created_at).getTime()) / 3_600_000);
        const status = existentes.has(id) ? "já rastreado" : (aplicar ? "REGISTRADO" : "registraria");
        console.log(`${status.padEnd(13)} | ${d.name} | rev: ${getCustomField(d, "REVENDA/LOJA")} | dono: ${d.user?.name} | criado há ${horas}h`);
        if (!existentes.has(id) && aplicar) {
            if (await registrarTroca(id, jaAndre ? "" : ownerId, jaAndre ? null : (d.user?.name || null), d.created_at)) novos++;
        }
    }
    console.log(`\nPCI12 pendentes: ${pend.length} | novos registros: ${novos}${aplicar ? "" : " (simulação — use --aplicar)"}`);
    process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
