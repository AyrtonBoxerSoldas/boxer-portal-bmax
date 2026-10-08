// Auditoria somente-leitura dos cards que o Portal mostra (mesma base de getLeads):
//  1) Venda Efetivada/Entrega Técnica/Vendido ainda em PCI12 (seletor de caminho indevido)
//  2) leads duplicados (mesmo CNPJ ou mesmo nome, entre cards visíveis)
//  3) cards de consumíveis / máquinas fora do portfólio BMax
// Uso: node scripts/auditoria_leads_portal.js
require("dotenv").config({ quiet: true });
const { getLeads, getCustomField } = require("../src/services/rd.leads.service");
const { RD_STAGES } = require("../src/config/constants");

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const digits = s => String(s || "").replace(/\D/g, "");

(async () => {
    const deals = await getLeads("admin", "adm");
    const info = deals.map(d => ({
        id: d.id || d._id,
        nome: d.name || "",
        cnpj: digits(getCustomField(d, "CNPJ") || (d.organization?.organization_custom_fields || []).find(c => c.custom_field?.label?.toUpperCase() === "CNPJ")?.value),
        stage: RD_STAGES[d.deal_stage?.id] || d.deal_stage?.name || d.deal_stage?.id,
        pci: String(getCustomField(d, "PERFIL PCI") || "").replace(/\s/g, "").toUpperCase(),
        maq: getCustomField(d, "MÁQUINA DE INTERESSE") || "",
        revenda: getCustomField(d, "REVENDA/LOJA") || "",
        valor: d.amount_total || 0,
        criado: (d.created_at || "").slice(0, 10),
        win: d.win
    }));
    console.log("cards visíveis (admin):", info.length);

    const porStage = {};
    info.forEach(i => { porStage[i.stage] = (porStage[i.stage] || 0) + 1; });
    console.log("por etapa:", porStage);

    // 1) etapas finais com PCI12 (a tela mostra o seletor para qualquer coisa != Vendido/Perdido)
    const finais = new Set(["Venda Efetivada", "Entrega Técnica", "Vendido"]);
    const pci12Final = info.filter(i => i.pci === "PCI12" && finais.has(i.stage));
    console.log("\n[1] PCI12 em etapa final:", pci12Final.length);
    pci12Final.forEach(i => console.log(" ", i.id, "|", i.nome, "|", i.stage, "|", i.revenda, "|", i.criado));
    const pci12All = info.filter(i => i.pci === "PCI12");
    const porStagePci12 = {};
    pci12All.forEach(i => { porStagePci12[i.stage] = (porStagePci12[i.stage] || 0) + 1; });
    console.log("   PCI12 por etapa (todos):", porStagePci12);

    // 2) duplicados
    const grupos = (chave) => {
        const m = new Map();
        info.forEach(i => { const k = chave(i); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(i); } });
        return [...m.entries()].filter(([, v]) => v.length > 1);
    };
    const dupCnpj = grupos(i => i.cnpj.length === 14 ? i.cnpj : null);
    const dupNome = grupos(i => norm(i.nome).length > 3 ? norm(i.nome) : null);
    console.log("\n[2] grupos duplicados por CNPJ:", dupCnpj.length, "| por nome:", dupNome.length);
    dupCnpj.forEach(([k, v]) => { console.log(" CNPJ", k); v.forEach(i => console.log("    ", i.id, "|", i.nome, "|", i.stage, "|", i.pci, "|", i.revenda, "|", i.maq, "|", i.criado)); });
    const idsCnpj = new Set(dupCnpj.flatMap(([, v]) => v.map(i => i.id)));
    dupNome.filter(([, v]) => !v.every(i => idsCnpj.has(i.id))).forEach(([k, v]) => { console.log(" NOME", k); v.forEach(i => console.log("    ", i.id, "|", i.nome, "|", i.cnpj, "|", i.stage, "|", i.pci, "|", i.revenda, "|", i.maq, "|", i.criado)); });

    // 3) máquinas
    const porMaq = {};
    info.forEach(i => { const k = i.maq || "(vazio)"; porMaq[k] = (porMaq[k] || 0) + 1; });
    console.log("\n[3] valores de MÁQUINA DE INTERESSE:");
    Object.entries(porMaq).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log("  ", n, "|", k));
    process.exit(0);
})().catch(e => { console.error("ERRO", e); process.exit(1); });
