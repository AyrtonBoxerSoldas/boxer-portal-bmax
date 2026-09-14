const { QueryTypes } = require("sequelize");
const { sequelize } = require("../database");
const { getLeads, getCustomField } = require("./rd.leads.service");
const { calcularComissoes } = require("./cashback.service");
const { creditarCashback, debitarCashback } = require("./saldo.service");
const { RD_STAGE_VENDIDO, RD_STAGE_VENDA_EFETIVADA } = require("../config/constants");
const { logger } = require("../logger");

// Reconcilia o saldo real (bmax_saldo/bmax_transacoes) de cada agente (revenda,
// representante, vendedor interno/técnico) contra o que a regra de comissão diz
// que deveria estar creditado agora, para toda venda efetivada no RD. Idempotente:
// só lança a DIFERENÇA entre o que já existe e o valor correto — chamar de novo
// sem nada ter mudado não duplica nada. Usada tanto pelo botão manual
// (POST /api/cashback/recalcular) quanto pelo cron automático.
async function recalcularComissoes() {
    const allDeals = await getLeads("admin", "adm");
    const vendaStages = new Set([RD_STAGE_VENDIDO, RD_STAGE_VENDA_EFETIVADA]);
    const vendidos = allDeals.filter(d => {
        const stageId = d.deal_stage ? d.deal_stage.id : null;
        return vendaStages.has(stageId) && Number(d.amount_total || 0) > 0;
    });

    const existentes = await sequelize.query(
        `SELECT lead_id, tipo_agente, revenda as nome, SUM(CASE WHEN tipo='credito' THEN valor ELSE -valor END) as total_credito
         FROM bmax_transacoes WHERE lead_id IS NOT NULL GROUP BY lead_id, tipo_agente, revenda`,
        { type: QueryTypes.SELECT }
    );
    const creditoAtual = {};
    for (const r of existentes) creditoAtual[`${r.lead_id}::${r.tipo_agente}`] = { valor: Number(r.total_credito), nome: r.nome };

    let ajustados = 0, erros = 0, faltandoDado = 0;
    const detalhes = [];

    async function ajustar(dealId, tipoAgente, nome, correto, pciLabel, classePreco, comissaoPct) {
        const chave = `${dealId}::${tipoAgente}`;
        const atualInfo = creditoAtual[chave];
        const atual = atualInfo ? atualInfo.valor : 0;
        const diff = Number((correto - atual).toFixed(2));
        if (Math.abs(diff) < 0.01) return;

        if (diff > 0) {
            await creditarCashback(nome, diff, `Ajuste comissão ${dealId} — ${pciLabel}`, dealId, tipoAgente, { pci: pciLabel, classePreco, comissaoPct });
        } else {
            await debitarCashback(nome, Math.abs(diff), `Ajuste comissão ${dealId} — ${pciLabel}`, null, tipoAgente);
        }
        ajustados++;
        detalhes.push({ dealId, tipoAgente, nome, anterior: atual, correto, diff });
    }

    for (const deal of vendidos) {
        const dealId = deal.id || deal._id;
        const revenda = getCustomField(deal, "REVENDA/LOJA") || "";
        const representante = getCustomField(deal, "REPRESENTANTE") || "";
        const responsavelRd = (deal.user && deal.user.name) || "";
        const pci = getCustomField(deal, "PERFIL PCI") || "";
        const classePreco = (getCustomField(deal, "CLASSE DE PREÇO") || "").replace(/\D/g, "");
        const valor = Number(deal.amount_total || 0);

        try {
            const comissoes = await calcularComissoes({ valorTotal: valor, pci, classePreco, representante, responsavelRd });
            if (comissoes.faltando) { faltandoDado++; continue; }

            if (revenda && revenda !== "?????") {
                await ajustar(dealId, "revenda", revenda, comissoes.revenda ? comissoes.revenda.valor : 0, pci, classePreco, comissoes.revenda ? comissoes.revenda.comissaoPct : null);
            }
            if (comissoes.representante) {
                await ajustar(dealId, "representante", comissoes.representante.nome, comissoes.representante.valor, pci, classePreco, comissoes.representante.comissaoPct);
            }
            if (comissoes.vendedorInterno) {
                await ajustar(dealId, "vendedor_interno", comissoes.vendedorInterno.nome, comissoes.vendedorInterno.valor, pci, classePreco, comissoes.vendedorInterno.comissaoPct);
            }
        } catch (err) {
            erros++;
            logger.error({ message: "Erro recalculando deal", dealId, error: err.message });
        }
    }

    return { ok: true, total_vendidos: vendidos.length, ajustados, faltando_dado: faltandoDado, erros, detalhes };
}

// Recupera PCI de créditos antigos (antes da migration que criou a coluna
// `pci`) — só existe embutido em texto livre em `descricao`. Ex: "Venda 123
// — PCI6 (1.5%)" ou "Ajuste comissão 123 — PCI 12b".
function extrairPciDoTexto(descricao) {
    const m = (descricao || "").match(/—\s*(PCI\s?[\dA-Za-z]+)/i);
    return m ? m[1].replace(/\s/g, "").toUpperCase() : null;
}

// Auditoria SOMENTE LEITURA: para cada venda já creditada, compara o PCI/Classe
// de Preço gravados no(s) crédito(s) contra o que está no RD HOJE. Não altera
// nada — existe pra detectar em segundos o que antes só dava pra achar rodando
// script manual: campo apagado/trocado no RD depois do crédito, sem deixar
// rastro nenhum na tela do lead.
async function auditarComissoes() {
    const allDeals = await getLeads("admin", "adm");
    const vendaStages = new Set([RD_STAGE_VENDIDO, RD_STAGE_VENDA_EFETIVADA]);
    const vendidos = allDeals.filter(d => {
        const stageId = d.deal_stage ? d.deal_stage.id : null;
        return vendaStages.has(stageId) && Number(d.amount_total || 0) > 0;
    });

    const transacoes = await sequelize.query(
        `SELECT lead_id, tipo_agente, revenda as nome, valor, descricao, pci, classe_preco, criado_em
         FROM bmax_transacoes WHERE tipo = 'credito' AND lead_id IS NOT NULL ORDER BY criado_em ASC`,
        { type: QueryTypes.SELECT }
    );
    const porLead = {};
    for (const t of transacoes) {
        if (!porLead[t.lead_id]) porLead[t.lead_id] = [];
        porLead[t.lead_id].push(t);
    }

    const resultado = [];
    for (const deal of vendidos) {
        const dealId = deal.id || deal._id;
        const creditos = porLead[dealId];
        if (!creditos || !creditos.length) continue; // ainda não creditado — fora do escopo da auditoria

        const pciAtual = (getCustomField(deal, "PERFIL PCI") || "").replace(/\s/g, "").toUpperCase();
        const classeAtual = (getCustomField(deal, "CLASSE DE PREÇO") || "").replace(/\D/g, "");
        const totalCreditado = creditos.reduce((s, c) => s + Number(c.valor), 0);

        // PCI gravado: usa a coluna estruturada quando existe (créditos pós-migration);
        // pros créditos antigos, cai pro texto de `descricao`.
        const pcisGravados = [...new Set(creditos.map(c => (c.pci || extrairPciDoTexto(c.descricao) || "").toUpperCase()).filter(Boolean))];
        const classesGravadas = [...new Set(creditos.map(c => c.classe_preco).filter(Boolean))];

        const problemas = [];
        if (!pciAtual) problemas.push("sem_pci_no_rd");
        if (!classeAtual) problemas.push("sem_classe_no_rd");
        if (pciAtual && pcisGravados.length && !pcisGravados.includes(pciAtual)) problemas.push("pci_divergente");
        if (classeAtual && classesGravadas.length && !classesGravadas.includes(classeAtual)) problemas.push("classe_divergente");

        resultado.push({
            dealId,
            cliente: deal.name || "",
            pciAtual: pciAtual || null,
            classeAtual: classeAtual || null,
            pciGravado: pcisGravados.join(", ") || "(pré-migração, não recuperável)",
            classeGravada: classesGravadas.join(", ") || "(pré-migração, não recuperável)",
            totalCreditado: Number(totalCreditado.toFixed(2)),
            ok: problemas.length === 0,
            problemas
        });
    }

    resultado.sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? 1 : -1));

    return {
        ok: true,
        total_auditado: resultado.length,
        com_problema: resultado.filter(r => !r.ok).length,
        deals: resultado
    };
}

module.exports = { recalcularComissoes, auditarComissoes };
